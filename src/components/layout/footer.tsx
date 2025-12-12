'use client'
import Link from 'next/link'
import { TextLoop } from '@/components/ui/text-loop'
import { cn } from '@/lib/utils'
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'

const THEMES_OPTIONS = [
  {
    label: 'Light',
    id: 'light',
    icon: <SunIcon className="h-4 w-4" />,
  },
  {
    label: 'System',
    id: 'system',
    icon: <MonitorIcon className="h-4 w-4" />,
  },
  {
    label: 'Dark',
    id: 'dark',
    icon: <MoonIcon className="h-4 w-4" />,
  },
]

export function ThemeSwitch() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-2">
      {THEMES_OPTIONS.map((option) => {
        // Ensure only ONE button is active at a time.
        // When the user selects "system", we highlight only the system option,
        // even if the resolved theme is currently light/dark.
        const selectedTheme =
          theme === 'system' ? 'system' : theme ?? resolvedTheme ?? 'system'
        const isActive = selectedTheme === option.id
        return (
          <button
            key={option.id}
            onClick={() => setTheme(option.id)}
            className={cn(
              'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--radius-full)] transition-all duration-[var(--transition-base)]',
              isActive
                ? 'bg-[var(--color-accent)] text-[var(--color-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface)] active:bg-[var(--color-accent)]',
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

export function Footer({ className, hideThemeSwitch }: { className?: string; hideThemeSwitch?: boolean }) {
  return (
    <footer className={cn("mt-24 border-t border-[var(--color-border)] px-0 py-5", className)}>
      <div className="flex items-center justify-between">
        <Link href="/">
          <TextLoop className="text-[var(--font-size-xs)] text-[var(--color-muted-foreground)] tracking-normal">
            <span>© 2025 Yurie Platforms.</span>
            <span>Built with love and a little bit of magic.</span>
          </TextLoop>
        </Link>
        {!hideThemeSwitch && (
          <ThemeSwitch />
        )}
      </div>
    </footer>
  )
}
