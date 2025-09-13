"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconMicroscope } from '@tabler/icons-react'
import { IconFeather } from '@tabler/icons-react'

const navItems = {
  '/': {
    name: 'Playground',
  },
  '/research': {
    name: 'Research',
  },
  '/blog': {
    name: 'Blog',
  },
}

export function Navbar() {
  const pathname = usePathname()
  const isPlayground = pathname === '/'
  const handlePlaygroundClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (pathname === '/') {
      e.preventDefault()
      window.location.assign('/')
    }
  }
  return (
    <aside className={isPlayground ? 'mb-4 tracking-tight' : 'mb-16 tracking-tight'}>
      <div className="lg:sticky lg:top-20">
        <nav
          className="flex flex-row items-center relative px-0 pb-0 md:overflow-auto scroll-pr-6 md:relative"
          id="nav"
        >
          <div className="flex flex-row space-x-8 sm:space-x-10 lg:space-x-12 xl:space-x-16 pr-6 sm:pr-10">
            {Object.entries(navItems).map(([path, { name }]) => {
              const isActive = path === '/' ? pathname === '/' : pathname.startsWith(path)
              return (
                <Link
                  key={path}
                  href={path}
                  className={`${isActive ? 'font-bold text-neutral-900 dark:text-neutral-100' : 'font-normal text-neutral-600 dark:text-neutral-400'} group rounded-xl px-3 sm:px-4 py-1 transition-colors hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700 flex items-center align-middle relative my-1 mr-0 ml-0`}
                  onClick={path === '/' ? handlePlaygroundClick : undefined}
                >
                  <span className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 -mx-3 -my-1.5 transition-colors group-hover:bg-[var(--surface-hover)]">
                    {path === '/' ? (
                      <>
                        <img
                          src="/favicon.ico"
                          alt="Yurie"
                          width={20}
                          height={20}
                          className="w-5 h-5 sm:w-6 sm:h-6 transform transition-transform duration-200 ease-out origin-center group-hover:scale-110"
                          draggable={false}
                        />
                        <span>{name}</span>
                      </>
                    ) : path === '/research' ? (
                      <>
                        <IconMicroscope
                          size={20}
                          stroke={1.75}
                          className="text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors"
                          aria-hidden
                        />
                        <span>{name}</span>
                      </>
                    ) : path === '/blog' ? (
                      <>
                        <IconFeather
                          size={20}
                          stroke={1.75}
                          className="text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors"
                          aria-hidden
                        />
                        <span>{name}</span>
                      </>
                    ) : (
                      name
                    )}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </aside>
  )
}
