import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
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
