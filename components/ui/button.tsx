import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-sm whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/85 transition-colors",
        destructive:
          "bg-destructive text-destructive-foreground font-semibold shadow-sm hover:bg-destructive/80 transition-colors",
        outline:
          "border border-border bg-card text-foreground font-medium shadow-sm hover:bg-muted hover:text-foreground transition-colors",
        secondary:
          "bg-muted text-foreground font-medium shadow-sm hover:bg-muted/80 transition-colors",
        ghost: "text-foreground font-medium hover:bg-muted hover:text-foreground transition-colors",
        link: "text-foreground underline-offset-4 hover:underline transition-colors",
      },
      size: {
        default: "h-9 px-md py-sm",
        sm: "h-8 rounded-md px-sm text-xs",
        lg: "h-10 rounded-md px-xl",
        icon: "h-9 w-9",
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
