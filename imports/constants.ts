export const API_KEY_REF = 'process.env.OPENROUTER_API_KEY'

export const PDFParserEngine = {
  MistralOCR: 'mistral-ocr',
  PDFText: 'pdf-text',
  Native: 'native',
} as const

export type PDFParserEngineKey = keyof typeof PDFParserEngine

export const DEFAULT_PDF_ENGINE: (typeof PDFParserEngine)[PDFParserEngineKey] =
  PDFParserEngine.PDFText

export const MISTRAL_OCR_USER_COST_PER_1K_PAGE = '0.65 USD'

