import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/utils"

const inputVariants = cva(
  "flex w-full text-sm transition-all duration-[var(--transition-base)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium",
  {
    variants: {
      variant: {
        default: [
          "h-10 rounded-[var(--radius-full)] border border-[var(--color-border)] bg-[var(--color-surface)]",
          "px-4 py-2 text-[var(--color-foreground)]",
          "hover:border-[var(--color-muted-foreground)]/50 hover:bg-[var(--color-surface-hover)]",
          "focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:bg-[var(--color-background)]",
        ],
        ghost: [
          "h-10 rounded-[var(--radius-lg)] bg-transparent border-none",
          "px-3 py-2 text-[var(--color-foreground)]",
          "hover:bg-[var(--color-surface-hover)] focus:bg-[var(--color-surface-hover)]",
        ],
        filled: [
          "h-11 rounded-[var(--radius-full)] border-2 border-transparent bg-[var(--color-surface-hover)]",
          "px-4 py-2 text-[var(--color-foreground)]",
          "hover:bg-[var(--color-surface-active)]",
          "focus:border-[var(--color-accent)]/50 focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:bg-[var(--color-surface-hover)]",
        ],
      },
      inputSize: {
        default: "h-10",
        sm: "h-8 text-xs px-3",
        lg: "h-11 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
)

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }
