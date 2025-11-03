import { cn } from '@/app/lib/utils'
import { MessageContent } from './MessageContent'

type MessageBubbleProps = {
  role: 'user' | 'assistant'
  content: string
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="w-full pb-6 border-b border-neutral-200 dark:border-neutral-700">
        <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900 dark:text-white leading-snug break-words text-left">
          <MessageContent role={role} content={content} />
        </h1>
      </div>
    )
  }

  return (
    <div className={cn('min-w-0 w-full')}>
      <MessageContent role={role} content={content} />
    </div>
  )
}