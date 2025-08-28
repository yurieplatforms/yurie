"use client"

import React from 'react'

type ModelOption = {
  value: string
  label: string
}

type ModelSelectorProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  options?: ModelOption[]
}

const DEFAULT_OPTIONS: ModelOption[] = [
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-5-mini', label: 'GPT-5 mini' },
  { value: 'gpt-5-nano', label: 'GPT-5 nano' },
]

export function ModelSelector({
  value,
  onChange,
  disabled,
  className = '',
  options = DEFAULT_OPTIONS,
}: ModelSelectorProps) {
  const baseClass =
    'appearance-none no-native-arrow select-chevron no-focus-outline outline-none rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black px-2 py-2 h-10 text-sm'

  return (
    <select
      className={`${baseClass} ${className}`.trim()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label="Model"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}


