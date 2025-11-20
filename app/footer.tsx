'use client'
import { TextLoop } from '@/components/ui/text-loop'
import { cn } from '@/lib/utils'
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const THEMES_OPTIONS = [
  {
    label: 'Light',
    id: 'light',
    icon: <SunIcon className="h-4 w-4" />,
  },
  {
    label: 'Dark',
    id: 'dark',
    icon: <MoonIcon className="h-4 w-4" />,
  },
  {
    label: 'System',
    id: 'system',
    icon: <MonitorIcon className="h-4 w-4" />,
  },
]

function ThemeSwitch() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="flex items-center gap-1">
      {THEMES_OPTIONS.map((option) => {
        const isActive = theme === option.id
        return (
          <button
            key={option.id}
            onClick={() => setTheme(option.id)}
            className={cn(
              'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors',
              isActive
                ? 'bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50',
            )}
            type="button"
            aria-label={`Switch to ${option.label} theme`}
          >
            {option.icon}
          </button>
        )
      })}
    </div>
  )
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-zinc-100 px-0 py-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <a href="https://github.com/ibelick/yurie" target="_blank">
          <TextLoop className="text-xs text-zinc-500">
            <span>© 2025 Yurie Platforms.</span>
            <span>Built with love and a little bit of magic.</span>
          </TextLoop>
        </a>
        <div className="text-xs text-zinc-400">
          <ThemeSwitch />
        </div>
      </div>
    </footer>
  )
}
