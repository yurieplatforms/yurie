import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Reads a file and returns its content as a data URL
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Checks if a file is an image based on its mime type
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Checks if a file is a PDF based on its mime type
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf'
}
