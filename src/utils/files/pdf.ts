/**
 * PDF Support - Best Practices for Claude API
 * 
 * Handles PDF validation, processing, and document block creation following
 * Anthropic's official documentation and recommendations.
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/pdf-support
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

import { readFileAsDataURL, isPdfFile } from '@/utils'

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

export type PdfDocumentBlock = {
  type: 'document'
  source: {
    type: 'base64'
    media_type: 'application/pdf'
    data: string
  }
  title: string
  citations: { enabled: boolean }
  cache_control: { type: 'ephemeral' }
}

export type UrlPdfDocumentBlock = {
  type: 'document'
  source: {
    type: 'url'
    url: string
  }
  title: string
  citations: { enabled: boolean }
  cache_control: { type: 'ephemeral' }
}

/**
 * Creates a document block for a PDF file following Anthropic best practices
 * 
 * Best practices applied:
 * - Citations enabled for full visual understanding
 * - Cache control enabled for repeated analysis
 * 
 * @param file - The PDF file to process
 * @param options - Optional configuration
 * @returns The document block ready for Anthropic API
 */
export async function createPdfDocumentSegment(
  file: File,
  options: {
    title?: string
    enableCitations?: boolean
    enableCaching?: boolean
  } = {}
): Promise<PdfDocumentBlock> {
  const {
    title = file.name,
    enableCitations = true,
    enableCaching = true,
  } = options

  const dataUrl = await readFileAsDataURL(file)
  const base64Data = dataUrl.replace(/^data:application\/pdf;base64,/, '')

  const block: PdfDocumentBlock = {
    type: 'document',
    source: {
      type: 'base64',
      media_type: 'application/pdf',
      data: base64Data,
    },
    title,
    citations: { enabled: enableCitations },
    cache_control: { type: 'ephemeral' },
  }

  // Remove cache_control if caching is disabled
  if (!enableCaching) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (block as any).cache_control
  }

  return block
}

/**
 * Creates a document block for a URL-based PDF following Anthropic best practices
 * 
 * This is the simplest approach for PDFs hosted online.
 * @see https://platform.claude.com/docs/en/build-with-claude/pdf-support#option-1-url-based-pdf-document
 * 
 * @param url - The URL of the PDF document
 * @param options - Optional configuration
 * @returns The document block ready for Anthropic API
 */
export function createUrlPdfDocumentSegment(
  url: string,
  options: {
    title?: string
    enableCitations?: boolean
    enableCaching?: boolean
  } = {}
): UrlPdfDocumentBlock {
  const {
    title = extractFilenameFromUrl(url),
    enableCitations = true,
    enableCaching = true,
  } = options

  const block: UrlPdfDocumentBlock = {
    type: 'document',
    source: {
      type: 'url',
      url,
    },
    title,
    citations: { enabled: enableCitations },
    cache_control: { type: 'ephemeral' },
  }

  // Remove cache_control if caching is disabled
  if (!enableCaching) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (block as any).cache_control
  }

  return block
}

/**
 * Extracts a filename from a URL
 */
function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop()
    if (filename && filename.length > 0) {
      return decodeURIComponent(filename)
    }
  } catch {
    // Invalid URL, fall through
  }
  return 'Document'
}

