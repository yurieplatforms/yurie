import { FileText } from 'lucide-react'
import type { AttachmentPreview } from '@/app/types/chat'

type MessageAttachmentListProps = {
  attachments: AttachmentPreview[]
}

export function MessageAttachmentList({ attachments }: MessageAttachmentListProps) {
  if (!attachments || attachments.length === 0) return null
  
  return (
    <div className="mt-2 mb-0 flex flex-row flex-wrap gap-2">
      {attachments.map((att) => (
        att.isImage ? (
          <img
            key={att.id}
            src={att.objectUrl}
            alt={att.name}
            className="rounded-none max-h-56 object-cover"
          />
        ) : (
          <div
            key={att.id}
            className="flex items-center gap-2 px-2 py-1 rounded-xl bg-neutral-100 dark:bg-[#3A3A40] text-xs text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-transparent"
          >
            <FileText className="w-4 h-4" />
            <span className="max-w-[12rem] truncate">{att.name}</span>
          </div>
        )
      ))}
    </div>
  )
}

