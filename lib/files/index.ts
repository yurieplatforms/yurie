/**
 * Files Module
 * 
 * Re-exports file handling utilities from a single entry point.
 * Includes vision processing, PDF support, file validation, and file type helpers.
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/pdf-support
 * @see https://platform.claude.com/docs/en/build-with-claude/vision
 */

// Vision and image processing
export {
  // Constants
  VISION_CONSTANTS,
  SUPPORTED_IMAGE_FORMATS,
  OPTIMAL_IMAGE_SIZES,
  MAX_IMAGE_FILE_SIZE,
  MAX_DOCUMENT_FILE_SIZE,
  MAX_IMAGE_DIMENSION_LIMIT,
  MAX_PDF_PAGES,
  // Token estimation
  estimateImageTokens,
  estimateImageCost,
  // Image utilities
  getImageDimensions,
  resizeImageForVision,
  // Validation
  isSupportedImageFormat,
  isValidImageFormat,
  isTextFile,
  validateFileSize,
  validateImageDimensions,
  validateImageCount,
  validateFile,
} from './vision'

// Types
export type { SupportedImageFormat } from './vision'

// PDF-specific utilities
export {
  PDF_REQUIREMENTS,
  validatePdfFile,
  isPdfUrl,
  createPdfDocumentSegment,
  createUrlPdfDocumentSegment,
} from './pdf'

// Re-export file helpers from utils for convenience
export { readFileAsDataURL, isImageFile, isPdfFile } from '@/lib/utils'

