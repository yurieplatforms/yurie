'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getChat, saveChat, createChat } from '@/lib/chat/history'
import { useAuth } from '@/components/providers/auth-provider'
import type { ChatMessage } from '@/lib/types'

export type UseChatOptions = {
  chatId?: string
}

export type UseChatReturn = {
  id: string | undefined
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  containerId: string | undefined
  abortControllerRef: React.MutableRefObject<AbortController | null>
  setId: (id: string | undefined) => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setContainerId: (id: string | undefined) => void
  initializeChat: (initialMessages: ChatMessage[]) => Promise<string>
  updateChat: (chatId: string, messages: ChatMessage[], newContainerId?: string) => Promise<void>
  generateTitle: (chatId: string, userMessage: ChatMessage) => void
}

/**
 * Hook for managing chat state and persistence
 */
export function useChat({ chatId }: UseChatOptions = {}): UseChatReturn {
  const router = useRouter()
  const { user } = useAuth()

  const [id, setId] = useState<string | undefined>(chatId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [containerId, setContainerId] = useState<string | undefined>(undefined)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Load chat when chatId changes
  useEffect(() => {
    async function loadChat() {
      if (chatId) {
        const chat = await getChat(chatId, user?.id)
        if (chat) {
          setId(chatId)
          setMessages(chat.messages)
          setContainerId(chat.containerId)
        }
      } else {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
          abortControllerRef.current = null
        }
        setId(undefined)
        setMessages([])
        setContainerId(undefined)
      }
    }
    loadChat()
  }, [chatId, user])

  /**
   * Initialize a new chat with messages
   */
  const initializeChat = useCallback(async (initialMessages: ChatMessage[]): Promise<string> => {
    const newChat = createChat(initialMessages)
    const newId = newChat.id
    setId(newId)
    await saveChat(newChat, user?.id)
    router.replace(`/?id=${newId}`)
    return newId
  }, [router, user?.id])

  /**
   * Update an existing chat with new messages
   */
  const updateChat = useCallback(async (
    chatId: string,
    newMessages: ChatMessage[],
    newContainerId?: string,
  ) => {
    const chat = await getChat(chatId, user?.id)
    if (chat) {
      chat.messages = newMessages
      chat.updatedAt = Date.now()
      if (newContainerId) {
        chat.containerId = newContainerId
      }
      await saveChat(chat, user?.id)
    }
  }, [user?.id])

  /**
   * Generate a title for the chat asynchronously
   */
  const generateTitle = useCallback((chatId: string, userMessage: ChatMessage) => {
    void fetch('/api/agent/title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [userMessage] }),
    })
      .then((res) => res.json())
      .then(async (data) => {
        if (data.title) {
          const latestChat = await getChat(chatId, user?.id)
          if (latestChat) {
            latestChat.title = data.title
            await saveChat(latestChat, user?.id)
          }
        }
      })
      .catch((err) => console.error('Failed to generate title', err))
  }, [user?.id])

  return {
    id,
    messages,
    isLoading,
    error,
    containerId,
    abortControllerRef,
    setId,
    setMessages,
    setIsLoading,
    setError,
    setContainerId,
    initializeChat,
    updateChat,
    generateTitle,
  }
}

