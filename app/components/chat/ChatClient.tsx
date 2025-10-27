"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/app/components/ui/reasoning'
import { AIChatInput } from '@/app/components/ui/ai-chat-input'
import { cn } from '@/app/lib/utils'
import { TextShimmer } from '@/app/components/ui/text-shimmer'
import { SearchResults } from '@/app/components/ui/search-results'
import { MessageBubble } from './MessageBubble'
import { SearchTabs } from './SearchTabs'
import { 
  formatThinkingForMarkdown,
  hasVisibleAssistantContent,
  shouldEnableSearch,
  stripSearchControls,
  stripImageData,
  extractUrls
} from '@/app/lib/chat-utils'
import { processFilesForApi, createAttachmentPreviews } from '@/app/lib/file-utils'
import { processStreamChunk } from '@/app/lib/stream-utils'
import type { ChatMessage, AttachmentPreview, ChatStatus } from '@/app/types/chat'
import type { SearchTab } from '@/app/types/search'

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const outputRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [outputHeight, setOutputHeight] = useState<number>(0)
  const [lastResponseId, setLastResponseId] = useState<string | null>(null)
  const [reasoningByMessageIndex, setReasoningByMessageIndex] = useState<Record<number, string>>({})
  const [status, setStatus] = useState<ChatStatus>('ready')
  const abortControllerRef = useRef<AbortController | null>(null)
  const [sentAttachmentsByMessageIndex, setSentAttachmentsByMessageIndex] = useState<Record<number, AttachmentPreview[]>>({})
  const createdObjectUrlsRef = useRef<string[]>([])
  const pinnedToBottomRef = useRef<boolean>(true)
  const streamBufferRef = useRef<string>('')

  // Search Integration State
  const [activeTabByMessageIndex, setActiveTabByMessageIndex] = useState<Record<number, SearchTab>>({})
  const [searchDataByMessageIndex, setSearchDataByMessageIndex] = useState<Record<number, any>>({})
  const [isFetchingSearch, setIsFetchingSearch] = useState<boolean>(false)

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      try {
        for (const url of createdObjectUrlsRef.current) URL.revokeObjectURL(url)
      } catch {}
    }
  }, [])

  // Compute output height based on viewport and input size
  useEffect(() => {
    const recompute = () => {
      try {
        const viewportHeight = (window.visualViewport?.height ?? window.innerHeight)
        const containerTop = containerRef.current?.getBoundingClientRect().top ?? 0
        const inputEl = inputWrapperRef.current
        const inputBox = inputEl?.getBoundingClientRect()
        const inputHeight = inputBox?.height ?? 0
        const mt = inputEl ? parseFloat(getComputedStyle(inputEl).marginTop || '0') : 0
        const mb = inputEl ? parseFloat(getComputedStyle(inputEl).marginBottom || '0') : 0
        const available = Math.max(0, viewportHeight - containerTop - inputHeight - mt - mb)
        setOutputHeight(Math.floor(available))
      } catch {}
    }
    recompute()
    const ro = inputWrapperRef.current ? new ResizeObserver(() => {
      requestAnimationFrame(recompute)
    }) : null
    if (ro && inputWrapperRef.current) ro.observe(inputWrapperRef.current)
    
    const childObserver = new MutationObserver(() => {
      requestAnimationFrame(recompute)
    })
    if (inputWrapperRef.current) {
      childObserver.observe(inputWrapperRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      })
    }
    
    window.addEventListener('resize', recompute)
    window.visualViewport?.addEventListener('resize', recompute)
    return () => {
      if (ro) ro.disconnect()
      childObserver.disconnect()
      window.removeEventListener('resize', recompute)
      window.visualViewport?.removeEventListener('resize', recompute)
    }
  }, [])

  // Maintain pinned-to-bottom state
  useEffect(() => {
    const el = outputRef.current
    if (!el) return
    const updatePinned = () => {
      try {
        const threshold = 16
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        pinnedToBottomRef.current = distanceFromBottom <= threshold
      } catch {}
    }
    updatePinned()
    el.addEventListener('scroll', updatePinned, { passive: true })
    return () => {
      el.removeEventListener('scroll', updatePinned as any)
    }
  }, [])

  // Auto-scroll when output resizes and user is pinned
  useEffect(() => {
    if (pinnedToBottomRef.current) {
      queueMicrotask(() => {
        outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
      })
    }
  }, [outputHeight])

  // Auto-scroll when new message is added and user is pinned
  useEffect(() => {
    if (pinnedToBottomRef.current) {
      queueMicrotask(() => {
        outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
      })
    }
  }, [messages.length])

  const handleSendMessage = useCallback((message: string, uploadedFiles?: File[], options?: { reset?: boolean }) => {
    const trimmed = message.trim()
    const filesToProcess = uploadedFiles || []
    const useSearchMode = shouldEnableSearch(trimmed)
    if ((trimmed.length === 0 && filesToProcess.length === 0) || status === 'submitted' || status === 'streaming') return
    
    const reset = options?.reset === true
    if (reset) {
      try { abortControllerRef.current?.abort() } catch {}
      abortControllerRef.current = null
      setReasoningByMessageIndex({})
      setSentAttachmentsByMessageIndex({})
      setSearchDataByMessageIndex({})
      setActiveTabByMessageIndex({})
      setLastResponseId(null)
    }

    const sanitizedUser = stripSearchControls(trimmed)
    const userMsg: ChatMessage = { role: 'user', content: sanitizedUser }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    const baseMessages = reset ? [] : messages
    const nextMessages: ChatMessage[] = [...baseMessages, userMsg, assistantMsg]
    setMessages(nextMessages)
    setStatus('submitted')

    async function processMessage() {
      try {
        // Create attachment previews for display
        const attachmentsForPreview = createAttachmentPreviews(filesToProcess)
        if (attachmentsForPreview.length > 0) {
          attachmentsForPreview.forEach(att => createdObjectUrlsRef.current.push(att.objectUrl))
          const indexForThisMessage = nextMessages.length - 2
          setSentAttachmentsByMessageIndex((prev) => ({ ...prev, [indexForThisMessage]: attachmentsForPreview }))
        }

        // Process files for API submission
        const { imageDataUrls, pdfBase64s, pdfFilenames } = await processFilesForApi(filesToProcess)
        const urlExtraction = extractUrls(sanitizedUser)

        // Use OpenRouter preset
        const selectedModel = '@preset/yurie-ai'
        const payloadMessages = nextMessages.map((m) => ({ ...m, content: stripImageData(m.content) }))
        const ac = new AbortController()
        abortControllerRef.current = ac
        
        // Trigger SerpApi search in parallel if enabled
        const userMessageIndex = nextMessages.length - 2
        const searchPromise: Promise<any | null> = (async () => {
          if (!useSearchMode) return null
          try {
            setIsFetchingSearch(true)
            const usp = new URLSearchParams({ q: sanitizedUser, hl: 'en', gl: 'us', google_domain: 'google.com', safe: 'active', num: '100' })
            const resp = await fetch(`/api/search?${usp.toString()}`, { cache: 'no-store' })
            if (!resp.ok) return null
            return await resp.json()
          } catch {
            return null
          } finally {
            setIsFetchingSearch(false)
          }
        })()

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: payloadMessages,
            inputImages: imageDataUrls,
            inputPdfBase64: pdfBase64s,
            inputPdfFilenames: pdfFilenames,
            inputImageUrls: urlExtraction.images,
            inputPdfUrls: urlExtraction.pdfs,
            previousResponseId: lastResponseId,
            model: selectedModel,
            max_output_tokens: 30000,
            reasoning: {
              effort: 'high',
              exclude: false,
            },
            useSearch: useSearchMode,
            searchContextSize: useSearchMode ? 'high' as const : undefined,
            pdfEngine: 'mistral-ocr',
          }),
          signal: ac.signal,
        })

        if (!res.ok || !res.body) {
          if (res.status === 413) {
            throw new Error('Payload too large for server. Please attach fewer/smaller files.')
          }
          let detail = ''
          try { detail = await res.text() } catch {}
          let msg = `Request failed: ${res.status}`
          try {
            const json = JSON.parse(detail)
            const errObj = json?.error
            if (errObj && typeof errObj === 'object') {
              const code = typeof errObj.code === 'number' || typeof errObj.code === 'string' ? String(errObj.code) : ''
              const message = typeof errObj.message === 'string' ? errObj.message : ''
              msg = `Request failed: ${res.status}${code ? ` (${code})` : ''}${message ? ` - ${message}` : ''}`
            } else if (typeof json?.error === 'string') {
              msg += ` - ${json.error}`
            }
          } catch {
            if (detail) msg += ` - ${detail.slice(0, 200)}`
          }
          throw new Error(msg)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let assistantText = ''

        const assistantIndex = nextMessages.length - 1
        setReasoningByMessageIndex((prev) => ({ ...prev, [assistantIndex]: '' }))
        setStatus('streaming')

        // Initialize default tab for this user message
        setActiveTabByMessageIndex((prev) => ({ ...prev, [userMessageIndex]: 'AI Mode' }))

        // Resolve search results without blocking the AI stream
        searchPromise.then((data) => {
          if (data) {
            setSearchDataByMessageIndex((prev) => ({ ...prev, [userMessageIndex]: data }))
          }
        })

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const cleanChunk = processStreamChunk(
            chunk,
            assistantIndex,
            streamBufferRef,
            setReasoningByMessageIndex,
            setLastResponseId
          )
          assistantText += cleanChunk
          setMessages((prev) => {
            const updated = [...prev]
            const lastIndex = updated.length - 1
            if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
              updated[lastIndex] = { role: 'assistant', content: assistantText }
            } else {
              updated.push({ role: 'assistant', content: assistantText })
            }
            return updated
          })
          queueMicrotask(() => {
            if (pinnedToBottomRef.current) {
              outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
            }
          })
        }

        const finalChunk = decoder.decode()
        if (finalChunk) {
          const cleanFinal = processStreamChunk(
            finalChunk,
            assistantIndex,
            streamBufferRef,
            setReasoningByMessageIndex,
            setLastResponseId
          )
          assistantText += cleanFinal
          setMessages((prev) => {
            const updated = [...prev]
            const lastIndex = updated.length - 1
            if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
              updated[lastIndex] = { role: 'assistant', content: assistantText }
            }
            return updated
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `There was an error: ${message}` },
        ])
        setStatus('error')
      } finally {
        setStatus('ready')
        abortControllerRef.current = null
        streamBufferRef.current = ''
      }
    }
    
    processMessage()
  }, [messages, status, lastResponseId])

  return (
    <section ref={containerRef} className={cn('w-full h-full min-h-screen flex flex-col', messages.length === 0 && 'justify-center max-w-[52rem] mx-auto')}>
      <div
        ref={outputRef}
        className={cn('rounded-none pt-1 pb-3 overflow-y-auto text-base font-sans w-full max-w-[52rem] mx-auto px-2 sm:px-4', messages.length === 0 && 'hidden')}
        style={{ height: outputHeight ? `${outputHeight}px` : undefined }}
      >
        {messages.length === 0 ? null : (
          <div className="w-full">
          {messages.map((m, i) => {
            const isFirst = i === 0
            const speakerChanged = !isFirst && messages[i - 1].role !== m.role
            const topMarginClass = isFirst ? 'mt-1' : speakerChanged ? 'mt-2' : 'mt-0.5'
            const reasoningText = reasoningByMessageIndex[i] || ''
            const hasReasoning = m.role === 'assistant' && reasoningText.trim().length > 0
            const isLastAssistant = i === messages.length - 1 && m.role === 'assistant'
            const hasVisible = hasVisibleAssistantContent(m.content || '')
            const showInlineShimmer = (
              (status === 'submitted' && isLastAssistant) ||
              (status === 'streaming' && isLastAssistant && !hasVisible)
            )
            
            // Check if this is a user message followed by an assistant message
            const isUserWithAssistantResponse = m.role === 'user' && i + 1 < messages.length && messages[i + 1]?.role === 'assistant'
            const activeTab = activeTabByMessageIndex[i] || 'AI Mode'
            const searchData = searchDataByMessageIndex[i]
            
            // If this is an assistant message, check if the previous user message has tabs
            const previousUserIndex = m.role === 'assistant' && i > 0 && messages[i - 1]?.role === 'user' ? i - 1 : -1
            const previousUserHasTabs = previousUserIndex >= 0
            const previousUserActiveTab = previousUserIndex >= 0 ? (activeTabByMessageIndex[previousUserIndex] || 'AI Mode') : 'AI Mode'
            
            return (
              <div key={i} className={`${topMarginClass} mb-0`}>
                {/* User message with tabs container */}
                {isUserWithAssistantResponse && (
                  <>
                    <div className="pt-2 pb-5 border-b border-neutral-300 dark:border-neutral-700 mb-2 mt-2">
                      <div className="mb-3 -mx-2 sm:-mx-4">
                        <MessageBubble 
                          role="user" 
                          content={m.content}
                          attachments={sentAttachmentsByMessageIndex[i]}
                        />
                      </div>
                      <SearchTabs 
                        activeTab={activeTab}
                        onTabChange={(tab) => setActiveTabByMessageIndex((prev) => ({ ...prev, [i]: tab }))}
                      />
                    </div>
                    {activeTab !== 'AI Mode' && (
                      <div className="mt-6 mb-2">
                        {isFetchingSearch && i === messages.length - 2 && (
                          <div className="text-sm text-neutral-500">Loading {activeTab.toLowerCase()}...</div>
                        )}
                        <SearchResults 
                          data={searchData} 
                          section={activeTab as any}
                          onSwitchSection={(sec) => setActiveTabByMessageIndex((prev) => ({ ...prev, [i]: sec }))}
                        />
                      </div>
                    )}
                  </>
                )}
                
                {/* Standalone user message (no assistant response after it) */}
                {m.role === 'user' && !isUserWithAssistantResponse && (
                  <MessageBubble 
                    role="user" 
                    content={m.content}
                    attachments={sentAttachmentsByMessageIndex[i]}
                    isStandalone
                  />
                )}
                
                {/* Assistant message */}
                {m.role === 'assistant' && (
                  <div className={cn('min-w-0 w-full')}>
                    {(!previousUserHasTabs || previousUserActiveTab === 'AI Mode') && hasReasoning && (
                      <div className="mt-3 mb-2">
                        <Reasoning className="w-full" isStreaming={status === 'streaming' && i === messages.length - 1}>
                          <ReasoningTrigger />
                          <ReasoningContent>{formatThinkingForMarkdown(reasoningText)}</ReasoningContent>
                        </Reasoning>
                      </div>
                    )}
                    {(!previousUserHasTabs || previousUserActiveTab === 'AI Mode') && (
                      <div className={cn('relative min-w-0 w-full', showInlineShimmer && !hasReasoning && 'mt-6')}>
                        {showInlineShimmer && (
                          <div className="absolute inset-0 flex items-center pointer-events-none">
                            <TextShimmer
                              duration={1.2}
                              className="text-base leading-snug font-medium [--base-color:#737373] [--base-gradient-color:#e5e5e5] dark:[--base-color:#a3a3a3] dark:[--base-gradient-color:#f5f5f5]"
                            >
                              Thinking...
                            </TextShimmer>
                          </div>
                        )}
                        <div className={cn(showInlineShimmer ? 'opacity-0' : 'opacity-100', 'transition-opacity duration-150 min-h-6')}>
                          <MessageBubble role="assistant" content={m.content} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          </div>
        )}
      </div>
      <div
        ref={inputWrapperRef}
        className={cn('max-w-[52rem] mx-auto w-full px-2 sm:px-4', messages.length === 0 ? '-mt-48 sm:-mt-40 md:-mt-48 lg:-mt-56 xl:-mt-64 mb-0' : 'mt-2 mb-[calc(env(safe-area-inset-bottom)+8px)] sm:mb-4')}
        aria-busy={status === 'submitted' || status === 'streaming'}
      >
        <AIChatInput
          isLoading={status === 'streaming' || status === 'submitted'}
          className="max-w-[52rem] mx-auto"
          onSend={(text, files) => {
            handleSendMessage(text, files)
          }}
        />
      </div>
    </section>
  )
}

