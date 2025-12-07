'use client'

import { PromptInputBox } from '@/components/ui/ai-prompt-box'

export type ChatInputAreaProps = {
  isLoading: boolean
  onSend: (content: string, files?: File[]) => void
  placeholder?: string
  variant?: 'fixed' | 'inline'
  /** Controlled selected tools state */
  selectedTools?: string[]
  /** Callback when selected tools change */
  onSelectedToolsChange?: (tools: string[]) => void
}

export function ChatInputArea({
  isLoading,
  onSend,
  placeholder = "How can I help you?",
  variant = 'fixed',
  selectedTools,
  onSelectedToolsChange,
}: ChatInputAreaProps) {
  if (variant === 'inline') {
    return (
      <div className="w-full">
        <PromptInputBox
          isLoading={isLoading}
          onSend={onSend}
          className="w-full"
          placeholder={placeholder}
          selectedTools={selectedTools}
          onSelectedToolsChange={onSelectedToolsChange}
        />
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
      <div className="pointer-events-auto bg-[var(--color-background)]">
        <div className="mx-auto w-full max-w-2xl px-4 pb-3 pt-3 sm:pb-5">
          <PromptInputBox
            isLoading={isLoading}
            onSend={onSend}
            className="w-full"
            placeholder={placeholder}
            selectedTools={selectedTools}
            onSelectedToolsChange={onSelectedToolsChange}
          />
        </div>
      </div>
    </div>
  )
}
