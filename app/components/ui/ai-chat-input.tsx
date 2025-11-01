"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Plus, Send, Loader2 } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

type AIChatInputProps = {
  onSend?: (text: string) => void
  onNewChat?: () => void
  isLoading?: boolean
  className?: string
}

const PLACEHOLDERS = [
  // Web search
  "latest AI news",
  "quantum computing explained",
  "apple vision pro review",
  // Science
  "how does photosynthesis work",
  "what is dark matter",
  "symptoms of vitamin d deficiency",
  // History
  "who built the pyramids",
  "what started world war 2",
  "when did humans first use fire",
  // Tech
  "react vs vue 2025",
  "how to center a div",
  "best laptops under 1000",
  // Entertainment
  "movies like inception",
  "stranger things season 5 release date",
  "best video games 2025",
  // Explore
  "things to do in paris",
  "best time to visit japan",
  "cheap flights to europe",
]

const AIChatInput: React.FC<AIChatInputProps> = ({ onSend, onNewChat, isLoading = false, className }) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const [isActive, setIsActive] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isFetchingSuggest, setIsFetchingSuggest] = useState(false)
  const suggestAbortRef = useRef<AbortController | null>(null)
  
  const wrapperRef = useRef<HTMLDivElement>(null)
  
  
  // Cycle placeholder text when input is inactive
  useEffect(() => {
    if (isActive || inputValue) return

    const interval = setInterval(() => {
      setShowPlaceholder(false)
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
        setShowPlaceholder(true)
      }, 400)
    }, 3000)

    return () => clearInterval(interval)
  }, [isActive, inputValue])

  // Close input when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        if (!inputValue) setIsActive(false)
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [inputValue])

  const handleActivate = () => setIsActive(true)

  // Debounced autosuggest fetch
  useEffect(() => {
    const q = inputValue.trim()
    if (!q) {
      setSuggestions([])
      setShowSuggestions(false)
      setHighlightedIndex(-1)
      try { suggestAbortRef.current?.abort() } catch {}
      suggestAbortRef.current = null
      return
    }
    const t = setTimeout(async () => {
      try {
        try { suggestAbortRef.current?.abort() } catch {}
        const ac = new AbortController()
        suggestAbortRef.current = ac
        setIsFetchingSuggest(true)
        setShowSuggestions(true)
        const usp = new URLSearchParams({ q, hl: 'en', gl: 'us', limit: '8' })
        const resp = await fetch(`/api/suggest?${usp.toString()}`, { signal: ac.signal, cache: 'no-store' })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json()
        const list = Array.isArray(json?.suggestions) ? (json.suggestions as string[]) : []
        setSuggestions(list)
        setShowSuggestions(list.length > 0)
        setHighlightedIndex(-1)
      } catch {
        // ignore errors (network/abort)
        setShowSuggestions(false)
      } finally {
        setIsFetchingSuggest(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [inputValue])

  const handleSend = (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim()
    if (!text || isLoading) return
    onSend?.(text)
    setInputValue("")
    setSuggestions([])
    setShowSuggestions(false)
    setHighlightedIndex(-1)
  }

  const placeholderContainerVariants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.025 } },
    exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
  } as const

  const letterVariants = {
    initial: {
      opacity: 0,
      filter: "blur(12px)",
      y: 10,
    },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        opacity: { duration: 0.25 },
        filter: { duration: 0.4 },
        y: { type: "spring", stiffness: 80, damping: 20 },
      },
    },
    exit: {
      opacity: 0,
      filter: "blur(12px)",
      y: -10,
      transition: {
        opacity: { duration: 0.2 },
        filter: { duration: 0.3 },
        y: { type: "spring", stiffness: 80, damping: 20 },
      },
    },
  } as const

  return (
    <div className={className ? className : undefined}>
      <div
        ref={wrapperRef}
        className="w-full bg-white dark:bg-[#303030] text-neutral-900 dark:text-white border border-gray-200 dark:border-[#444444]"
        style={{ borderRadius: 32, boxShadow: "0 2px 8px 0 rgba(0,0,0,0.08)" }}
        onClick={handleActivate}
      >
        {/* No file previews */}

        <div className="relative flex items-center gap-2 p-2.5 rounded-full bg-white dark:bg-[#303030] max-w-[52rem] w-full mx-auto">
          <button
            type="button"
            className="p-2.5 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-[#3A3A40] transition cursor-pointer"
            title="New thread"
            aria-label="New thread"
            onClick={() => {
              // Trigger new chat action
              try { (onNewChat && onNewChat()) } catch {}
            }}
          >
            <Plus size={19} />
          </button>

          {/* Text Input & Placeholder */}
          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                const hasSuggestionsOpen = showSuggestions && suggestions.length > 0
                if (e.key === "ArrowDown" && hasSuggestionsOpen) {
                  e.preventDefault()
                  setHighlightedIndex((prev) => (prev + 1) % suggestions.length)
                  return
                }
                if (e.key === "ArrowUp" && hasSuggestionsOpen) {
                  e.preventDefault()
                  setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
                  return
                }
                if (e.key === "Tab" && hasSuggestionsOpen) {
                  e.preventDefault()
                  const idx = highlightedIndex >= 0 ? highlightedIndex : 0
                  const pick = suggestions[idx]
                  if (pick) {
                    setInputValue(pick)
                    setShowSuggestions(false)
                    setHighlightedIndex(-1)
                  }
                  return
                }
                if (e.key === "Escape" && hasSuggestionsOpen) {
                  e.preventDefault()
                  setShowSuggestions(false)
                  setHighlightedIndex(-1)
                  return
                }
                if (e.key === "Enter") {
                  if (hasSuggestionsOpen && highlightedIndex >= 0) {
                    e.preventDefault()
                    const pick = suggestions[highlightedIndex]
                    if (pick) {
                      setInputValue(pick)
                      setShowSuggestions(false)
                      setHighlightedIndex(-1)
                    }
                    return
                  }
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="flex-1 border-0 outline-0 rounded-md py-1.5 text-base bg-transparent w-full font-normal text-neutral-900 dark:text-white placeholder:text-neutral-500"
              style={{ position: "relative", zIndex: 1 }}
              onFocus={handleActivate}
              disabled={isLoading}
            />
            <div className="absolute left-0 top-0 w-full h-full pointer-events-none flex items-center px-3 py-1.5">
              <AnimatePresence mode="wait">
                {showPlaceholder && !isActive && !inputValue && (
                  <motion.span
                    key={placeholderIndex}
                    className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 select-none pointer-events-none"
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      zIndex: 0,
                    }}
                    variants={placeholderContainerVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {PLACEHOLDERS[placeholderIndex]
                      .split("")
                      .map((char, i) => (
                        <motion.span
                          key={i}
                          variants={letterVariants}
                          style={{ display: "inline-block" }}
                        >
                          {char === " " ? "\u00A0" : char}
                        </motion.span>
                      ))}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Autosuggest dropdown moved to row container for full width */}
          </div>

          

          <button
            className="flex items-center gap-1 bg-[#7f91e0] hover:bg-[#6a7dc4] text-white p-2.5 rounded-full font-medium justify-center disabled:opacity-50 cursor-pointer"
            title="Send"
            type="button"
            tabIndex={-1}
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>

          {showSuggestions && (suggestions.length > 0 || isFetchingSuggest) && (
            <div className="absolute left-0 right-0 top-[calc(100%+24px)] z-50 rounded-2xl border border-gray-200 dark:border-[#444444] bg-white dark:bg-[#232323] shadow-xl overflow-hidden">
              <ul role="listbox" aria-label="Suggestions" className="max-h-72 overflow-auto py-2">
                {isFetchingSuggest && suggestions.length === 0 && (
                  <li className="px-3 py-2 text-sm text-neutral-500">Loading...</li>
                )}
                {suggestions.map((s, i) => (
                  <li key={`${s}-${i}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlightedIndex}
                      className={`w-full text-left px-3 py-2 text-[15px] transition cursor-pointer ${i === highlightedIndex ? 'bg-gray-100 dark:bg-[#333333]' : 'bg-transparent'} text-neutral-900 dark:text-neutral-100`}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleSend(s)
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-200 dark:border-[#444444] px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 flex items-center justify-between">
                <span className="truncate">Search web for “{inputValue}”</span>
                <button
                  type="button"
                  className="ml-3 px-2.5 py-1 rounded-md text-white bg-[#7f91e0] hover:bg-[#6a7dc4] text-xs cursor-pointer"
                  onMouseDown={(e) => { e.preventDefault(); handleSend() }}
                >
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  )
}

export { AIChatInput }


