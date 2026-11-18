"use client";

import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  containerClassName?: string;
}

export function SearchInput({ containerClassName, className, ...props }: SearchInputProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-1 h-10 px-3 rounded-control border border-input bg-surface transition-colors focus-within:border-primary focus-within:shadow-focus",
        containerClassName
      )}
    >
      <Search className="size-4 text-ink-secondary shrink-0" />
      <Input
        type="text"
        className={cn(
          "border-0 shadow-none focus-visible:border-0 focus-visible:shadow-none bg-transparent h-full p-0 type-body flex-1 text-ink placeholder:text-ink-muted",
          className
        )}
        {...props}
      />
    </div>
  );
}

