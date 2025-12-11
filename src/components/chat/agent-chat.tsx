'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/providers/auth-provider'
import { useChat } from '@/components/chat/hooks/useChat'
import {
  useStreamResponse,
  buildMessageFromStreamState,
  type StreamState,
} from '@/components/chat/hooks/useStreamResponse'
import { useFileProcessor } from '@/components/chat/hooks/useFileProcessor'
import { 
  useBackgroundTasks,
  buildMessageFromResumedContent,
} from '@/components/chat/hooks/useBackgroundTasks'
import { parseSuggestions } from '@/lib/chat/suggestion-parser'
import type { ChatMessage } from '@/lib/types'

// Extracted subcomponents
import { MessageList } from './message-list'
import { WelcomeScreen } from './welcome-screen'
import { ChatInputArea } from './chat-input-area'

export function AgentChat({ chatId }: { chatId?: string }) {
  const { user } = useAuth()
  const [hasJustCopied, setHasJustCopied] = useState(false)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [researchMode, setResearchMode] = useState(false)
  const hasResumedTaskRef = useRef<string | null>(null)

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
  
  // Background tasks hook for persistent task tracking
  const { 
    getActiveTaskForChat, 
    resumeTask,
    checkActiveTasks,
  } = useBackgroundTasks()

  const sendMessage = useCallback(
    async (rawContent: string, filesToSend: File[] = [], options?: { researchMode?: boolean }) => {
      const content = rawContent
      const isResearchMode = options?.researchMode || false

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
        mode: isResearchMode ? { type: 'research', reason: 'Deep research mode', confidence: 0.5 } : undefined,
        // Initialize research progress for research mode
        researchProgress: isResearchMode ? {
          stage: 'starting',
          sourcesFound: 0,
          sourcesAnalyzed: 0,
          sources: [],
          searchQueries: [],
          startTime: Date.now(),
        } : undefined,
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

      // Both regular chat and research mode use the same flow
      // Research mode enables high reasoning effort on the agent endpoint
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
            userContext: { time, date, timeZone },
            containerId,
            selectedTools,
            // Include chat and message ID for background task persistence
            chatId: currentId,
            messageId: assistantMessageId,
            // Research mode uses high reasoning effort
            researchMode: isResearchMode,
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
            // Handle SSE errors from the stream
            if (state.error) {
              setError(state.error.message)
              return
            }

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
                  thinkingDurationSeconds:
                    state.thinkingTime ?? msg.thinkingDurationSeconds,
                  activeToolUse: state.activeToolUse,
                  toolUseHistory: state.toolUseHistory.length > 0 ? state.toolUseHistory : undefined,
                  // Include mode info for UI feedback
                  mode: state.mode ? {
                    type: state.mode.type,
                    reason: state.mode.reason,
                    confidence: state.mode.confidence,
                  } : msg.mode,
                  // Include research progress for research mode
                  researchProgress: state.researchProgress ?? msg.researchProgress,
                }
              }),
            )
          },
        })

        // Check for errors in final stream state
        if (finalStreamState?.error) {
          setError(finalStreamState.error.message)
          // Update the assistant message to show the error if no content was received
          if (!finalStreamState.content || finalStreamState.content.trim().length === 0) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== assistantMessageId) return msg
                return {
                  ...msg,
                  content: `⚠️ ${finalStreamState!.error!.message}`,
                  isError: true,
                }
              }),
            )
          }
        }
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

          await updateChat(currentId, finalMessages)
        }
      }
    },
    [
      isLoading,
      messages,
      id,
      containerId,
      user,
      selectedTools,
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

  // Check for and resume background tasks when chat loads
  useEffect(() => {
    async function resumeBackgroundTask() {
      if (!id || !user) return
      
      // Check if we already resumed this task
      if (hasResumedTaskRef.current === id) return
      
      // Refresh active tasks
      await checkActiveTasks()
      
      // Check if there's an active task for this chat
      const activeTask = getActiveTaskForChat(id)
      if (!activeTask) return
      
      // Mark that we're resuming this task
      hasResumedTaskRef.current = id
      
      const { task } = activeTask
      console.log(`[AgentChat] Resuming background task for chat ${id}`)
      
      // Set loading state
      setIsLoading(true)
      
      // Resume the task
      await resumeTask(
        task,
        // onUpdate - called with content updates
        (content, status) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== task.messageId) return msg
              
              const { content: parsedContent, suggestions } = parseSuggestions(content)
              
              return {
                ...msg,
                content: parsedContent,
                suggestions,
                mode: {
                  type: 'agent' as const,
                  reason: status === 'in_progress' ? 'Resuming background task...' : 'Background task running',
                  confidence: 0.8,
                },
              }
            }),
          )
        },
        // onComplete - called when task completes
        async (finalContent) => {
          setIsLoading(false)
          
          // Update message with final content
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) => {
              if (msg.id !== task.messageId) return msg
              return buildMessageFromResumedContent(msg, finalContent)
            })
            
            // Save to database
            updateChat(id, updatedMessages)
            
            return updatedMessages
          })
          
          console.log(`[AgentChat] Background task completed for chat ${id}`)
        },
        // onError - called on error
        (errorMessage) => {
          setIsLoading(false)
          setError(errorMessage)
          console.error(`[AgentChat] Background task error for chat ${id}:`, errorMessage)
        }
      )
    }
    
    resumeBackgroundTask()
  }, [id, user, checkActiveTasks, getActiveTaskForChat, resumeTask, setMessages, setIsLoading, setError, updateChat])

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

  const hasMessages = messages.length > 0

  // Enable scrolling when messages exist (overrides CSS overflow:hidden for home page)
  useEffect(() => {
    if (hasMessages) {
      document.documentElement.style.overflow = 'auto'
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [hasMessages])

  // Home page: clean, centered input only (no scrolling)
  if (!hasMessages) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-start justify-center pt-[30vh]">
        <div className="w-full">
          <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
          {error && (
            <p className="mb-4 text-xs text-red-500 dark:text-red-400">{error}</p>
          )}
          <ChatInputArea 
            isLoading={isLoading} 
            onSend={sendMessage} 
            variant="inline" 
            selectedTools={selectedTools} 
            onSelectedToolsChange={setSelectedTools}
            researchMode={researchMode}
            onResearchModeChange={setResearchMode}
          />
        </div>
      </div>
    )
  }

  // Chat page: messages with fixed bottom input
  return (
    <div className="relative">
      <div className="flex flex-col gap-4 pb-36">
        <div className="space-y-6">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            hasJustCopied={hasJustCopied}
            onCopyMessage={handleCopyMessage}
            onSuggestionClick={handleSuggestionClick}
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>

      <ChatInputArea 
        isLoading={isLoading} 
        onSend={sendMessage} 
        selectedTools={selectedTools} 
        onSelectedToolsChange={setSelectedTools}
        researchMode={researchMode}
        onResearchModeChange={setResearchMode}
      />
    </div>
  )
}

export default AgentChat
