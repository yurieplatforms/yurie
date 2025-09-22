export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AttachmentPreview = {
  id: string
  name: string
  size: number
  mime: string
  objectUrl: string
  isImage: boolean
}

export type PromptInputContextValue = {
  isLoading: boolean
  value: string
  setValue: (newValue: string) => void
  maxHeight: number | string
  onSubmit?: () => void
}

export type PromptInputProps = {
  className?: string
  isLoading?: boolean
  maxHeight?: number | string
  value?: string
  onValueChange?: (value: string) => void
  onSubmit?: () => void
  children?: React.ReactNode
}

export type PromptInputTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onKeyDown'
> & {
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  disableAutosize?: boolean
}

export type SourceDisplayParts = {
  href: string
  hostname: string
  domain: string
  path: string
  faviconUrl: string
}

export type ChatInputProps = {
  onSend?: () => void
  onSubmitWithMessage?: (text: string, files: File[]) => void
  onNewChat?: () => void
  isSubmitting?: boolean
  files: File[]
  onFileUpload: (files: File[]) => void
  onFileRemove: (file: File) => void
  stop: () => void
  status?: 'submitted' | 'streaming' | 'ready' | 'error'
  useWebSearch: boolean
  onUseWebSearchToggle: () => void
}

export type ChatRequestPayload = {
  messages: ChatMessage[]
  inputImages?: string[]
  previousResponseId?: string | null
  model?: string
  reasoning?: { effort: 'high' }
  search_parameters?: { mode: 'on' | 'off'; return_citations?: boolean }
}

export type ErrorJSON = { 
  error?: { 
    code?: number
    message?: string 
  } 
}

export type MessagePart =
  | { type: 'text'; value: string }
  | { type: 'image'; src: string; partial?: boolean }
  | { type: 'reasoning'; value: string; partial?: boolean }
  | {
      type: 'meta'
      key: 'revised_prompt' | 'response_id' | 'summary_text' | 'incomplete'
      value: string
    }
  | { type: 'citations'; urls: string[] }
