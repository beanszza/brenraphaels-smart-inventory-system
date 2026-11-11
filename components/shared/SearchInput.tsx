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
        "flex items-center gap-2.5 flex-1 h-10 px-3.5 rounded-xl border border-border bg-secondary/50 dark:bg-background/80 shadow-none transition-colors hover:border-primary/40 focus-within:bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15",
        containerClassName
      )}
    >
      <Search className="w-4 h-4 text-foreground/60 shrink-0" />
      <Input
        type="text"
        className={cn(
          "border-0 shadow-none focus-visible:ring-0 bg-transparent h-full p-0 text-sm flex-1 text-foreground placeholder:text-muted-foreground",
          className
        )}
        {...props}
      />
    </div>
  );
}

