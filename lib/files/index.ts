/**
 * Files Module
 * 
 * Re-exports file handling utilities from a single entry point.
 * Includes vision processing, file validation, and file type helpers.
 */

// Vision and image processing
export {
  SUPPORTED_IMAGE_FORMATS,
  MAX_IMAGE_FILE_SIZE,
  MAX_DOCUMENT_FILE_SIZE,
  MAX_IMAGE_DIMENSION_LIMIT,
  getImageDimensions,
  resizeImageForVision,
  isValidImageFormat,
  isTextFile,
  validateFileSize,
  validateImageDimensions,
  validateFile,
} from './vision'

// Re-export file helpers from utils for convenience
export { readFileAsDataURL, isImageFile, isPdfFile } from '@/lib/utils'

