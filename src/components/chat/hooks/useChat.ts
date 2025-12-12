'use client'

/**
 * useChat Hook
 *
 * Manages chat state and persistence for the AI chat interface.
 * Handles both authenticated (Supabase) and guest (localStorage) storage.
 *
 * @module hooks/useChat
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { getChat, saveChat, createChat } from '@/lib/chat/history'
import { useAuth } from '@/lib/providers/auth-provider'
import type { ChatMessage } from '@/lib/types'

/**
 * Options for the useChat hook
 */
export type UseChatOptions = {
  /** Optional chat ID to load an existing chat */
  chatId?: string
}

/**
 * Return type for the useChat hook
 */
export type UseChatReturn = {
  /** Current chat ID */
  id: string | undefined
  /** Array of chat messages */
  messages: ChatMessage[]
  /** Whether a message is being processed */
  isLoading: boolean
  /** Current error message, if any */
  error: string | null
  /** Container ID for code execution persistence */
  containerId: string | undefined
  /** Ref to the abort controller for canceling requests */
  abortControllerRef: React.MutableRefObject<AbortController | null>
  /** Set the current chat ID */
  setId: (id: string | undefined) => void
  /** Set the messages array */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  /** Set the loading state */
  setIsLoading: (loading: boolean) => void
  /** Set the error message */
  setError: (error: string | null) => void
  /** Set the container ID */
  setContainerId: (id: string | undefined) => void
  /** Initialize a new chat with messages */
  initializeChat: (initialMessages: ChatMessage[]) => Promise<string>
  /** Update an existing chat with new messages */
  updateChat: (chatId: string, messages: ChatMessage[], newContainerId?: string) => Promise<void>
  /** Generate a title for the chat asynchronously */
  generateTitle: (chatId: string, userMessage: ChatMessage) => void
}

/**
 * Hook for managing chat state and persistence
 *
 * @param options - Configuration options including optional chatId
 * @returns Chat state and management functions
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, isLoading } = useChat({ chatId: 'abc123' })
 * ```
 */
export function useChat({ chatId }: UseChatOptions = {}): UseChatReturn {
  const { user } = useAuth()

  const [id, setId] = useState<string | undefined>(chatId)
  const idRef = useRef<string | undefined>(chatId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const messagesRef = useRef<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [containerId, setContainerId] = useState<string | undefined>(undefined)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Keep a ref to the latest chat id without re-triggering effects
  useEffect(() => {
    idRef.current = id
  }, [id])

  // Keep a ref to the latest messages without re-triggering effects
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

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
        // If we're already showing this chat (e.g. URL updated after creating it),
        // avoid an unnecessary round-trip to storage/Supabase.
        if (chatId === idRef.current && messagesRef.current.length > 0) {
          return
        }

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
    return newId
  }, [user?.id])

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

