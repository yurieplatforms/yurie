"use client"

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const navItems = {
  '/': {
    name: 'home',
  },
  '/blog': {
    name: 'Blog',
  },
  '/research': {
    name: 'Research',
  },
  '/playground': {
    name: 'Playground',
  },
}

export function Navbar() {
  const pathname = usePathname()
  const isPlayground = pathname.startsWith('/playground')
  const handlePlaygroundClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (pathname === '/playground') {
      e.preventDefault()
      window.location.assign('/playground')
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
                  className={`${isActive ? 'font-bold text-neutral-900 dark:text-neutral-100' : 'font-normal text-neutral-600 dark:text-neutral-400'} ${path === '/' ? 'select-none' : ''} group rounded-xl px-3 sm:px-4 py-1 transition-colors hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700 flex items-center align-middle relative my-1 mr-0 ml-0`}
                  onClick={path === '/playground' ? handlePlaygroundClick : undefined}
                >
                  {path === '/' ? (
                    <span className="inline-flex items-center justify-center rounded-xl p-2 -m-2 transition-colors">
                      <Image
                        src="/favicon.ico"
                        alt="Home"
                        width={32}
                        height={32}
                        className="w-8 h-8 select-none"
                        draggable={false}
                      />
                    </span>
                  ) : (
                    <span className="inline-block rounded-xl px-3 py-1.5 -mx-3 -my-1.5 transition-colors group-hover:bg-neutral-50 dark:group-hover:bg-neutral-900">
                      {name}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </aside>
  )
}
