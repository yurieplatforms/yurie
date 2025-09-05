"use client"

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const navItems = {
  '/': {
    name: 'home',
  },
  '/blog': {
    name: 'blog',
  },
  '/playground': {
    name: 'playground',
  },
}

export function Navbar() {
  const pathname = usePathname()
  const handlePlaygroundClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (pathname === '/playground') {
      e.preventDefault()
      window.location.assign('/playground')
    }
  }
  return (
    <aside className="mb-16 tracking-tight">
      <div className="lg:sticky lg:top-20">
        <nav
          className="flex flex-row items-center relative px-0 pl-3 pr-3 sm:pl-4 sm:pr-4 pb-0 md:overflow-auto scroll-pr-6 md:relative"
          id="nav"
        >
          <div className="flex flex-row space-x-8 sm:space-x-10 lg:space-x-12 xl:space-x-16 pr-6 sm:pr-10">
            {Object.entries(navItems).map(([path, { name }]) => {
              const isActive = path === '/' ? pathname === '/' : pathname.startsWith(path)
              return (
                <Link
                  key={path}
                  href={path}
                  className={`${isActive ? 'font-bold text-neutral-900 dark:text-neutral-100' : 'font-normal text-neutral-600 dark:text-neutral-400'} transition-all hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center align-middle relative py-1 pl-0 pr-4 sm:pr-5 lg:pr-6 my-1 mr-0 ml-0`}
                  onClick={path === '/playground' ? handlePlaygroundClick : undefined}
                >
                  {path === '/' ? (
                    <Image
                      src="/favicon.ico"
                      alt="Home"
                      width={32}
                      height={32}
                      className="w-8 h-8"
                    />
                  ) : (
                    name
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
