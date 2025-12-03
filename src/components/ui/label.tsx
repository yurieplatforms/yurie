import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 transition-colors",
  {
    variants: {
      variant: {
        default: "text-[var(--color-foreground)]",
        muted: "text-[var(--color-muted-foreground)]",
        accent: "text-[var(--color-accent)]",
      },
      size: {
        default: "text-sm",
        xs: "text-xs",
        lg: "text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(labelVariants({ variant, size }), className)}
        {...props}
      />
    )
  }
)
Label.displayName = "Label"

// Form Label with icon support
interface FormLabelProps extends LabelProps {
  icon?: React.ReactNode
  optional?: boolean
}

const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, icon, optional, children, ...props }, ref) => {
    return (
      <Label
        ref={ref}
        className={cn("flex items-center gap-2", className)}
        variant="muted"
        size="xs"
        {...props}
      >
        {icon}
        {children}
        {optional && (
          <span className="font-normal opacity-60">(optional)</span>
        )}
      </Label>
    )
  }
)
FormLabel.displayName = "FormLabel"

export { Label, FormLabel, labelVariants }




