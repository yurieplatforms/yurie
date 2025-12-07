import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-full)] text-sm font-medium transition-all duration-[var(--transition-base)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] cursor-pointer active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] hover:shadow-lg active:bg-[var(--color-primary-hover)] shadow-[var(--shadow-accent)]",
        destructive:
          "bg-[var(--color-destructive)] text-white hover:bg-[var(--color-destructive)]/80 hover:shadow-lg active:bg-[var(--color-destructive)]/70 shadow-[var(--shadow-destructive)]",
        "destructive-ghost":
          "bg-transparent text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/15 active:bg-[var(--color-destructive)]/25",
        outline:
          "border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-muted-foreground)]/30 active:bg-[var(--color-surface-active)] text-[var(--color-foreground)]",
        secondary:
          "bg-[var(--color-surface)] text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]",
        ghost:
          "hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
        link: "text-[var(--color-primary)] underline-offset-4 hover:underline hover:text-[var(--color-primary-hover)]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 gap-1.5 text-xs",
        lg: "h-11 px-6 text-base",
        xl: "h-12 px-8 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
