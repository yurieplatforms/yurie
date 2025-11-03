import { Response as StreamResponse } from '@/app/components/ui/response'
import { parseMessageContent } from '@/app/lib/chat-utils'
import { cn } from '@/app/lib/utils'

type MessageContentProps = {
  role: 'user' | 'assistant'
  content: string
}

export function MessageContent({ role, content }: MessageContentProps) {
  const parts = parseMessageContent(content)
  
  const latestPartialIndex = (() => {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      if ((p as any).type === 'image' && (p as any).partial) return i
    }
    return -1
  })()
  const hasFinalImage = parts.some((p) => (p as any).type === 'image' && !(p as any).partial)
  
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === 'text') {
          return (
            <div
              key={i}
              className={cn(
                role === 'user'
                  ? 'break-words'
                  : 'prose prose-neutral dark:prose-invert break-words prose-p:leading-snug prose-p:my-0 prose-li:my-0 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2'
              )}>
              <StreamResponse className="w-full" parseIncompleteMarkdown>
                {p.value}
              </StreamResponse>
            </div>
          )
        }
        if (p.type === 'image') {
          const isPartial = p.partial === true
          const isLatestPartial = latestPartialIndex === i
          if (isPartial && (!isLatestPartial || hasFinalImage)) {
            return null
          }
          return (
            <img
              key={i}
              src={p.src}
              alt="Generated image"
              className={cn(
                'mt-2 rounded border border-neutral-200 dark:border-neutral-800 max-w-full',
                role === 'assistant' ? 'mb-1' : 'mb-3'
              )}
            />
          )
        }
        if (p.type === 'citation') {
          const domain = (() => {
            try {
              const url = new URL(p.url)
              return url.hostname.replace('www.', '')
            } catch {
              return p.url
            }
          })()
          return (
            <div key={i} className="my-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <a 
                href={p.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-sm hover:opacity-80 transition-opacity"
              >
                <svg className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-blue-700 dark:text-blue-300 truncate">
                    {p.title || domain}
                  </div>
                  {p.content && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 line-clamp-2">
                      {p.content}
                    </div>
                  )}
                  <div className="text-xs text-blue-500 dark:text-blue-500 mt-0.5">
                    {domain}
                  </div>
                </div>
              </a>
            </div>
          )
        }
        return null
      })}
      {parts.map((p, i) => {
        if ((p as any).type === 'meta') {
          const meta = p as any
          const label =
            meta.key === 'revised_prompt'
              ? 'Revised prompt'
              : meta.key === 'response_id'
                ? 'Response ID'
                : meta.key === 'summary_text'
                  ? 'Reasoning summary'
                  : 'Status'
          return (
            <div key={`meta-${i}`} className="text-xs text-neutral-500 mt-1">
              <span className="font-medium">{label}:</span> {meta.value}
            </div>
          )
        }
        return null
      })}
    </>
  )
}