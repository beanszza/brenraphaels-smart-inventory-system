import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-[22px] items-center rounded-pill border px-2.5 py-[3px] type-badge focus:outline-none focus:ring-2 focus:ring-focus",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-status-purple-bg text-status-purple-fg",
        secondary:
          "border-transparent bg-status-gray-bg text-status-gray-fg",
        gray:
          "border-transparent bg-status-gray-bg text-status-gray-fg",
        destructive:
          "border-transparent bg-status-red-bg text-status-red-fg",
        outline:
          "border-border bg-status-blue-bg text-status-blue-fg",
        success:
          "border-transparent bg-status-green-bg text-status-green-fg",
        warning:
          "border-transparent bg-status-amber-bg text-status-amber-fg",
        info:
          "border-transparent bg-status-blue-bg text-status-blue-fg",
        purple:
          "border-transparent bg-status-purple-bg text-status-purple-fg",
        indigo:
          "border-transparent bg-status-blue-bg text-status-blue-fg",
        teal:
          "border-transparent bg-status-teal-bg text-status-teal-fg",
        orange:
          "border-transparent bg-status-amber-bg text-status-amber-fg",
        notification:
          "border-transparent bg-badge-notification text-badge-notification-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
