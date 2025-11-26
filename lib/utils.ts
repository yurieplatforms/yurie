import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const readFileAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result)
        return
      }
      reject(new Error('Failed to read file as data URL'))
    }
    reader.onerror = () => {
      reject(
        reader.error ?? new Error('An unknown error occurred while reading'),
      )
    }
    reader.readAsDataURL(file)
  })

export const isImageFile = (file: File) => file.type?.startsWith('image/')

export const isPdfFile = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

// ============================================================================
// Vision Best Practices - Image Resizing
// See: https://platform.claude.com/docs/en/build-with-claude/vision
// ============================================================================

/**
 * Maximum dimension for optimal Claude vision performance.
 * Anthropic recommends resizing images to no more than 1568 pixels on the longest edge
 * to improve time-to-first-token without sacrificing model performance.
 */
const MAX_IMAGE_DIMENSION = 1568

/**
 * Target megapixels for optimal performance (~1.15 megapixels)
 * Images larger than this will be resized by Claude anyway, so we do it client-side
 * to reduce upload time and improve latency.
 */
const TARGET_MEGAPIXELS = 1.15 * 1000000

/**
 * Supported image formats for Claude vision API
 */
export const SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/**
 * File size limits based on Anthropic documentation
 * - API: Maximum 5MB per image
 * - Documents: Maximum 32MB total request size
 */
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024 // 5MB
export const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024 // 10MB for PDFs/text
export const MAX_IMAGE_DIMENSION_LIMIT = 8000 // Max 8000x8000 px

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
// Vision Best Practices - File Validation
// See: https://platform.claude.com/docs/en/build-with-claude/vision
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
 * Images larger than 8000x8000 px will be rejected
 */
export const validateImageDimensions = async (
  file: File
): Promise<{ valid: boolean; error?: string; dimensions?: { width: number; height: number } }> => {
  try {
    const dimensions = await getImageDimensions(file)

    if (
      dimensions.width > MAX_IMAGE_DIMENSION_LIMIT ||
      dimensions.height > MAX_IMAGE_DIMENSION_LIMIT
    ) {
      return {
        valid: false,
        error: `Image "${file.name}" exceeds maximum dimensions (${MAX_IMAGE_DIMENSION_LIMIT}x${MAX_IMAGE_DIMENSION_LIMIT}px)`,
        dimensions,
      }
    }

    return { valid: true, dimensions }
  } catch {
    return {
      valid: false,
      error: `Failed to read image dimensions for "${file.name}"`,
    }
  }
}

/**
 * Comprehensive file validation for Claude vision/document API
 * Validates format, size, and dimensions (for images)
 */
export const validateFile = async (
  file: File
): Promise<{ valid: boolean; error?: string; warnings?: string[] }> => {
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

  // Validate image dimensions
  if (isImage) {
    const dimensionValidation = await validateImageDimensions(file)
    if (!dimensionValidation.valid) {
      return dimensionValidation
    }

    // Add warning if image is large and will be resized
    if (dimensionValidation.dimensions) {
      const { width, height } = dimensionValidation.dimensions
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        warnings.push(
          `Image will be resized from ${width}x${height} to fit within ${MAX_IMAGE_DIMENSION}px for optimal performance.`
        )
      }
    }
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined }
}
