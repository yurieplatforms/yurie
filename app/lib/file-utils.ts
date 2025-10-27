/**
 * File processing utilities for images and PDFs
 */

import type { AttachmentPreview } from '@/app/types/chat'

/**
 * Convert file to base64 (raw, no data URL header)
 */
export async function fileToBase64Raw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const result = String(reader.result || '')
        const m = result.match(/^data:[^;]+;base64,(.*)$/)
        resolve(m ? m[1] : '')
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Encode image with resizing for optimal API submission
 */
export async function encodeImageWithResize(
  file: File, 
  maxDimension = 1200, 
  quality = 0.72
): Promise<string> {
  try {
    const imgUrl = URL.createObjectURL(file)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const dataUrl: string = await new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          const { width, height } = img
          const scale = Math.min(1, maxDimension / Math.max(width, height))
          const targetW = Math.max(1, Math.round(width * scale))
          const targetH = Math.max(1, Math.round(height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = targetW
          canvas.height = targetH
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas not supported'))
          ctx.drawImage(img, 0, 0, targetW, targetH)
          const out = canvas.toDataURL('image/jpeg', quality)
          resolve(out)
        } catch (e) {
          reject(e)
        }
      }
      img.onerror = reject
      img.src = imgUrl
    })
    URL.revokeObjectURL(imgUrl)
    return dataUrl
  } catch {
    // Fallback to direct FileReader if canvas processing fails
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
}

/**
 * Create attachment preview objects from files
 */
export function createAttachmentPreviews(files: File[]): AttachmentPreview[] {
  return files.map((f) => {
    const url = URL.createObjectURL(f)
    const mime = (f.type || '').toLowerCase()
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    const imageExts = ['png','jpg','jpeg','gif','webp','bmp','svg','heic','heif','tif','tiff','avif']
    const isImage = mime.startsWith('image/') || imageExts.includes(ext)
    return {
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      size: f.size,
      mime: f.type,
      objectUrl: url,
      isImage,
    }
  })
}

/**
 * Process files for API submission (images with resize, PDFs as raw base64)
 */
export async function processFilesForApi(files: File[]): Promise<{
  imageDataUrls: string[]
  pdfBase64s: string[]
  pdfFilenames: string[]
}> {
  const imageFiles = files.filter((f) => f.type.startsWith('image/'))
  const pdfFiles = files.filter((f) => 
    (f.type === 'application/pdf') || (f.name || '').toLowerCase().endsWith('.pdf')
  )

  let imageDataUrls: string[] = []
  let pdfBase64s: string[] = []
  let pdfFilenames: string[] = []
  
  try {
    // Encode PDFs (raw base64, no data URL header)
    if (pdfFiles.length > 0) {
      try {
        pdfBase64s = await Promise.all(pdfFiles.map((f) => fileToBase64Raw(f)))
        pdfFilenames = pdfFiles.map((f) => f.name)
      } catch (e) {
        console.error('PDF encoding failed:', e)
        throw new Error('Failed to process PDFs. Please try again.')
      }
    }
    if (imageFiles.length > 0) {
      imageDataUrls = await Promise.all(imageFiles.map((f) => encodeImageWithResize(f)))
    }
  } catch (encodeError) {
    console.error('File encoding failed:', encodeError)
    throw new Error('Failed to process files. Please try again.')
  }

  return { imageDataUrls, pdfBase64s, pdfFilenames }
}

