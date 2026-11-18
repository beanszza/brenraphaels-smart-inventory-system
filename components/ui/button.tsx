import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control type-label-button transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
        "bg-primary text-primary-foreground hover:bg-primary-hover transition-colors",
        destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors",
        outline:
        "border border-input bg-surface text-ink hover:bg-subtle hover:text-ink transition-colors",
        secondary:
        "border border-input bg-surface text-ink hover:bg-subtle hover:text-ink transition-colors",
        ghost: "text-ink hover:bg-subtle hover:text-ink transition-colors",
        link: "text-primary underline-offset-4 hover:underline transition-colors",
        ai: "border border-ai-border bg-tint-soft text-ai hover:bg-tint-tab transition-colors",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-control px-3 type-label-button-sm",
        lg: "h-12 rounded-control px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }: ButtonProps, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
