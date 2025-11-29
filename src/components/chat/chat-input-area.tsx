'use client'

import { PromptInputBox } from '@/components/ui/ai-prompt-box'

export type ChatInputAreaProps = {
  isLoading: boolean
  onSend: (content: string, files?: File[]) => void
  placeholder?: string
  variant?: 'fixed' | 'inline'
}

export function ChatInputArea({
  isLoading,
  onSend,
  placeholder = "what's on your mind?",
  variant = 'fixed',
}: ChatInputAreaProps) {
  if (variant === 'inline') {
    return (
      <div className="w-full">
        <PromptInputBox
          isLoading={isLoading}
          onSend={onSend}
          className="w-full"
          placeholder={placeholder}
        />
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
      <div className="pointer-events-auto bg-white dark:bg-black">
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

