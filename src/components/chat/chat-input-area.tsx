'use client'

import { PromptInputBox } from '@/components/ui/ai-prompt-box'

export type ChatInputAreaProps = {
  isLoading: boolean
  onSend: (content: string, files?: File[], options?: { researchMode?: boolean; imageGenMode?: boolean }) => void
  placeholder?: string
  variant?: 'fixed' | 'inline'
  /** Controlled selected tools state */
  selectedTools?: string[]
  /** Callback when selected tools change */
  onSelectedToolsChange?: (tools: string[]) => void
  /** Controlled research mode state */
  researchMode?: boolean
  /** Callback when research mode changes */
  onResearchModeChange?: (enabled: boolean) => void
  /** Controlled image generation mode state */
  imageGenMode?: boolean
  /** Callback when image generation mode changes */
  onImageGenModeChange?: (enabled: boolean) => void
}

export function ChatInputArea({
  isLoading,
  onSend,
  placeholder = "How can I help you?",
  variant = 'fixed',
  selectedTools,
  onSelectedToolsChange,
  researchMode,
  onResearchModeChange,
  imageGenMode,
  onImageGenModeChange,
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
          researchMode={researchMode}
          onResearchModeChange={onResearchModeChange}
          imageGenMode={imageGenMode}
          onImageGenModeChange={onImageGenModeChange}
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
            researchMode={researchMode}
            onResearchModeChange={onResearchModeChange}
            imageGenMode={imageGenMode}
            onImageGenModeChange={onImageGenModeChange}
          />
        </div>
      </div>
    </div>
  )
}
