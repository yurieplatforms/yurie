'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { getChats, deleteChat, clearHistory } from '@/lib/chat/history'
import { useAuth } from '@/lib/providers/auth-provider'
import type { SavedChat } from '@/lib/types'
import { motion } from 'motion/react'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
      <div className="p-4 text-center text-[var(--color-muted-foreground)]">Loading history...</div>
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
          <h3 className="mb-2 text-lg font-medium text-[var(--color-foreground)]">
            Nothing here yet
          </h3>
          <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
            Start a conversation to see your threads here.
          </p>
          <AnimatedBackground
            enableHover
            className="h-full w-full rounded-[var(--radius-full)] bg-[var(--color-surface-hover)]"
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
          >
            <Link
              href="/"
              className="relative -mx-3 inline-flex items-center justify-center rounded-[var(--radius-full)] px-3 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
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
          <h1 className="text-lg font-semibold tracking-tight text-[var(--color-foreground)]">Your conversations</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className={cn(
                "relative rounded-[var(--radius-full)] px-3.5 py-1.5 text-sm font-medium transition-all duration-[var(--transition-base)]",
                "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] active:bg-[var(--color-surface-active)]"
              )}
            >
              New thread
            </Link>
            <div className="h-4 w-px bg-[var(--color-border)]" />
            <button
              onClick={handleClearHistory}
              className={cn(
                "relative rounded-[var(--radius-full)] px-3.5 py-1.5 text-sm font-medium transition-all duration-[var(--transition-base)] cursor-pointer",
                "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] active:bg-[var(--color-surface-active)]"
              )}
            >
              Clear all
            </button>
          </div>
        </div>
        
        <div className="-mx-4 overflow-hidden">
          <AnimatedBackground
            enableHover
            className="h-full w-full rounded-[var(--radius-card)] bg-[var(--color-surface-hover)]"
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
          >
            {chats.map((chat) => (
              <Card
                key={chat.id}
                data-id={chat.id}
                variant="ghost"
                className="w-full relative group"
              >
                  <Link
                    href={`/?id=${chat.id}`}
                    className="absolute inset-0 z-0"
                  />
                  <div className="relative z-10 pointer-events-none flex flex-col space-y-1 pr-8 min-w-0 w-full">
                    <h4 className="font-normal text-[var(--color-foreground)] truncate">
                      {chat.title}
                    </h4>
                    {chat.messages.length > 0 && (
                      <p className="text-sm text-[var(--color-muted-foreground)] line-clamp-2 break-words">
                        {chat.messages[chat.messages.length - 1].content.replace(
                          /[#*`_~-]/g,
                          '',
                        )}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)] pt-1">
                      <span suppressHydrationWarning>{new Date(chat.updatedAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{chat.messages.length} messages</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, chat.id)}
                    className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-all hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] active:bg-[var(--color-surface-active)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:scale-110 active:scale-100 border border-transparent hover:border-[var(--color-border)]"
                    title="Delete chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
              </Card>
            ))}
          </AnimatedBackground>
        </div>
      </motion.section>
    </motion.main>
  )
}
