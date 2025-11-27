'use client'

import { AnimatedBackground } from '@/components/ui/animated-background'
import { PROMPT_SUGGESTIONS } from '@/lib/constants'

export type WelcomeScreenProps = {
  onSuggestionClick: (suggestion: string) => void
}

export function WelcomeScreen({ onSuggestionClick }: WelcomeScreenProps) {
  const greetingText = 'hi there! ready to dive in?'

  return (
    <div className="mt-auto space-y-3">
      <div className="mb-5 text-lg font-medium">{greetingText}</div>
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
          {PROMPT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.prompt}
              type="button"
              onClick={() => onSuggestionClick(suggestion.prompt)}
              className="-mx-3 w-full cursor-pointer rounded-xl px-3 py-3 text-left"
              data-id={suggestion.title}
            >
              <div className="flex flex-col space-y-1">
                <h4 className="font-normal dark:text-zinc-100">
                  {suggestion.title}
                </h4>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {suggestion.prompt}
                </p>
              </div>
            </button>
          ))}
        </AnimatedBackground>
      </div>
    </div>
  )
}

