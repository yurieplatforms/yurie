/**
 * PDF Support
 *
 * Handles PDF validation, processing, and document block creation.
 * Implements OpenAI best practices for PDF file inputs.
 *
 * @see https://platform.openai.com/docs/guides/pdf-files
 *
 * Key PDF Requirements (per OpenAI docs):
 * - Maximum file size: 50MB per file
 * - Maximum total content: 50MB across all files in a single request
 * - Format: Standard PDF (no passwords/encryption)
 *
 * How OpenAI processes PDFs:
 * - Extracts text from each page
 * - Creates an image of each page for visual understanding
 * - Both text and images are added to the model's context
 *
 * Best Practices:
 * - Place PDFs before text in requests (handled by message converter)
 * - Use standard fonts for better text extraction
 * - Ensure text is clear and legible
 * - Rotate pages to proper upright orientation
 * - Use logical page numbers in prompts
 * - Upload files with purpose "user_data" when using Files API
 *
 * Supported input methods:
 * 1. Base64-encoded: data:application/pdf;base64,{base64string}
 * 2. File URL: External URL pointing to a PDF
 * 3. File ID: ID from uploading to /v1/files endpoint
 */

import { isPdfFile } from '@/lib/utils'

// ============================================================================
// Constants
// ============================================================================

/**
 * PDF requirements per OpenAI documentation
 */
export const PDF_REQUIREMENTS = {
  /** Maximum file size in bytes (50MB per file) */
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  /** Maximum total content size across all files (50MB) */
  MAX_TOTAL_SIZE: 50 * 1024 * 1024,
  /** Approximate tokens per page (for cost estimation) */
  TOKENS_PER_PAGE_TEXT: 1500, // 1,500-3,000 tokens per page for text
  TOKENS_PER_PAGE_IMAGE: 2333, // ~7,000 tokens for 3 pages (visual analysis)
  /** Supported media type */
  MEDIA_TYPE: 'application/pdf' as const,
  /** Recommended file upload purpose */
  UPLOAD_PURPOSE: 'user_data' as const,
} as const

/**
 * Common PDF file signatures for validation
 * PDF files start with %PDF-
 */
const PDF_SIGNATURE = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]) // %PDF-

// ============================================================================
// Validation
// ============================================================================

export type PdfValidationResult = {
  valid: boolean
  error?: string
  warnings?: string[]
  metadata?: {
    sizeBytes: number
    sizeMB: number
  }
}

/**
 * Validates a PDF file for use with OpenAI API
 *
 * Checks:
 * - File is a valid PDF (by type or extension)
 * - File size is within limits (50MB per file)
 * - File has valid PDF signature
 *
 * @param file - The PDF file to validate
 * @returns Validation result with error messages if invalid
 */
export async function validatePdfFile(file: File): Promise<PdfValidationResult> {
  const warnings: string[] = []
  const sizeMB = file.size / (1024 * 1024)
  const metadata = { sizeBytes: file.size, sizeMB }

  // Check if file is a PDF
  if (!isPdfFile(file)) {
    return {
      valid: false,
      error: `File "${file.name}" is not a PDF. Expected application/pdf or .pdf extension.`,
      metadata,
    }
  }

  // Check file size (50MB per file limit per OpenAI docs)
  if (file.size > PDF_REQUIREMENTS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `PDF "${file.name}" (${sizeMB.toFixed(1)}MB) exceeds the 50MB file size limit.`,
      metadata,
    }
  }

  // Check for PDF signature to verify it's a valid PDF
  try {
    const header = await readFileHeader(file, 8)
    const signature = new Uint8Array(header.slice(0, 5))

    let signatureMatch = true
    for (let i = 0; i < PDF_SIGNATURE.length; i++) {
      if (signature[i] !== PDF_SIGNATURE[i]) {
        signatureMatch = false
        break
      }
    }

    if (!signatureMatch) {
      return {
        valid: false,
        error: `File "${file.name}" does not appear to be a valid PDF. The file header is incorrect.`,
        metadata,
      }
    }
  } catch {
    // If we can't read the header, continue with basic validation
    warnings.push('Could not verify PDF header. File may be invalid or corrupted.')
  }

  // Add warning for large files that might be close to the total limit
  if (sizeMB > 40) {
    warnings.push(
      `PDF is ${sizeMB.toFixed(1)}MB. The total content across all files must be under 50MB.`
    )
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    metadata,
  }
}

/**
 * Reads the first N bytes of a file
 */
async function readFileHeader(file: File, bytes: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const slice = file.slice(0, bytes)
    
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(slice)
  })
}

// ============================================================================
// URL Detection
// ============================================================================

/**
 * Checks if a URL points to a PDF document
 * 
 * @param url - The URL to check
 * @returns True if the URL appears to be a PDF
 */
export function isPdfUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()
    
    // Check file extension
    if (pathname.endsWith('.pdf')) {
      return true
    }
    
    // Check common query parameter patterns
    const searchParams = urlObj.searchParams
    const format = searchParams.get('format') || searchParams.get('type')
    if (format?.toLowerCase() === 'pdf') {
      return true
    }
    
    return false
  } catch {
    return false
  }
}

// ============================================================================
// Document Block Creation
// ============================================================================

// PDF document block creation uses standard OpenAI-compatible image/text inputs.
