'use client'

import { PromptInputBox } from '@/components/ui/ai-prompt-box'

export type ChatInputAreaProps = {
  isLoading: boolean
  onSend: (content: string, files?: File[]) => void
  placeholder?: string
}

export function ChatInputArea({
  isLoading,
  onSend,
  placeholder = "What's on your mind?",
}: ChatInputAreaProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
      <div className="pointer-events-auto bg-white dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-screen-sm px-4 pb-4 pt-3 sm:pb-5">
          <PromptInputBox
            isLoading={isLoading}
            onSend={onSend}
            className="w-full"
            placeholder={placeholder}
          />
        </div>
      </div>
    </div>
  )
}

