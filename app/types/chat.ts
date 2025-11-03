export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error'

export type MessagePart = 
  | { type: 'text'; value: string }
  | { type: 'image'; src: string; partial?: boolean }
  | { type: 'meta'; key: 'revised_prompt' | 'response_id' | 'summary_text' | 'incomplete'; value: string }
  | { type: 'citation'; url: string; title: string; content: string }