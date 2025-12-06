/**
 * Vision Best Practices - Image Processing for Claude API
 * 
 * Handles image resizing, validation, and optimization for Claude's vision API.
 * @see https://platform.claude.com/docs/en/build-with-claude/vision
 */

import { readFileAsDataURL, isImageFile, isPdfFile } from '@/lib/utils'

/**
 * Vision API Constants
 * @see https://platform.claude.com/docs/en/build-with-claude/vision
 */
export const VISION_CONSTANTS = {
  /**
   * Maximum dimension for optimal vision performance.
   * Recommended resizing images to no more than 1568 pixels on the longest edge
   * to improve time-to-first-token without sacrificing model performance.
   */
  MAX_OPTIMAL_DIMENSION: 1568,

  /**
   * Target megapixels for optimal performance (~1.15 megapixels)
   * Images larger than this will be resized by Claude anyway, so we do it client-side
   * to reduce upload time and improve latency.
   */
  TARGET_MEGAPIXELS: 1.15 * 1000000,

  /**
   * Minimum recommended image dimension.
   * Very small images under 200 pixels on any given edge may degrade performance.
   */
  MIN_RECOMMENDED_DIMENSION: 200,

  /**
   * Maximum absolute image dimension (will be rejected by API)
   */
  MAX_ABSOLUTE_DIMENSION: 8000,

  /**
   * Maximum dimension when more than 20 images are in a single request.
   * If you submit more than 20 images in one API request, the limit becomes 2000x2000 px.
   */
  MAX_DIMENSION_MULTI_IMAGE: 2000,

  /**
   * Threshold for applying multi-image dimension limits
   */
  MULTI_IMAGE_THRESHOLD: 20,

  /**
   * Maximum number of images per API request
   */
  MAX_IMAGES_PER_REQUEST: 100,

  /**
   * Maximum file size per image (5MB for API)
   */
  MAX_FILE_SIZE: 5 * 1024 * 1024,

  /**
   * Token divisor for estimating image token usage.
   * Formula: tokens = (width * height) / 750
   */
  TOKEN_DIVISOR: 750,
} as const

// Legacy exports for backwards compatibility
const MAX_IMAGE_DIMENSION = VISION_CONSTANTS.MAX_OPTIMAL_DIMENSION
const TARGET_MEGAPIXELS = VISION_CONSTANTS.TARGET_MEGAPIXELS

/**
 * Supported image formats for Claude vision API
 */
export const SUPPORTED_IMAGE_FORMATS: readonly string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
export type SupportedImageFormat = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

/**
 * Checks if a media type is a supported image format
 */
export const isSupportedImageFormat = (mediaType: string): mediaType is SupportedImageFormat =>
  SUPPORTED_IMAGE_FORMATS.includes(mediaType)

/**
 * File size limits based on Anthropic documentation
 * @see https://platform.claude.com/docs/en/build-with-claude/pdf-support
 * 
 * - API: Maximum 5MB per image
 * - Documents: Maximum 32MB total request size
 * - PDF pages: Maximum 100 pages per request
 */
export const MAX_IMAGE_FILE_SIZE = VISION_CONSTANTS.MAX_FILE_SIZE
export const MAX_DOCUMENT_FILE_SIZE = 32 * 1024 * 1024 // 32MB max request size for PDFs
export const MAX_IMAGE_DIMENSION_LIMIT = VISION_CONSTANTS.MAX_ABSOLUTE_DIMENSION
export const MAX_PDF_PAGES = 100 // Max pages per PDF request

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimates the number of tokens an image will consume.
 * 
 * Formula from Anthropic documentation: tokens = (width * height) / 750
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/vision#calculate-image-costs
 * 
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Approximate number of tokens
 */
export const estimateImageTokens = (width: number, height: number): number =>
  Math.ceil((width * height) / VISION_CONSTANTS.TOKEN_DIVISOR)

/**
 * Estimates the cost of processing an image based on token count and model pricing.
 * 
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param pricePerMillionTokens - Model's price per million input tokens (default: $3 for Claude Sonnet)
 * @returns Estimated cost in USD
 */
export const estimateImageCost = (
  width: number,
  height: number,
  pricePerMillionTokens: number = 3
): number => {
  const tokens = estimateImageTokens(width, height)
  return (tokens / 1_000_000) * pricePerMillionTokens
}

/**
 * Optimal image sizes by aspect ratio that won't be resized by Claude.
 * These use approximately 1,600 tokens each.
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/vision#evaluate-image-size
 */
export const OPTIMAL_IMAGE_SIZES: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1092, height: 1092 },
  '3:4': { width: 951, height: 1268 },
  '2:3': { width: 896, height: 1344 },
  '9:16': { width: 819, height: 1456 },
  '1:2': { width: 784, height: 1568 },
}

// ============================================================================
// Image Dimension Utilities
// ============================================================================

/**
 * Loads an image from a File and returns its dimensions
 */
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.width, height: img.height })
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    
    img.src = url
  })

/**
 * Resizes an image file to optimize for Claude's vision API.
 * 
 * Best practices from Anthropic documentation:
 * - Resize images to no more than 1568 pixels on the longest edge
 * - Target ~1.15 megapixels for optimal time-to-first-token
 * - Maintains aspect ratio
 * 
 * @param file - The image file to resize
 * @param maxDimension - Maximum dimension for the longest edge (default: 1568)
 * @returns A promise that resolves to the resized image as a data URL
 */
export const resizeImageForVision = (
  file: File,
  maxDimension: number = MAX_IMAGE_DIMENSION
): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { width, height } = img
      const pixels = width * height

      // Check if resizing is needed
      const needsResize =
        width > maxDimension ||
        height > maxDimension ||
        pixels > TARGET_MEGAPIXELS

      if (!needsResize) {
        // Image is already optimal, return original as data URL
        readFileAsDataURL(file).then(resolve).catch(reject)
        return
      }

      // Calculate new dimensions maintaining aspect ratio
      let newWidth = width
      let newHeight = height

      // First, scale down to max dimension
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        newWidth = Math.round(width * ratio)
        newHeight = Math.round(height * ratio)
      }

      // Then, check if still exceeds megapixel target
      const newPixels = newWidth * newHeight
      if (newPixels > TARGET_MEGAPIXELS) {
        const scale = Math.sqrt(TARGET_MEGAPIXELS / newPixels)
        newWidth = Math.round(newWidth * scale)
        newHeight = Math.round(newHeight * scale)
      }

      // Create canvas and resize
      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Use high-quality image smoothing
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Draw resized image
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      // Determine output format and quality
      // Use original format when possible, fallback to JPEG for best compression
      let outputFormat = file.type
      const quality = 0.92

      if (!SUPPORTED_IMAGE_FORMATS.includes(outputFormat)) {
        outputFormat = 'image/jpeg'
      }

      // For JPEG and WebP, use quality setting
      if (outputFormat === 'image/jpeg' || outputFormat === 'image/webp') {
        resolve(canvas.toDataURL(outputFormat, quality))
      } else {
        resolve(canvas.toDataURL(outputFormat))
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for resizing'))
    }

    img.src = url
  })

// ============================================================================
// File Validation
// ============================================================================

/**
 * Validates if the file format is supported for Claude vision
 */
export const isValidImageFormat = (file: File): boolean =>
  SUPPORTED_IMAGE_FORMATS.includes(file.type)

/**
 * Validates if the file is a supported text file
 */
export const isTextFile = (file: File): boolean => {
  const textTypes = ['text/plain', 'text/markdown', 'text/csv']
  const textExtensions = ['.txt', '.md', '.csv']
  
  return (
    textTypes.includes(file.type) ||
    textExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
  )
}

/**
 * Validates file size against Claude API limits
 * @param file - The file to validate
 * @param isImage - Whether the file is an image (stricter limit)
 * @returns Object with valid status and error message if invalid
 */
export const validateFileSize = (
  file: File,
  isImage: boolean = false
): { valid: boolean; error?: string } => {
  const maxSize = isImage ? MAX_IMAGE_FILE_SIZE : MAX_DOCUMENT_FILE_SIZE
  const maxSizeMB = maxSize / (1024 * 1024)

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds ${maxSizeMB}MB limit`,
    }
  }

  return { valid: true }
}

/**
 * Validates image dimensions against Claude API limits
 * 
 * Checks:
 * - Images larger than 8000x8000 px will be rejected
 * - Warns if images are very small (<200px) as this may degrade performance
 * - Supports multi-image mode where limits change when >20 images in request
 * 
 * @param file - The image file to validate
 * @param options - Validation options
 * @returns Validation result with dimensions and any warnings
 */
export const validateImageDimensions = async (
  file: File,
  options: {
    /** Total number of images in the request (affects dimension limits) */
    imageCount?: number
  } = {}
): Promise<{
  valid: boolean
  error?: string
  warnings?: string[]
  dimensions?: { width: number; height: number }
  estimatedTokens?: number
}> => {
  const { imageCount = 1 } = options
  const warnings: string[] = []

  try {
    const dimensions = await getImageDimensions(file)
    const { width, height } = dimensions
    const estimatedTokens = estimateImageTokens(width, height)

    // Determine the max dimension based on image count
    // When more than 20 images in a request, the limit is 2000x2000 px
    const isMultiImageMode = imageCount > VISION_CONSTANTS.MULTI_IMAGE_THRESHOLD
    const maxDimension = isMultiImageMode
      ? VISION_CONSTANTS.MAX_DIMENSION_MULTI_IMAGE
      : VISION_CONSTANTS.MAX_ABSOLUTE_DIMENSION

    // Check maximum dimensions
    if (width > maxDimension || height > maxDimension) {
      const limitReason = isMultiImageMode
        ? `When submitting more than ${VISION_CONSTANTS.MULTI_IMAGE_THRESHOLD} images, the maximum is ${maxDimension}x${maxDimension}px`
        : `Maximum dimensions are ${maxDimension}x${maxDimension}px`
      
      return {
        valid: false,
        error: `Image "${file.name}" (${width}x${height}px) exceeds limits. ${limitReason}`,
        dimensions,
        estimatedTokens,
      }
    }

    // Warn about very small images that may degrade performance
    if (width < VISION_CONSTANTS.MIN_RECOMMENDED_DIMENSION || 
        height < VISION_CONSTANTS.MIN_RECOMMENDED_DIMENSION) {
      warnings.push(
        `Image "${file.name}" (${width}x${height}px) is very small. Images under ${VISION_CONSTANTS.MIN_RECOMMENDED_DIMENSION}px may degrade performance.`
      )
    }

    // Warn if image will be resized by Claude
    if (width > VISION_CONSTANTS.MAX_OPTIMAL_DIMENSION || 
        height > VISION_CONSTANTS.MAX_OPTIMAL_DIMENSION) {
      warnings.push(
        `Image "${file.name}" will be resized to fit within ${VISION_CONSTANTS.MAX_OPTIMAL_DIMENSION}px for optimal performance.`
      )
    }

    return {
      valid: true,
      dimensions,
      estimatedTokens,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch {
    return {
      valid: false,
      error: `Failed to read image dimensions for "${file.name}"`,
    }
  }
}

/**
 * Validates the number of images in a request against API limits.
 * 
 * @param imageCount - Number of images in the request
 * @returns Validation result
 */
export const validateImageCount = (
  imageCount: number
): { valid: boolean; error?: string; warnings?: string[] } => {
  const warnings: string[] = []

  if (imageCount > VISION_CONSTANTS.MAX_IMAGES_PER_REQUEST) {
    return {
      valid: false,
      error: `Too many images (${imageCount}). Maximum is ${VISION_CONSTANTS.MAX_IMAGES_PER_REQUEST} images per API request.`,
    }
  }

  // Warn about multi-image mode restrictions
  if (imageCount > VISION_CONSTANTS.MULTI_IMAGE_THRESHOLD) {
    warnings.push(
      `With ${imageCount} images, maximum dimension per image is ${VISION_CONSTANTS.MAX_DIMENSION_MULTI_IMAGE}x${VISION_CONSTANTS.MAX_DIMENSION_MULTI_IMAGE}px (not ${VISION_CONSTANTS.MAX_ABSOLUTE_DIMENSION}x${VISION_CONSTANTS.MAX_ABSOLUTE_DIMENSION}px).`
    )
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined }
}

/**
 * Comprehensive file validation for Claude vision/document API
 * Validates format, size, and dimensions (for images)
 * 
 * @param file - The file to validate
 * @param options - Validation options
 * @returns Validation result with warnings and estimated tokens for images
 */
export const validateFile = async (
  file: File,
  options: {
    /** Total number of images in the request (affects dimension limits) */
    imageCount?: number
  } = {}
): Promise<{
  valid: boolean
  error?: string
  warnings?: string[]
  estimatedTokens?: number
}> => {
  const { imageCount = 1 } = options
  const warnings: string[] = []

  // Check if it's a supported file type
  const isImage = isImageFile(file)
  const isPdf = isPdfFile(file)
  const isText = isTextFile(file)

  if (!isImage && !isPdf && !isText) {
    return {
      valid: false,
      error: `Unsupported file type: "${file.name}". Supported: images (JPEG, PNG, GIF, WebP), PDFs, and text files.`,
    }
  }

  // Validate image format specifically
  if (isImage && !isValidImageFormat(file)) {
    return {
      valid: false,
      error: `Unsupported image format: "${file.name}". Use JPEG, PNG, GIF, or WebP.`,
    }
  }

  // Validate file size
  const sizeValidation = validateFileSize(file, isImage)
  if (!sizeValidation.valid) {
    return sizeValidation
  }

  // Validate image dimensions with image count for multi-image mode
  if (isImage) {
    const dimensionValidation = await validateImageDimensions(file, { imageCount })
    if (!dimensionValidation.valid) {
      return {
        valid: false,
        error: dimensionValidation.error,
        estimatedTokens: dimensionValidation.estimatedTokens,
      }
    }

    // Collect dimension-related warnings
    if (dimensionValidation.warnings) {
      warnings.push(...dimensionValidation.warnings)
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      estimatedTokens: dimensionValidation.estimatedTokens,
    }
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined }
}

