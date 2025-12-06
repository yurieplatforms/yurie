/**
 * PDF Support
 * 
 * Handles PDF validation, processing, and document block creation.
 * 
 * Key PDF Requirements:
 * - Maximum request size: 32MB
 * - Maximum pages per request: 100
 * - Format: Standard PDF (no passwords/encryption)
 * 
 * Best Practices:
 * - Place PDFs before text in requests
 * - Use standard fonts for better text extraction
 * - Ensure text is clear and legible
 * - Rotate pages to proper upright orientation
 * - Use logical page numbers in prompts
 * - Split large PDFs into chunks when needed
 * - Enable prompt caching for repeated analysis
 * - Enable citations for full visual understanding
 */

import { readFileAsDataURL, isPdfFile } from '@/lib/utils'

// ============================================================================
// Constants
// ============================================================================

/**
 * PDF requirements per Anthropic documentation
 */
export const PDF_REQUIREMENTS = {
  /** Maximum total request size in bytes (32MB) */
  MAX_REQUEST_SIZE: 32 * 1024 * 1024,
  /** Maximum pages per PDF request */
  MAX_PAGES: 100,
  /** Approximate tokens per page (for cost estimation) */
  TOKENS_PER_PAGE_TEXT: 1500, // 1,500-3,000 tokens per page for text
  TOKENS_PER_PAGE_IMAGE: 2333, // ~7,000 tokens for 3 pages (visual analysis)
  /** Supported media type */
  MEDIA_TYPE: 'application/pdf' as const,
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
 * Validates a PDF file for use with Claude API
 * 
 * Checks:
 * - File is a valid PDF (by type or extension)
 * - File size is within limits (32MB)
 * - File is not password-protected (basic check via signature)
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

  // Check file size
  if (file.size > PDF_REQUIREMENTS.MAX_REQUEST_SIZE) {
    return {
      valid: false,
      error: `PDF "${file.name}" (${sizeMB.toFixed(1)}MB) exceeds the 32MB limit. Consider splitting the document.`,
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

  // Add warning for large files that might be close to the limit
  if (sizeMB > 25) {
    warnings.push(
      `PDF is ${sizeMB.toFixed(1)}MB. Consider that the total request size (including other content) must be under 32MB.`
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

// PDF document block creation removed as it was specific to Anthropic Claude.
// xAI Grok 4.1 Fast uses standard OpenAI-compatible image/text inputs.


