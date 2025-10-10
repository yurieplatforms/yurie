'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export function Navbar() {
  const pathname = usePathname()
  const safePathname = pathname ?? '/'
  const isPlayground = safePathname === '/'
  const [hasChatMessages, setHasChatMessages] = useState(false)

  useEffect(() => {
    const onChatState = (e: Event) => {
      try {
        const ce = e as CustomEvent
        const next = Boolean(ce?.detail?.hasMessages)
        setHasChatMessages(next)
      } catch {}
    }
    const onModelState = () => {}
    const onGeneratingState = () => {}
    try {
      window.addEventListener('yurie:chat-state', onChatState as EventListener)
      window.addEventListener('yurie:model:state', onModelState as EventListener)
      window.addEventListener('yurie:generating', onGeneratingState as EventListener)
    } catch {}
    return () => {
      try {
        window.removeEventListener('yurie:chat-state', onChatState as EventListener)
        window.removeEventListener('yurie:model:state', onModelState as EventListener)
        window.removeEventListener('yurie:generating', onGeneratingState as EventListener)
      } catch {}
    }
  }, [])

  

  return (
    <aside
      className={
        isPlayground
          ? 'fixed top-0 left-0 right-0 z-50 h-12 pt-1.5 tracking-tight bg-[var(--color-background)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/60'
          : 'fixed top-0 left-0 right-0 z-50 h-12 pt-1.5 tracking-tight bg-[var(--color-background)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/60'
      }
    >
      <div className="mx-auto max-w-3xl">
        <nav
          className="flex scroll-pr-6 flex-row items-center px-0 pb-0"
          id="nav"
        >
          <div className="flex w-full h-10 flex-row items-center justify-between px-3 sm:px-4">
            {(!isPlayground || hasChatMessages) ? (
              <Link
                href="/"
                className="group flex items-center gap-1 px-0 py-1.5 cursor-pointer transition-opacity animate-[fadeInDown_300ms_ease-out]"
                onClick={(e) => {
                  if (safePathname === '/') {
                    e.preventDefault()
                    try {
                      window.location.assign('/')
                    } catch {}
                  }
                }}
              >
                <img
                  src="/favicon.ico"
                  alt="Yurie"
                  width={20}
                  height={20}
                  className="h-5 w-5 origin-center transform transition-transform duration-200 ease-out select-none group-hover:scale-105 sm:h-6 sm:w-6"
                  draggable={false}
                  decoding="async"
                />
                <span className="leading-none font-semibold text-foreground">Yurie</span>
              </Link>
            ) : null}
            {isPlayground ? (
              <div className="flex items-center gap-2" />
            ) : null}
          </div>
        </nav>
      </div>
    </aside>
  )
}
