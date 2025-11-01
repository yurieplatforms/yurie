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
import { processStreamChunk } from '@/app/lib/stream-utils'
import type { ChatMessage, ChatStatus } from '@/app/types/chat'
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
  const pinnedToBottomRef = useRef<boolean>(true)
  const streamBufferRef = useRef<string>('')

  // Search Integration State
  const [activeTabByMessageIndex, setActiveTabByMessageIndex] = useState<Record<number, SearchTab>>({})
  const [searchDataByMessageIndex, setSearchDataByMessageIndex] = useState<Record<number, any>>({})
  const [isFetchingSearch, setIsFetchingSearch] = useState<boolean>(false)

  // No attachment object URLs to cleanup

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

  const handleSendMessage = useCallback((message: string, options?: { reset?: boolean }) => {
    const trimmed = message.trim()
    const useSearchMode = shouldEnableSearch(trimmed)
    if (trimmed.length === 0 || status === 'submitted' || status === 'streaming') return
    
    const reset = options?.reset === true
    if (reset) {
      try { abortControllerRef.current?.abort() } catch {}
      abortControllerRef.current = null
      setReasoningByMessageIndex({})
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
          }),
          signal: ac.signal,
        })

        if (!res.ok || !res.body) {
          if (res.status === 413) {
            throw new Error('Payload too large for server.')
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

  const handleNewChat = useCallback(() => {
    try { abortControllerRef.current?.abort() } catch {}
    abortControllerRef.current = null
    setMessages([])
    setReasoningByMessageIndex({})
    setSearchDataByMessageIndex({})
    setActiveTabByMessageIndex({})
    setLastResponseId(null)
    setStatus('ready')
    streamBufferRef.current = ''
  }, [])

  // Fetch search results on-demand when user switches to a search tab
  const handleTabChange = useCallback(async (msgIndex: number, tab: SearchTab, rawQuery: string) => {
    setActiveTabByMessageIndex((prev) => ({ ...prev, [msgIndex]: tab }))
    if (tab === 'AI Mode') return
    // If we already have results for this message, do not refetch
    const alreadyLoaded = Boolean(searchDataByMessageIndex[msgIndex])
    if (alreadyLoaded || isFetchingSearch) return
    const q = stripSearchControls(rawQuery || '')
    if (!q) return
    try {
      setIsFetchingSearch(true)
      const usp = new URLSearchParams({ q, hl: 'en', gl: 'us', google_domain: 'google.com', safe: 'active', num: '100' })
      const resp = await fetch(`/api/search?${usp.toString()}`, { cache: 'no-store' })
      if (!resp.ok) return
      const json = await resp.json()
      setSearchDataByMessageIndex((prev) => ({ ...prev, [msgIndex]: json }))
    } catch {
      // ignore
    } finally {
      setIsFetchingSearch(false)
    }
  }, [searchDataByMessageIndex, isFetchingSearch])

  return (
    <section ref={containerRef} className={cn('w-full h-full min-h-screen flex flex-col', messages.length === 0 && 'justify-center items-center max-w-[52rem] mx-auto')}>
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
              status === 'streaming' && isLastAssistant && !hasVisible && !hasReasoning
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
                    <div className="pt-1 mb-2 mt-2">
                      <div className="mb-3">
                        <MessageBubble 
                          role="user" 
                          content={m.content}
                        />
                      </div>
                      <SearchTabs 
                        activeTab={activeTab}
                        onTabChange={(tab) => handleTabChange(i, tab, m.content)}
                      />
                    </div>
                    {activeTab !== 'AI Mode' && (
                      <div className={cn(
                        'mb-2',
                        activeTab === 'All' ? 'mt-[52px]' : 'mt-8'
                      )}>
                        {isFetchingSearch && i === messages.length - 2 && (
                          <div className="text-sm text-neutral-500">Loading {activeTab.toLowerCase()}...</div>
                        )}
                        <SearchResults 
                          data={searchData} 
                          section={activeTab as any}
                          onSwitchSection={(sec) => handleTabChange(i, sec as SearchTab, m.content)}
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
                  />
                )}
                
                {/* Assistant message */}
                {m.role === 'assistant' && (
                  <div className={cn('min-w-0 w-full', previousUserActiveTab === 'AI Mode' && 'mt-6')}>
                    {(!previousUserHasTabs || previousUserActiveTab === 'AI Mode') && hasReasoning && (
                      <div className="mt-3 sm:mt-4 mb-2">
                        <Reasoning className="w-full" isStreaming={status === 'streaming' && i === messages.length - 1}>
                          <ReasoningTrigger />
                          <ReasoningContent>{formatThinkingForMarkdown(reasoningText)}</ReasoningContent>
                        </Reasoning>
                      </div>
                    )}
                    {(!previousUserHasTabs || previousUserActiveTab === 'AI Mode') && (
                      <div className={cn('relative min-w-0 w-full', showInlineShimmer && !hasReasoning && 'mt-4')}>
                        {showInlineShimmer && (
                          <div className="absolute inset-0 flex items-center pointer-events-none">
                            <div className="inline-flex items-center gap-2 rounded-full border h-9 px-4 text-sm sm:text-[15px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 shadow-sm bg-transparent text-neutral-700 border-neutral-200 dark:text-neutral-300 dark:border-neutral-800">
                              <TextShimmer
                                duration={1.2}
                                className="text-sm sm:text-[15px] leading-none font-medium [--base-color:#737373] [--base-gradient-color:#e5e5e5] dark:[--base-color:#a3a3a3] dark:[--base-gradient-color:#f5f5f5]"
                              >
                                Thinking and searching in parallel
                              </TextShimmer>
                            </div>
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
        className={cn('w-full px-2 sm:px-4', messages.length === 0 ? 'max-w-[52rem] -mt-60 sm:-mt-56 md:-mt-52 lg:-mt-48 xl:-mt-44' : 'max-w-[52rem] mx-auto mt-2 mb-[calc(env(safe-area-inset-bottom)+8px)] sm:mb-4')}
        aria-busy={status === 'submitted' || status === 'streaming'}
      >
        <AIChatInput
          isLoading={status === 'streaming' || status === 'submitted'}
          className="max-w-[52rem] mx-auto"
          onSend={(text) => {
            handleSendMessage(text)
          }}
          onNewChat={handleNewChat}
        />
      </div>
    </section>
  )
}

