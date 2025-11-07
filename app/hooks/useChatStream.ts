"use client"

import { useCallback, useRef, useState } from 'react'
import { processStreamChunk } from '@/app/lib/stream-utils'
import { extractUrls, hasVisibleAssistantContent, shouldEnableSearch, stripImageData, stripSearchControls } from '@/app/lib/chat-utils'
import type { ChatMessage, ChatStatus } from '@/app/types/chat'
import type { SearchTab } from '@/app/types/search'

export type UseChatStreamState = {
  messages: ChatMessage[]
  status: ChatStatus
  lastResponseId: string | null
  reasoningByMessageIndex: Record<number, string>
  reasoningDurationByMessageIndex: Record<number, number>
  finalStartedByMessageIndex: Record<number, boolean>
  usingSearchByMessageIndex: Record<number, boolean>
  // Search integration
  activeTabByMessageIndex: Record<number, SearchTab>
  searchDataByMessageIndex: Record<number, any>
  isFetchingSearch: boolean
  animateTabsByMessageIndex: Record<number, boolean>
}

export type UseChatStreamApi = {
  state: UseChatStreamState
  sendMessage: (text: string, options?: { reset?: boolean }) => void
  newChat: () => void
  replaceMessages: (messages: ChatMessage[]) => void
  changeTab: (msgIndex: number, tab: SearchTab, rawQuery: string) => Promise<void>
}

/**
 * Encapsulates chat streaming, reasoning tracking, and optional web search integration.
 */
export function useChatStream(): UseChatStreamApi {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('ready')
  const [lastResponseId, setLastResponseId] = useState<string | null>(null)
  const [reasoningByMessageIndex, setReasoningByMessageIndex] = useState<Record<number, string>>({})
  const [reasoningDurationByMessageIndex, setReasoningDurationByMessageIndex] = useState<Record<number, number>>({})
  const [finalStartedByMessageIndex, setFinalStartedByMessageIndex] = useState<Record<number, boolean>>({})
  const [usingSearchByMessageIndex, setUsingSearchByMessageIndex] = useState<Record<number, boolean>>({})

  const [activeTabByMessageIndex, setActiveTabByMessageIndex] = useState<Record<number, SearchTab>>({})
  const [searchDataByMessageIndex, setSearchDataByMessageIndex] = useState<Record<number, any>>({})
  const [isFetchingSearch, setIsFetchingSearch] = useState<boolean>(false)
  const [animateTabsByMessageIndex, setAnimateTabsByMessageIndex] = useState<Record<number, boolean>>({})

  const abortControllerRef = useRef<AbortController | null>(null)
  const streamBufferRef = useRef<string>('')

  const sendMessage = useCallback((message: string, options?: { reset?: boolean }) => {
    const trimmed = message.trim()
    const useSearchMode = shouldEnableSearch(trimmed)
    if (trimmed.length === 0 || status === 'submitted' || status === 'streaming') return

    const reset = options?.reset === true
    if (reset) {
      try { abortControllerRef.current?.abort() } catch {}
      abortControllerRef.current = null
      setReasoningByMessageIndex({})
      setReasoningDurationByMessageIndex({})
      setFinalStartedByMessageIndex({})
      setUsingSearchByMessageIndex({})
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
        const selectedModel = '@preset/yurie-ai'
        const payloadMessages = nextMessages
          .filter((m) => !(m.role === 'assistant' && (!m.content || (typeof m.content === 'string' && m.content.trim() === ''))))
          .map((m) => ({ ...m, content: stripImageData(m.content) }))
        const ac = new AbortController()
        abortControllerRef.current = ac

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
            reasoning: { effort: 'high', exclude: false },
            useSearch: useSearchMode,
            searchContextSize: useSearchMode ? 'high' as const : undefined,
          }),
          signal: ac.signal,
        })

        if (!res.ok || !res.body) {
          if (res.status === 413) throw new Error('Payload too large for server.')
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
        const thinkingStartMs = Date.now()
        let recordedFirstVisible = false
        setReasoningByMessageIndex((prev) => ({ ...prev, [assistantIndex]: '' }))
        setUsingSearchByMessageIndex((prev) => ({ ...prev, [assistantIndex]: useSearchMode }))
        setStatus('streaming')

        // Initialize default tab for this user message
        setActiveTabByMessageIndex((prev) => ({ ...prev, [userMessageIndex]: 'Yurie' }))

        // Resolve search results without blocking the AI stream
        searchPromise.then((data) => {
          if (data) setSearchDataByMessageIndex((prev) => ({ ...prev, [userMessageIndex]: data }))
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
          if (!recordedFirstVisible && hasVisibleAssistantContent(assistantText)) {
            const thinkingDurationSec = Math.max(1, Math.ceil((Date.now() - thinkingStartMs) / 1000))
            setReasoningDurationByMessageIndex((prev) => ({ ...prev, [assistantIndex]: thinkingDurationSec }))
            setFinalStartedByMessageIndex((prev) => ({ ...prev, [assistantIndex]: true }))
            recordedFirstVisible = true
          }
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

        if (!recordedFirstVisible) {
          const thinkingDurationSec = Math.max(1, Math.ceil((Date.now() - thinkingStartMs) / 1000))
          setReasoningDurationByMessageIndex((prev) => ({ ...prev, [assistantIndex]: thinkingDurationSec }))
          setFinalStartedByMessageIndex((prev) => ({ ...prev, [assistantIndex]: true }))
        }
      } catch (err) {
        const isAbort = (
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && (/abort/i.test(err.name) || /abort/i.test(err.message)))
        )
        if (!isAbort) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          setMessages((prev) => [...prev, { role: 'assistant', content: `There was an error: ${message}` }])
          setStatus('error')
        }
      } finally {
        setStatus('ready')
        abortControllerRef.current = null
        streamBufferRef.current = ''
      }
    }
    processMessage()
  }, [messages, status, lastResponseId])

  const newChat = useCallback(() => {
    try { abortControllerRef.current?.abort() } catch {}
    abortControllerRef.current = null
    setMessages([])
    setReasoningByMessageIndex({})
    setReasoningDurationByMessageIndex({})
    setFinalStartedByMessageIndex({})
    setUsingSearchByMessageIndex({})
    setSearchDataByMessageIndex({})
    setActiveTabByMessageIndex({})
    setLastResponseId(null)
    setStatus('ready')
    streamBufferRef.current = ''
  }, [])

  const changeTab = useCallback(async (msgIndex: number, tab: SearchTab, rawQuery: string) => {
    setAnimateTabsByMessageIndex((prev) => ({ ...prev, [msgIndex]: true }))
    setActiveTabByMessageIndex((prev) => ({ ...prev, [msgIndex]: tab }))
    if (tab === 'Yurie') return
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
    } finally {
      setIsFetchingSearch(false)
      setTimeout(() => {
        setAnimateTabsByMessageIndex((prev) => ({ ...prev, [msgIndex]: false }))
      }, 350)
    }
  }, [searchDataByMessageIndex, isFetchingSearch])

  const replaceMessages = useCallback((arr: ChatMessage[]) => {
    try { abortControllerRef.current?.abort() } catch {}
    abortControllerRef.current = null
    setMessages(Array.isArray(arr) ? arr : [])
    setReasoningByMessageIndex({})
    setReasoningDurationByMessageIndex({})
    setFinalStartedByMessageIndex({})
    setUsingSearchByMessageIndex({})
    setSearchDataByMessageIndex({})
    setActiveTabByMessageIndex({})
    setLastResponseId(null)
    setStatus('ready')
    streamBufferRef.current = ''
  }, [])

  return {
    state: {
      messages,
      status,
      lastResponseId,
      reasoningByMessageIndex,
      reasoningDurationByMessageIndex,
      finalStartedByMessageIndex,
      usingSearchByMessageIndex,
      activeTabByMessageIndex,
      searchDataByMessageIndex,
      isFetchingSearch,
      animateTabsByMessageIndex,
    },
    sendMessage,
    newChat,
    replaceMessages,
    changeTab,
  }
}


