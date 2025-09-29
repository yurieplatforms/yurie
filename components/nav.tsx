'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Navbar() {
  const pathname = usePathname()
  const safePathname = pathname ?? '/'
  const isPlayground = safePathname === '/'
  const isExploreActive =
    safePathname === '/' ||
    safePathname.startsWith('/blog') ||
    safePathname.startsWith('/research')
  const lastScrollYRef = useRef<number>(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hasChatMessages, setHasChatMessages] = useState(false)

  useEffect(() => {
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
            <DropdownMenu open={menuOpen} onOpenChange={(open) => {
              try {
                const y = window.scrollY
                lastScrollYRef.current = y
                setMenuOpen(open)
                requestAnimationFrame(() => window.scrollTo(0, y))
                setTimeout(() => window.scrollTo(0, y), 0)
              } catch {
                setMenuOpen(open)
              }
            }}>
              <DropdownMenuTrigger asChild>
                <button
                  className={`${isExploreActive ? 'font-semibold text-foreground' : 'font-normal text-foreground/80'} group cursor-pointer relative my-1 mr-0 ml-0 flex items-center rounded-xl px-0 py-1 align-middle transition-colors hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-0`}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span className="group inline-flex items-center gap-1 rounded-xl px-0 py-1.5 transition-colors">
                    <Image
                      src="/favicon.ico"
                      alt="Yurie"
                      width={20}
                      height={20}
                      className="h-5 w-5 origin-center transform transition-transform duration-200 ease-out select-none group-hover:scale-110 sm:h-6 sm:w-6"
                      draggable={false}
                    />
                    <span className="leading-none">Yurie</span>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                side="bottom"
                align="start"
                sideOffset={4}
                className="min-w-[8rem] z-[100] bg-[var(--color-chat-input)] border-[var(--color-chat-input-border)] shadow-lg backdrop-blur-md rounded-[20px]"
              >
                <DropdownMenuItem 
                  asChild
                  className="mx-1 my-0.5 px-3 py-2 rounded-lg text-sm !text-[var(--color-foreground)] hover:bg-[var(--color-pill-hover)] focus:bg-[var(--color-pill-hover)] cursor-pointer transition-colors"
                >
                  <Link
                    href="/"
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
                </DropdownMenuItem>
                <DropdownMenuItem 
                  asChild
                  className="mx-1 my-0.5 px-3 py-2 rounded-lg text-sm !text-[var(--color-foreground)] hover:bg-[var(--color-pill-hover)] focus:bg-[var(--color-pill-hover)] cursor-pointer transition-colors"
                >
                  <Link
                    href="/research"
                    onClick={() => setMenuOpen(false)}
                  >
                    Research
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  asChild
                  className="mx-1 my-0.5 px-3 py-2 rounded-lg text-sm !text-[var(--color-foreground)] hover:bg-[var(--color-pill-hover)] focus:bg-[var(--color-pill-hover)] cursor-pointer transition-colors"
                >
                  <Link
                    href="/blog"
                    onClick={() => setMenuOpen(false)}
                  >
                    Blog
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isPlayground && hasChatMessages ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.dispatchEvent(new CustomEvent('yurie:new-chat'))
                    } catch {}
                  }}
                  className="inline-flex items-center px-0 py-0 text-sm font-normal text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78] cursor-pointer"
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
