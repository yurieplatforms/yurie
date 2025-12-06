'use client'

import { useCallback } from 'react'
import type {
  FileContentSegment,
  ImageContentSegment,
  TextContentSegment,
  MessageContentSegment,
} from '@/lib/types'
import { readFileAsDataURL, isImageFile, isPdfFile } from '@/lib/utils'
import { 
  isTextFile, 
  resizeImageForVision, 
  validateFile, 
  validatePdfFile,
  validateImageCount,
} from '@/lib/files'

export type FileProcessorResult = {
  textSegment: TextContentSegment
  richContentSegments: MessageContentSegment[] | undefined
  error: string | null
}

export type UseFileProcessorReturn = {
  processFiles: (
    content: string,
    files: File[],
  ) => Promise<FileProcessorResult>
  validateFiles: (files: File[]) => Promise<{ valid: boolean; error?: string }>
}

/**
 * Hook for processing files (images, PDFs, text files) for chat messages
 */
export function useFileProcessor(): UseFileProcessorReturn {
  /**
   * Validate all files before processing
   * 
   * - Validates image count (max 100 per request)
   * - Applies stricter dimension limits when >20 images
   * - Uses specific validation for PDFs
   */
  const validateFiles = useCallback(
    async (files: File[]): Promise<{ valid: boolean; error?: string; totalEstimatedTokens?: number }> => {
      // Count images to apply appropriate validation rules
      const imageFiles = files.filter(isImageFile)
      const imageCount = imageFiles.length
      let totalEstimatedTokens = 0

      // Validate total image count (max 100 per API request)
      if (imageCount > 0) {
        const countValidation = validateImageCount(imageCount)
        if (!countValidation.valid) {
          return { valid: false, error: countValidation.error }
        }
        if (countValidation.warnings) {
          countValidation.warnings.forEach((warning) =>
            console.log(`[vision] ${warning}`),
          )
        }
      }

      for (const file of files) {
        // Use PDF-specific validation for PDF files
        if (isPdfFile(file)) {
          const pdfValidation = await validatePdfFile(file)
          if (!pdfValidation.valid) {
            return { valid: false, error: pdfValidation.error || 'Invalid PDF file' }
          }
          if (pdfValidation.warnings) {
            pdfValidation.warnings.forEach((warning) =>
              console.log(`[pdf] ${warning}`),
            )
          }
        } else {
          // Use general validation with image count for proper dimension limits
          const validation = await validateFile(file, { imageCount })
          if (!validation.valid) {
            return { valid: false, error: validation.error || 'Invalid file' }
          }
          if (validation.warnings) {
            validation.warnings.forEach((warning) =>
              console.log(`[files] ${warning}`),
            )
          }
          // Track estimated tokens for images
          if (validation.estimatedTokens) {
            totalEstimatedTokens += validation.estimatedTokens
          }
        }
      }

      if (totalEstimatedTokens > 0) {
        console.log(`[vision] Estimated image tokens: ~${totalEstimatedTokens}`)
      }

      return { valid: true, totalEstimatedTokens }
    },
    [],
  )

  /**
   * Process files and content into message segments
   */
  const processFiles = useCallback(
    async (content: string, files: File[]): Promise<FileProcessorResult> => {
      const trimmed = content.trim()

      // Validate files first
      const validation = await validateFiles(files)
      if (!validation.valid) {
        return {
          textSegment: { type: 'text', text: '' },
          richContentSegments: undefined,
          error: validation.error || 'Invalid file',
        }
      }

      // Build text segment with attachment summary
      const attachmentSummary =
        files.length > 0
          ? `\n\n[Attached files: ${files.map((file) => file.name).join(', ')}]`
          : ''

      const contentBase =
        trimmed || 'I have attached some files for you to review.'

      const textSegment: TextContentSegment = {
        type: 'text',
        text: `${contentBase}${attachmentSummary}`,
      }

      // Process image files
      const imageFiles = files.filter(isImageFile)
      let imageSegments: ImageContentSegment[] = []

      if (imageFiles.length > 0) {
        try {
          imageSegments = await Promise.all(
            imageFiles.map(async (file) => ({
              type: 'image_url' as const,
              image_url: {
                url: await resizeImageForVision(file),
              },
            })),
          )
        } catch (imageError) {
          console.error(imageError)
          return {
            textSegment,
            richContentSegments: undefined,
            error: 'Unable to process one of the attached images.',
          }
        }
      }

      // Process PDF and text files as document segments
      const pdfFiles = files.filter(isPdfFile)
      const textFiles = files.filter(isTextFile)
      const documentFiles = [...pdfFiles, ...textFiles]

      let fileSegments: FileContentSegment[] = []

      if (documentFiles.length > 0) {
        try {
          fileSegments = await Promise.all(
            documentFiles.map(async (file) => ({
              type: 'file' as const,
              file: {
                filename: file.name,
                file_data: await readFileAsDataURL(file),
              },
            })),
          )
        } catch (fileError) {
          console.error(fileError)
          return {
            textSegment,
            richContentSegments: undefined,
            error: 'Unable to read one of the attached documents.',
          }
        }
      }

      // Combine segments if we have rich content
      // Best practice: Images should come before text in the content array
      // Order: 1. Images, 2. Documents (PDFs/text files), 3. Text content
      const richContentSegments =
        imageSegments.length > 0 || fileSegments.length > 0
          ? [...imageSegments, ...fileSegments, textSegment]
          : undefined

      return {
        textSegment,
        richContentSegments,
        error: null,
      }
    },
    [validateFiles],
  )

  return {
    processFiles,
    validateFiles,
  }
}

