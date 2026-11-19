"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-toast group-[.toaster]:text-toast-foreground group-[.toaster]:border-transparent group-[.toaster]:shadow-modal group-[.toaster]:rounded-inner group-[.toaster]:w-[360px]",
          description: "group-[.toast]:text-toast-foreground/80",
          actionButton:
            "group-[.toast]:bg-focus group-[.toast]:text-toast-foreground",
          cancelButton:
            "group-[.toast]:bg-white/10 group-[.toast]:text-toast-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
