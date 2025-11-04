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
  hasVisibleAssistantContent
} from '@/app/lib/chat-utils'
import { useChatStream } from '@/app/hooks/useChatStream'
import { upsertFromMessagesAsync, getConversationAsync } from '@/app/lib/history'
import type { SearchTab } from '@/app/types/search'

export default function ChatClient() {
  const outputRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [outputHeight, setOutputHeight] = useState<number>(0)
  const pinnedToBottomRef = useRef<boolean>(true)

  const { state, sendMessage, newChat, replaceMessages, changeTab } = useChatStream()
  const {
    messages,
    status,
    reasoningByMessageIndex,
    reasoningDurationByMessageIndex,
    finalStartedByMessageIndex,
    usingSearchByMessageIndex,
    activeTabByMessageIndex,
    searchDataByMessageIndex,
    isFetchingSearch,
    animateTabsByMessageIndex,
  } = state

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
    sendMessage(message, options)
  }, [sendMessage])

  const currentConvIdRef = useRef<string | null>(null)
  const suppressNextSaveRef = useRef<boolean>(false)

  // Restore last conversation on mount
  useEffect(() => {
    (async () => {
      try {
        const lastId = sessionStorage.getItem('chat:currentId')
        if (lastId) {
          const convo = await getConversationAsync(lastId)
          if (convo && Array.isArray(convo.messages) && convo.messages.length > 0) {
            currentConvIdRef.current = convo.id
            suppressNextSaveRef.current = true
            replaceMessages(convo.messages)
          }
        }
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save conversation snapshot whenever messages change
  useEffect(() => {
    if (!messages || messages.length === 0) return
    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false
      return
    }
    ;(async () => {
      try {
        const { id } = await upsertFromMessagesAsync(messages, currentConvIdRef.current || undefined)
        if (id) {
          currentConvIdRef.current = id
          sessionStorage.setItem('chat:currentId', id)
        }
      } catch {}
    })()
  }, [messages])

  // Listen for sidebar events to load or start chats
  useEffect(() => {
    const onLoad = (e: Event) => {
      const ce = e as CustomEvent<{ id: string }>
      const id = ce?.detail?.id
      if (!id) return
      ;(async () => {
        const convo = await getConversationAsync(id)
        if (!convo) return
        currentConvIdRef.current = id
        sessionStorage.setItem('chat:currentId', id)
        suppressNextSaveRef.current = true
        replaceMessages(convo.messages || [])
      })()
    }
    const onNew = () => {
      try { sessionStorage.removeItem('chat:currentId') } catch {}
      currentConvIdRef.current = null
      newChat()
    }
    window.addEventListener('chat:load' as any, onLoad as any)
    window.addEventListener('chat:new' as any, onNew as any)
    return () => {
      window.removeEventListener('chat:load' as any, onLoad as any)
      window.removeEventListener('chat:new' as any, onNew as any)
    }
  }, [newChat, replaceMessages])

  const handleNewChat = useCallback(() => { 
    try { sessionStorage.removeItem('chat:currentId') } catch {}
    currentConvIdRef.current = null
    newChat()
    try { window.dispatchEvent(new CustomEvent('chat:new')) } catch {}
  }, [newChat])

  // Fetch search results on-demand when user switches to a search tab
  const handleTabChange = useCallback(async (msgIndex: number, tab: SearchTab, rawQuery: string) => {
    await changeTab(msgIndex, tab, rawQuery)
  }, [changeTab])

  return (
    <section ref={containerRef} className={cn('w-full h-full min-h-screen flex flex-col', messages.length === 0 && 'justify-center items-center max-w-[52rem] mx-auto')}>
      <div
        ref={outputRef}
        className={cn(
          // full-width scroll area; hide accidental horizontal overflow from full-width sections
          'rounded-none pt-1 pb-3 overflow-y-auto overflow-x-hidden text-base font-sans w-full',
          messages.length === 0 && 'hidden'
        )}
        style={{ height: outputHeight ? `${outputHeight}px` : undefined }}
      >
        {messages.length === 0 ? null : (
          <div className="w-full max-w-[52rem] mx-auto px-2 sm:px-4">
          {messages.map((m, i) => {
            const isFirst = i === 0
            const speakerChanged = !isFirst && messages[i - 1].role !== m.role
            const topMarginClass = isFirst ? 'mt-1' : speakerChanged ? 'mt-2' : 'mt-0.5'
            const reasoningText = reasoningByMessageIndex[i] || ''
            const hasReasoning = m.role === 'assistant' && reasoningText.trim().length > 0
            const isLastAssistant = i === messages.length - 1 && m.role === 'assistant'
            const hasVisible = hasVisibleAssistantContent(m.content || '')
            const finalStarted = finalStartedByMessageIndex[i] === true
            const showInlineShimmer = (
              status === 'streaming' && isLastAssistant && !hasVisible && !hasReasoning
            )
            
            // Check if this is a user message followed by an assistant message
            const isUserWithAssistantResponse = m.role === 'user' && i + 1 < messages.length && messages[i + 1]?.role === 'assistant'
            const activeTab = activeTabByMessageIndex[i] || 'Yurie'
            const searchData = searchDataByMessageIndex[i]
            
            // If this is an assistant message, check if the previous user message has tabs
            const previousUserIndex = m.role === 'assistant' && i > 0 && messages[i - 1]?.role === 'user' ? i - 1 : -1
            const previousUserHasTabs = previousUserIndex >= 0
            const previousUserActiveTab = previousUserIndex >= 0 ? (activeTabByMessageIndex[previousUserIndex] || 'Yurie') : 'Yurie'
            
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
                        disableYurieAnimation={i === 0}
                        animateOnChange={animateTabsByMessageIndex[i] === true}
                        onTabChange={(tab) => handleTabChange(i, tab, m.content)}
                      />
                    </div>
                    {activeTab !== 'Yurie' && (
                      <div className={cn(
                        'mb-2',
                        activeTab === 'All' ? 'mt-[52px]' : 'mt-8'
                      )}>
                        {isFetchingSearch && i === messages.length - 2 && (
                          <div className="text-sm text-neutral-500">Loading {activeTab.toLowerCase()}...</div>
                        )}
                        <SearchResults 
                          key={`${i}-${activeTab}-${searchData?.query || ''}`}
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
                  <div className={cn('min-w-0 w-full', previousUserActiveTab === 'Yurie' && 'mt-6')}>
                    {hasReasoning && (!previousUserHasTabs || previousUserActiveTab === 'Yurie') && (
                      <div className="mt-3 sm:mt-4 mb-2">
                        <Reasoning 
                          className="w-full" 
                          isStreaming={status === 'streaming' && i === messages.length - 1 && !finalStarted}
                          usingSearch={usingSearchByMessageIndex[i] === true}
                          duration={reasoningDurationByMessageIndex[i]}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{formatThinkingForMarkdown(reasoningText)}</ReasoningContent>
                        </Reasoning>
                      </div>
                    )}
                    {(!previousUserHasTabs || previousUserActiveTab === 'Yurie') && (
                      <div className={cn('relative min-w-0 w-full', showInlineShimmer && !hasReasoning && 'mt-4')}>
                        {showInlineShimmer && (
                          <div className="absolute inset-0 flex items-center pointer-events-none">
                            <div className="inline-flex items-center gap-2 rounded-full h-9 px-4 text-sm sm:text-[15px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 shadow-sm bg-neutral-100 text-neutral-900 dark:bg-neutral-800/70 dark:text-neutral-100">
                              <TextShimmer
                                duration={1.2}
                                className="text-sm sm:text-[15px] leading-none font-medium [--base-color:#737373] [--base-gradient-color:#e5e5e5] dark:[--base-color:#a3a3a3] dark:[--base-gradient-color:#f5f5f5]"
                              >
                                Thinking
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
        className={cn('w-full px-2 sm:px-4', messages.length === 0 ? 'max-w-[52rem] -mt-52 sm:-mt-56 md:-mt-52 lg:-mt-48 xl:-mt-44' : 'mt-2 mb-[calc(env(safe-area-inset-bottom)+12px)] sm:mb-4')}
        aria-busy={status === 'submitted' || status === 'streaming'}
      >
        <AIChatInput
          isLoading={status === 'streaming' || status === 'submitted'}
          className="max-w-[52rem] mx-auto"
          isEmptyLayout={messages.length === 0}
          onSend={(text) => {
            handleSendMessage(text)
          }}
          onNewChat={handleNewChat}
        />
      </div>
    </section>
  )
}