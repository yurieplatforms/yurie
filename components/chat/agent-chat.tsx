'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useChat } from '@/hooks/useChat'
import {
  useStreamResponse,
  buildMessageFromStreamState,
  type StreamState,
} from '@/hooks/useStreamResponse'
import { useFileProcessor } from '@/hooks/useFileProcessor'
import { parseSuggestions } from '@/lib/chat/suggestion-parser'
import type { ChatMessage, WebSearchUserLocation } from '@/lib/types'

// Extracted subcomponents
import { MessageList } from './message-list'
import { WelcomeScreen } from './welcome-screen'
import { ChatInputArea } from './chat-input-area'

export function AgentChat({ chatId }: { chatId?: string }) {
  const { user } = useAuth()
  const [hasJustCopied, setHasJustCopied] = useState(false)

  // Use custom hooks for chat state and stream processing
  const {
    id,
    messages,
    isLoading,
    error,
    containerId,
    abortControllerRef,
    setMessages,
    setIsLoading,
    setError,
    setContainerId,
    initializeChat,
    updateChat,
    generateTitle,
  } = useChat({ chatId })

  const { processStream, thinkingStartRef } = useStreamResponse()
  const { processFiles } = useFileProcessor()

  const sendMessage = useCallback(
    async (rawContent: string, filesToSend: File[] = []) => {
      const content = rawContent
      const useWebSearch = true

      const trimmed = content.trim()
      if ((trimmed.length === 0 && filesToSend.length === 0) || isLoading) {
        return
      }

      setError(null)

      // Process files using the hook
      const { textSegment, richContentSegments, error: fileError } =
        await processFiles(content, filesToSend)

      if (fileError) {
        setError(fileError)
        return
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: textSegment.text,
        richContent: richContentSegments,
        name:
          user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? 'User',
      }

      const assistantMessageId = crypto.randomUUID()

      // Start timing the assistant's "thinking" phase
      thinkingStartRef.current = Date.now()

      const assistantPlaceholder: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        name: 'Yurie',
      }

      const nextMessages = [...messages, userMessage, assistantPlaceholder]
      setMessages(nextMessages)
      setIsLoading(true)

      // Initialize chat if needed
      let currentId = id
      if (!currentId) {
        currentId = await initializeChat(nextMessages)
        generateTitle(currentId, userMessage)
      } else {
        await updateChat(currentId, nextMessages)
      }

      abortControllerRef.current = new AbortController()

      const now = new Date()
      const time = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
      const date = now.toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

      // Build user location for localized web search results
      const userLocation: WebSearchUserLocation = {
        type: 'approximate',
        timezone: timeZone,
      }

      const timezoneCountryMap: Record<string, string> = {
        America: 'US',
        US: 'US',
        Canada: 'CA',
        Europe: 'EU',
        Asia: 'APAC',
        Australia: 'AU',
        Pacific: 'APAC',
      }
      const timezoneParts = timeZone.split('/')
      if (timezoneParts.length >= 1) {
        const region = timezoneParts[0]
        if (timezoneCountryMap[region]) {
          userLocation.country = timezoneCountryMap[region]
        }
        if (timezoneParts.length >= 2) {
          userLocation.region = timezoneParts[1].replace(/_/g, ' ')
        }
      }

      let finalStreamState: StreamState | null = null

      try {
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            messages: nextMessages.map(({ role, content, richContent }) => ({
              role,
              content: richContent ?? content,
            })),
            useWebSearch,
            userContext: { time, date, timeZone },
            containerId,
            userLocation,
          }),
        })

        if (!response.ok || !response.body) {
          let message = 'Something went wrong talking to the agent.'
          try {
            const data = (await response.json()) as { error?: string }
            message = data.error ?? message
          } catch {
            // ignore
          }
          setError(message)
          return
        }

        // Process the stream using the hook
        finalStreamState = await processStream(response, {
          onUpdate: (state) => {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== assistantMessageId) return msg

                const { content, suggestions } = parseSuggestions(state.content)

                return {
                  ...msg,
                  content,
                  suggestions,
                  reasoning:
                    state.reasoning.length > 0 ? state.reasoning : msg.reasoning,
                  richContent:
                    state.images.length > 0 ? [...state.images] : msg.richContent,
                  thinkingDurationSeconds:
                    state.thinkingTime ?? msg.thinkingDurationSeconds,
                  toolUses:
                    state.toolUses.length > 0
                      ? [...state.toolUses]
                      : msg.toolUses,
                  citations:
                    state.citations.length > 0
                      ? [...state.citations]
                      : msg.citations,
                }
              }),
            )
          },
          onContainerId: (newContainerId) => {
            setContainerId(newContainerId)
          },
        })
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return
        }
        console.error(err)
        setError('Network error while contacting the agent.')
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null

        // Final save
        if (currentId && finalStreamState) {
          const finalMessages = nextMessages.map((msg) => {
            if (msg.id === assistantMessageId) {
              return buildMessageFromStreamState(msg, finalStreamState!)
            }
            return msg
          })

          await updateChat(currentId, finalMessages, finalStreamState.containerId)
        }
      }
    },
    [
      isLoading,
      messages,
      id,
      containerId,
      user,
      setError,
      setMessages,
      setIsLoading,
      setContainerId,
      initializeChat,
      updateChat,
      generateTitle,
      abortControllerRef,
      thinkingStartRef,
      processStream,
      processFiles,
    ],
  )

  const handleSuggestionClick = (suggestion: string) => {
    void sendMessage(suggestion)
  }

  const handleCopyMessage = (content: string) => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setHasJustCopied(true)
        setTimeout(() => setHasJustCopied(false), 2000)
      })
      .catch(() => {
        // ignore clipboard errors
      })
  }

  return (
    <div className="relative h-full">
      <div className={`flex h-full flex-col gap-4 ${messages.length > 0 ? 'pb-24' : 'pb-4'}`}>
        <div className="space-y-3">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            hasJustCopied={hasJustCopied}
            onCopyMessage={handleCopyMessage}
            onSuggestionClick={handleSuggestionClick}
          />

          {!isLoading && messages.length === 0 && (
            <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
          )}
        </div>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>

      <ChatInputArea isLoading={isLoading} onSend={sendMessage} />
    </div>
  )
}

export default AgentChat
