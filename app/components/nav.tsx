'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

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
  const safePathname = pathname ?? '/'
  const isPlayground = safePathname === '/'
  const handlePlaygroundClick: React.MouseEventHandler<HTMLAnchorElement> = (
    e
  ) => {
    if (safePathname === '/') {
      e.preventDefault()
      window.location.assign('/')
    }
  }
  return (
    <aside
      className={isPlayground ? 'mb-4 tracking-tight' : 'mb-16 tracking-tight'}
    >
      <div className="lg:sticky lg:top-20">
        <nav
          className="relative flex scroll-pr-6 flex-row items-center px-0 pb-0 md:relative md:overflow-auto"
          id="nav"
        >
          <div className="flex flex-row space-x-8 pr-6 sm:space-x-10 sm:pr-10 lg:space-x-12 xl:space-x-16">
            {Object.entries(navItems).map(([path, { name }]) => {
              const isActive =
                path === '/' ? safePathname === '/' : safePathname.startsWith(path)
              return (
                <Link
                  key={path}
                  href={path}
                  className={`${isActive ? 'font-bold text-neutral-900 dark:text-neutral-100' : 'font-normal text-neutral-600 dark:text-neutral-400'} group relative my-1 mr-0 ml-0 flex items-center rounded-xl px-3 py-1 align-middle transition-colors hover:opacity-100 focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:outline-none sm:px-4 dark:focus-visible:ring-neutral-700`}
                  onClick={path === '/' ? handlePlaygroundClick : undefined}
                >
                  <span className="-mx-3 -my-1.5 inline-flex items-center gap-2 rounded-xl px-3 py-1.5 transition-colors group-hover:bg-[var(--surface-hover)]">
                    {path === '/' ? (
                      <>
                        <Image
                          src="/favicon.ico"
                          alt="Yurie"
                          width={20}
                          height={20}
                          className="h-5 w-5 origin-center transform transition-transform duration-200 ease-out select-none group-hover:scale-110 sm:h-6 sm:w-6"
                          draggable={false}
                        />
                        <span>{name}</span>
                      </>
                    ) : (
                      <span>{name}</span>
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
