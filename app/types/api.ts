export type ApiChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type ApiRequestBody = {
  messages: ApiChatMessage[]
  model?: string
  max_output_tokens?: number
  reasoning?: unknown
  useSearch?: boolean
  searchContextSize?: 'low' | 'medium' | 'high'
  inputImages?: string[]
  inputImageUrls?: string[]
  inputPdfBase64?: string[]
  inputPdfFilenames?: string[]
  inputPdfUrls?: string[]
  previousResponseId?: string | null
  pdfEngine?: 'pdf-text' | 'mistral-ocr' | 'native'
}

export type SearchRequest = {
  q?: string
  location?: string
  hl?: string
  gl?: string
  google_domain?: string
  safe?: 'active' | 'off'
  num?: number
  start?: number
  kgmid?: string
}

export type SerpApiCommonParams = {
  engine: string
  q?: string
  search_query?: string
  api_key: string
  location?: string
  hl?: string
  gl?: string
  google_domain?: string
  safe?: string
  num?: number
  start?: number
  sp?: string
  tbm?: string
  kgmid?: string
}

