"use client"

import Link from "next/link"
import Image from "next/image"
import { useSidebar } from "./sidebar"
import { cn } from "@/app/lib/utils"
import { Pin, PinOff } from "lucide-react"

export function SidebarBrand() {
  const { open, pinned, setPinned } = useSidebar()
  return (
    <div className="relative z-20">
      {/* Desktop layout */}
      <div className={cn(
        "hidden md:flex items-center w-full",
        open ? "justify-between" : "justify-center"
      )}>
      <Link
        href="/"
        className={cn(
          "font-normal flex items-center text-sm !text-black dark:!text-white py-0 relative z-20",
          open ? "space-x-2" : "h-10 w-10 justify-center items-center"
        )}
      >
        <div className="flex-shrink-0">
          <Image
            src="/favicon.ico?v=3"
            alt="Yurie"
            width={20}
            height={20}
            className="h-5 w-5"
          />
        </div>
        <span
          aria-hidden={!open}
          className={cn(
            "font-medium text-black dark:text-white whitespace-pre overflow-hidden",
            open ? "opacity-100 max-w-[160px]" : "opacity-0 max-w-0"
          )}
        >
          Yurie
        </span>
      </Link>
      {open && (
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin and collapse sidebar" : "Pin sidebar open"}
            title={pinned ? "Unpin sidebar" : "Pin sidebar"}
            onClick={() => {
              if (pinned) {
                // Do not force-close on unpin; let hover behavior collapse on mouse leave
                setPinned(false)
              } else {
                setPinned(true)
              }
            }}
            className={cn(
                "inline-flex items-center justify-center rounded-md cursor-pointer text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600",
              "h-8 w-8"
            )}
          >
            {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
            <span className="sr-only">{pinned ? "Unpin sidebar" : "Pin sidebar"}</span>
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

