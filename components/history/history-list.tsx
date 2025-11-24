'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { getChats, deleteChat, clearHistory } from '@/lib/history'
import { useAuth } from '@/components/providers/auth-provider'
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
  const { user } = useAuth()
  const [chats, setChats] = useState<SavedChat[]>(initialChats)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    async function fetchChats() {
      // If we have initial server data and a user, we might want to skip the immediate fetch
      // or fetch in background to ensure consistency without clearing state.
      const data = await getChats(user?.id)
      // Only update if we have data or if we didn't have initial data
      if (data.length > 0 || initialChats.length === 0) {
        setChats(data)
      }
    }
    
    // Only fetch if we don't have initial chats, or if user state changed/settled
    if (initialChats.length === 0 || user?.id) {
       fetchChats()
    }

    const handleHistoryUpdate = () => {
      fetchChats()
    }

    window.addEventListener('history-updated', handleHistoryUpdate)
    return () => {
      window.removeEventListener('history-updated', handleHistoryUpdate)
    }
  }, [user, initialChats.length])

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
            className="h-full w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/80"
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.2,
            }}
          >
            <Link
              href="/"
              className="relative -mx-3 inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-950 dark:text-zinc-50 transition-colors hover:text-zinc-950"
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
        
        <div className="flex flex-col space-y-0">
          <AnimatedBackground
            enableHover
            className="h-full w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/80"
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
                className="-mx-3 rounded-xl px-3 py-3 relative group"
              >
                  <Link
                    href={`/?id=${chat.id}`}
                    className="absolute inset-0 z-0"
                  />
                  <div className="relative z-10 pointer-events-none flex flex-col space-y-1 pr-8">
                    <div className="flex items-start justify-between">
                      <h4 className="font-normal dark:text-zinc-100 truncate">
                        {chat.title}
                      </h4>
                    </div>
                    {chat.messages.length > 0 && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
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
                    className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-zinc-200 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-zinc-800"
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
