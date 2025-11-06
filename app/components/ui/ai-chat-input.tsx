"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Plus, Send, Loader2 } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useSuggest } from '@/app/hooks/useSuggest'
import { SuggestionsList } from '@/app/components/ui/ai-chat-input/SuggestionsList'
import { getRandomSuggestions, getRandomPlaceholderTexts, getFreshSuggestions } from '@/app/lib/suggestion-prompts'

type AIChatInputProps = {
  onSend?: (text: string) => void
  onNewChat?: () => void
  isLoading?: boolean
  className?: string
  // When true, the parent layout vertically centers this input (empty state).
  // We compensate so the input row doesn't jump up when suggestions open.
  isEmptyLayout?: boolean
}

const AIChatInput: React.FC<AIChatInputProps> = ({ onSend, onNewChat, isLoading = false, className, isEmptyLayout = false }) => {
  // Generate random suggestions once per component mount (client-side only)
  const [PLACEHOLDERS, setPLACEHOLDERS] = useState<string[]>([])
  const [PLACEHOLDER_TEXTS, setPLACEHOLDER_TEXTS] = useState<string[]>([])
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const [isActive, setIsActive] = useState(false)
  const [inputValue, setInputValue] = useState("")
  
  // Initialize suggestions after mount to avoid hydration mismatch
  useEffect(() => {
    setPLACEHOLDERS(getRandomSuggestions(8))
    setPLACEHOLDER_TEXTS(getRandomPlaceholderTexts(18))
  }, [])
  const {
    suggestions,
    highlightedIndex,
    isFetchingSuggest,
    showSuggestions,
    setShowSuggestions,
    setHighlightedIndex,
    updateQuery,
    reset: resetSuggest,
  } = useSuggest()
  
  const wrapperRef = useRef<HTMLDivElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  
  
  // Cycle placeholder text when input is inactive (only in empty layout)
  useEffect(() => {
    if (!isEmptyLayout || isActive || inputValue) return

    const interval = setInterval(() => {
      setShowPlaceholder(false)
      setTimeout(() => {
        const len = Math.max(1, PLACEHOLDER_TEXTS.length)
        setPlaceholderIndex((prev) => (prev + 1) % len)
        setShowPlaceholder(true)
      }, 400)
    }, 3000)

    return () => clearInterval(interval)
  }, [isActive, inputValue, isEmptyLayout, PLACEHOLDER_TEXTS.length])

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

  const handleActivate = () => {
    setIsActive(true)
    if (isEmptyLayout) {
      const q = inputValue.trim()
      if (!q) {
        // Show default suggestions on focus/click when empty
        setShowSuggestions(true)
        setHighlightedIndex(-1)
        // Refresh randomized defaults every time suggestions open
        setPLACEHOLDERS(getFreshSuggestions(8))
      }
    }
  }

  // Debounced autosuggest integration
  useEffect(() => {
    const q = inputValue.trim()
    if (!isEmptyLayout) {
      resetSuggest()
      return
    }
    if (!q) {
      setShowSuggestions(isEmptyLayout && isActive)
      setHighlightedIndex(-1)
      return
    }
    setShowSuggestions(true)
    updateQuery(q, isEmptyLayout, isActive)
  }, [inputValue, isEmptyLayout, isActive, resetSuggest, setShowSuggestions, setHighlightedIndex, updateQuery])

  // Refresh defaults whenever the dropdown opens with an empty query
  useEffect(() => {
    if (showSuggestions && isEmptyLayout && !inputValue.trim()) {
      setPLACEHOLDERS(getFreshSuggestions(8))
    }
  }, [showSuggestions, isEmptyLayout, inputValue])

  const handleSend = (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim()
    if (!text || isLoading) return
    onSend?.(text)
    setInputValue("")
    resetSuggest()
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

  const getGraphemes = (text: string): string[] => {
    try {
      const Seg = (Intl as any)?.Segmenter
      if (typeof Seg === "function") {
        const segmenter = new Seg(undefined, { granularity: "grapheme" })
        return Array.from(segmenter.segment(text), (s: any) => s.segment)
      }
    } catch {}
    return Array.from(text)
  }

  return (
    <div className={className ? className : undefined}>
      <div
        ref={wrapperRef}
        className={`relative w-full bg-white dark:bg-[#303030] text-neutral-900 dark:text-white border border-gray-200 dark:border-[#444444] p-px`}
        style={{ borderRadius: showSuggestions ? '32px 32px 0 0' : 32, boxShadow: "0 2px 8px 0 rgba(0,0,0,0.08)" }}
        onClick={handleActivate}
      >
        <div className="relative flex items-center gap-2 p-2.5 bg-white dark:bg-[#303030] max-w-[52rem] w-full mx-auto rounded-[31px] overflow-hidden">
          <button
            type="button"
            className="p-2.5 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-[#3A3A40] transition cursor-pointer"
            title={!isEmptyLayout ? "Start a new thread" : undefined}
            aria-label={!isEmptyLayout ? "Start a new thread" : undefined}
            onClick={() => {
              // Trigger new chat action
              try { (onNewChat && onNewChat()) } catch {}
            }}
          >
            {isEmptyLayout ? (
              <Plus size={19} />
            ) : (
              <Plus size={19} />
            )}
          </button>

          {/* Text Input & Placeholder */}
          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                const v = e.target.value
                setInputValue(v)
                if (isEmptyLayout) {
                  if (v.trim()) setShowSuggestions(true)
                  else if (isActive) setShowSuggestions(true)
                } else {
                  setShowSuggestions(false)
                }
              }}
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
              onFocus={() => {
                handleActivate()
                if (isEmptyLayout) {
                  if (inputValue.trim()) setShowSuggestions(true)
                  else setShowSuggestions(true)
                }
              }}
              disabled={isLoading}
            />
            <div className="absolute left-0 top-0 w-full h-full pointer-events-none flex items-center px-3 py-1.5">
              <AnimatePresence mode="wait">
                {isEmptyLayout && showPlaceholder && !isActive && !inputValue && PLACEHOLDER_TEXTS.length > 0 && (
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
                    {getGraphemes(PLACEHOLDER_TEXTS[placeholderIndex] ?? "")
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
              {!isEmptyLayout && !isActive && !inputValue && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 select-none pointer-events-none"
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    zIndex: 0,
                  }}
                >
                  Ask a follow-up
                </span>
              )}
            </div>
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
        </div>

        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              ref={suggestionsRef}
              className="absolute top-full -mt-px left-[-1px] right-[-1px] z-50 w-[calc(100%+2px)] overflow-hidden bg-white dark:bg-[#303030] border border-gray-200 dark:border-[#444444] rounded-b-[32px] shadow-lg"
              initial={{ opacity: 0, y: -6, scaleY: 0.98 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -6, scaleY: 0.98 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: 'top' }}
            >
              <SuggestionsList
                suggestions={inputValue.trim() ? suggestions : PLACEHOLDERS.slice(0, 8)}
                isFetching={isFetchingSuggest}
                highlightedIndex={highlightedIndex}
                onHighlight={(i) => setHighlightedIndex(i)}
                onPick={(s) => handleSend(s)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export { AIChatInput }