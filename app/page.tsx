'use client'
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { BLOG_POSTS } from './data'
import { Footer } from '@/app/footer'
import { useAuth } from '@/components/auth-provider'

const VARIANTS_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.3,
}

function getGreetingByHour(hour: number) {
  if (hour >= 5 && hour < 12) {
    return 'Good morning!'
  }
  if (hour >= 12 && hour < 18) {
    return 'Good afternoon!'
  }
  return 'Good evening!'
}

type ContentItem = {
  title: string
  description: string
  link: string
  uid: string
}

function ContentSection({
  title,
  items,
}: {
  title: string
  items: ContentItem[]
}) {
  return (
    <motion.section
      variants={VARIANTS_SECTION}
      transition={TRANSITION_SECTION}
    >
      <h3 className="mb-3 text-lg font-medium">{title}</h3>
      <div className="flex flex-col space-y-0">
        <AnimatedBackground
          enableHover
          className="h-full w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/80"
          transition={{
            type: 'spring',
            bounce: 0,
            duration: 0.2,
          }}
        >
          {items.map((item) => (
            <Link
              key={item.uid}
              className="-mx-3 rounded-xl px-3 py-3"
              href={item.link}
              data-id={item.uid}
            >
              <div className="flex flex-col space-y-1">
                <h4 className="font-normal dark:text-zinc-100">
                  {item.title}
                </h4>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </AnimatedBackground>
      </div>
    </motion.section>
  )
}

export default function Personal() {
  const [greeting, setGreeting] = useState('Welcome')
  const { user } = useAuth()

  useEffect(() => {
    const now = new Date()
    const hour = now.getHours()
    const baseGreeting = getGreetingByHour(hour)

    if (user?.user_metadata?.full_name) {
      const firstName = user.user_metadata.full_name.split(' ')[0]
      if (firstName) {
        setGreeting(`${baseGreeting.slice(0, -1)}, ${firstName}!`)
      } else {
        setGreeting(baseGreeting)
      }
    } else {
      setGreeting(baseGreeting)
    }
  }, [user])

  return (
    <motion.main
      className="space-y-12"
      variants={VARIANTS_CONTAINER}
      initial="hidden"
      animate="visible"
    >
      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
      >
        <h2 className="mb-2 text-lg font-medium">{greeting}</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Welcome to my digital garden. Here, I share my journey exploring AI agents, 
          design patterns, and the future of human-computer interaction.
        </p>
      </motion.section>
      <ContentSection title="Blog" items={BLOG_POSTS} />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
        <div className="pointer-events-auto mx-auto w-full max-w-screen-sm px-4">
           <div className="bg-white dark:bg-zinc-950">
             <Footer className="mt-0" />
           </div>
        </div>
      </div>
    </motion.main>
  )
}
