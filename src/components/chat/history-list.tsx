'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { getChats, deleteChat, clearHistory } from '@/lib/chat/history'
import { useAuth } from '@/lib/providers/auth-provider'
import type { SavedChat } from '@/lib/types'
import { motion } from 'motion/react'
import { AnimatedBackground } from '@/components/ui/animated-background'

const VARIANTS_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.3,
}

interface HistoryListProps {
  initialChats?: SavedChat[]
}

export function HistoryList({ initialChats = [] }: HistoryListProps) {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [chats, setChats] = useState<SavedChat[]>(initialChats)
  const [mounted, setMounted] = useState(false)
  
  // Track whether we've done the initial client-side fetch
  const hasInitializedRef = useRef(false)
  // Track the user ID that was used for SSR data (if any)
  const ssrUserIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    setMounted(true)

    async function fetchChats() {
      const data = await getChats(user?.id)
      setChats(data)
    }

    // Determine if we need to fetch
    const shouldFetch = () => {
      // If auth is still loading, wait
      if (isAuthLoading) return false

      // If we haven't initialized yet
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true
        
        // If we have SSR data, check if the user context matches
        if (initialChats.length > 0) {
          // SSR data exists - only refetch if user state differs
          // (e.g., SSR was for guest but now user is logged in)
          const ssrWasForGuest = ssrUserIdRef.current === undefined
          const nowHasUser = !!user?.id
          
          // If SSR was for a guest and we now have a logged-in user, fetch
          if (ssrWasForGuest && nowHasUser) {
            return true
          }
          
          // Otherwise, SSR data is valid, no need to refetch
          return false
        }
        
        // No SSR data, we need to fetch
        return true
      }

      return false
    }

    if (shouldFetch()) {
      fetchChats()
    }

    // Listen for history updates
    const handleHistoryUpdate = () => {
      fetchChats()
    }

    window.addEventListener('history-updated', handleHistoryUpdate)
    return () => {
      window.removeEventListener('history-updated', handleHistoryUpdate)
    }
  }, [user, isAuthLoading, initialChats.length])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this chat?')) {
      await deleteChat(id, user?.id)
      const data = await getChats(user?.id)
      setChats(data)
    }
  }

  const handleClearHistory = async () => {
    if (
      window.confirm(
        'Are you sure you want to clear all history? This cannot be undone.',
      )
    ) {
      await clearHistory(user?.id)
      setChats([])
    }
  }

  // Show loading state only if we have no data and are not mounted (for client-side only fallback)
  // For server-side provided data, we render immediately.
  if (!mounted && initialChats.length === 0) {
    return (
      <div className="p-4 text-center text-zinc-500">Loading history...</div>
    )
  }

  if (chats.length === 0) {
    return (
      <motion.div
        className="flex min-h-[50vh] flex-col items-center justify-center p-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex w-full max-w-sm flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
            <img src="/favicon.ico" alt="Yurie" className="h-8 w-8 opacity-50 grayscale" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Nothing here yet
          </h3>
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            Start a conversation to see your threads here.
          </p>
          <AnimatedBackground
            enableHover
            className="h-full w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900/80"
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.2,
            }}
          >
            <Link
              href="/"
              className="relative -mx-3 inline-flex items-center justify-center rounded-full px-3 py-2 text-sm font-medium text-zinc-950 dark:text-zinc-50 transition-colors hover:text-zinc-950"
              data-id="start-chat"
            >
              Message Yurie
            </Link>
          </AnimatedBackground>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.main
      className="space-y-12 pb-4"
      variants={VARIANTS_CONTAINER}
      initial="hidden"
      animate="visible"
    >
      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Your conversations</h2>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 flex items-center gap-2"
            >
              New thread
            </Link>
            <div className="h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700" />
            <button
              onClick={handleClearHistory}
              className="cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Clear all
            </button>
          </div>
        </div>
        
        <div className="-mx-4 overflow-hidden">
          <AnimatedBackground
            enableHover
            className="h-full w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900/80"
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.2,
            }}
          >
            {chats.map((chat) => (
              <div
                key={chat.id}
                data-id={chat.id}
                className="w-full rounded-2xl px-4 py-3 relative group overflow-hidden"
              >
                  <Link
                    href={`/?id=${chat.id}`}
                    className="absolute inset-0 z-0"
                  />
                  <div className="relative z-10 pointer-events-none flex flex-col space-y-1 pr-8 min-w-0 w-full">
                    <h4 className="font-normal dark:text-zinc-100 truncate">
                      {chat.title}
                    </h4>
                    {chat.messages.length > 0 && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 break-words">
                        {chat.messages[chat.messages.length - 1].content.replace(
                          /[#*`_~-]/g,
                          '',
                        )}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                      <span suppressHydrationWarning>{new Date(chat.updatedAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{chat.messages.length} messages</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, chat.id)}
                    className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)] opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
              </div>
            ))}
          </AnimatedBackground>
        </div>
      </motion.section>
    </motion.main>
  )
}
