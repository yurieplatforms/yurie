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
  PDF_REQUIREMENTS,
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
 *
 * Implements OpenAI best practices for file inputs:
 * @see https://platform.openai.com/docs/guides/pdf-files
 *
 * PDF Processing:
 * - Creates base64-encoded data in format: data:application/pdf;base64,{base64string}
 * - Validates file size (max 50MB per file)
 * - Total content across all files must be under 50MB
 *
 * Content ordering (per OpenAI best practices):
 * 1. Images (input_image)
 * 2. Documents/PDFs (input_file)
 * 3. Text content (input_text)
 */
export function useFileProcessor(): UseFileProcessorReturn {
  /**
   * Validate all files before processing
   *
   * Per OpenAI docs:
   * - Max 50MB per file
   * - Max 50MB total across all files in a single request
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

      // Validate total file size across all files (50MB limit per OpenAI docs)
      const totalFileSize = files.reduce((sum, file) => sum + file.size, 0)
      if (totalFileSize > PDF_REQUIREMENTS.MAX_TOTAL_SIZE) {
        const totalMB = (totalFileSize / (1024 * 1024)).toFixed(1)
        return {
          valid: false,
          error: `Total file size (${totalMB}MB) exceeds the 50MB limit. Please reduce the number or size of files.`,
        }
      }

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

      // Build text segment (no attachment summary needed - previews are shown in UI)
      const textSegment: TextContentSegment = {
        type: 'text',
        text: trimmed,
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
      // Per OpenAI docs: PDFs are converted to input_file with base64 data
      // Format: data:application/pdf;base64,{base64string}
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
                // readFileAsDataURL produces: data:{mime};base64,{data}
                // This matches OpenAI's expected format for input_file.file_data
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
      // OpenAI best practice: Files should come before text in the content array
      // Order: 1. Images (input_image), 2. Documents/PDFs (input_file), 3. Text (input_text)
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

