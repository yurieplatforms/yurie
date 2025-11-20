import type { UIMessage } from 'ai'

export type Role = UIMessage['role']

export type TextContentSegment = {
  type: 'text'
  text: string
}

export type ImageContentSegment = {
  type: 'image_url'
  image_url: {
    url: string
  }
}

export type FileContentSegment = {
  type: 'file'
  file: {
    filename: string
    file_data: string
  }
}

export type MessageContentSegment =
  | TextContentSegment
  | ImageContentSegment
  | FileContentSegment

export type ChatMessage = {
  id: string
  role: Role
  content: string
  richContent?: MessageContentSegment[]
  reasoning?: string
  thinkingDurationSeconds?: number
  suggestions?: string[]
}

export type SavedChat = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

