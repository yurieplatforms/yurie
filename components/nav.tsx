'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'

export function Navbar() {
  const pathname = usePathname()
  const safePathname = pathname ?? '/'
  const isPlayground = safePathname === '/'
  const isExploreActive =
    safePathname === '/' ||
    safePathname.startsWith('/blog') ||
    safePathname.startsWith('/research')
  const lastScrollYRef = useRef<number>(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hasChatMessages, setHasChatMessages] = useState(false)

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('touchstart', onDocMouseDown, { passive: true } as any)
    document.addEventListener('keydown', onKey)
    const onChatState = (e: Event) => {
      try {
        const ce = e as CustomEvent
        const next = Boolean(ce?.detail?.hasMessages)
        setHasChatMessages(next)
      } catch {}
    }
    try {
      window.addEventListener('yurie:chat-state', onChatState as EventListener)
    } catch {}
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('touchstart', onDocMouseDown as any)
      document.removeEventListener('keydown', onKey)
      try {
        window.removeEventListener('yurie:chat-state', onChatState as EventListener)
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
            <div ref={menuRef} className="relative">
              <button
                className={`${isExploreActive ? 'font-bold text-neutral-900 dark:text-neutral-100' : 'font-normal text-neutral-600 dark:text-neutral-400'} group cursor-pointer relative my-1 mr-0 ml-0 flex items-center rounded-xl px-0 py-1 align-middle transition-colors hover:opacity-100 focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:outline-none sm:px-0 dark:focus-visible:ring-neutral-700`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  try {
                    const y = window.scrollY
                    lastScrollYRef.current = y
                    setMenuOpen((v) => !v)
                    requestAnimationFrame(() => window.scrollTo(0, y))
                    setTimeout(() => window.scrollTo(0, y), 0)
                  } catch {
                    setMenuOpen((v) => !v)
                  }
                }}
              >
                <span className="inline-flex items-center gap-1 rounded-xl px-0 py-1.5 transition-colors">
                  <Image
                    src="/favicon.ico"
                    alt="Yurie"
                    width={20}
                    height={20}
                    className="h-5 w-5 origin-center transform transition-transform duration-200 ease-out select-none group-hover:scale-110 sm:h-6 sm:w-6"
                    draggable={false}
                  />
                  <span className="leading-none">Yurie</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </span>
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute left-0 z-50 mt-1 min-w-[8rem] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                >
                  <Link
                    href="/"
                    className="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
                    onClick={(e) => {
                      if (safePathname === '/') {
                        e.preventDefault()
                        setMenuOpen(false)
                        try {
                          window.location.assign('/')
                        } catch {}
                      } else {
                        setMenuOpen(false)
                      }
                    }}
                  >
                    Playground
                  </Link>
                  <Link
                    href="/research"
                    className="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setMenuOpen(false)}
                  >
                    Research
                  </Link>
                  <Link
                    href="/blog"
                    className="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
                    onClick={() => setMenuOpen(false)}
                  >
                    Blog
                  </Link>
                </div>
              ) : null}
            </div>
            {isPlayground && hasChatMessages ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.dispatchEvent(new CustomEvent('yurie:new-chat'))
                    } catch {}
                  }}
                  className="inline-flex items-center px-0 py-0 text-sm font-normal text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer"
                  aria-label="New chat"
                  title="New chat"
                >
                  New Chat
                </button>
              </div>
            ) : null}
          </div>
        </nav>
      </div>
    </aside>
  )
}
