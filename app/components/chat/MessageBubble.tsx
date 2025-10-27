import { cn } from '@/app/lib/utils'
import { MessageContent } from './MessageContent'
import { MessageAttachmentList } from './MessageAttachmentList'
import type { AttachmentPreview } from '@/app/types/chat'

type MessageBubbleProps = {
  role: 'user' | 'assistant'
  content: string
  attachments?: AttachmentPreview[]
  isStandalone?: boolean
}

export function MessageBubble({ role, content, attachments, isStandalone = false }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className={cn('w-full flex items-center gap-0 justify-end', isStandalone && '-mx-2 sm:-mx-4')}>
        <div
          className={cn(
            'min-w-0 w-full max-w-full break-words pt-3 pb-4 text-base leading-snug flex-1',
            'text-neutral-900 dark:text-white',
            'bg-white dark:bg-[#303030] border border-gray-200 dark:border-[#444444]',
            isStandalone ? 'px-2 sm:px-4' : 'pl-2 sm:pl-4 pr-4 sm:pr-6'
          )}
          style={{ borderRadius: 32, boxShadow: "0 2px 8px 0 rgba(0,0,0,0.08)" }}
        >
          <div className="min-w-0 w-full flex items-center">
            <div className="min-w-0 flex-1">
              <MessageContent role={role} content={content} />
              {attachments && <MessageAttachmentList attachments={attachments} />}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-w-0 w-full')}>
      <MessageContent role={role} content={content} />
    </div>
  )
}

