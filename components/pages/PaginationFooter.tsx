"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationFooterProps {
  totalItems: number;
  currentPage: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
}

export default function PaginationFooter({
  totalItems,
  currentPage,
  itemsPerPage = 10,
  onPageChange,
}: PaginationFooterProps) {
  if (totalItems === 0) return null;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Smart Page Window (Prevents button overflow for 10+ pages)
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (currentPage > 3) pages.push("...");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-border bg-muted/50/30 text-xs font-medium text-muted-foreground">
      <div>
        Showing <span className="font-bold text-foreground">{startIndex + 1}</span> to{" "}
        <span className="font-bold text-foreground">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of{" "}
        <span className="font-bold text-foreground">{totalItems}</span> entries
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <Button
          variant="outline"
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-foreground disabled:cursor-not-allowed transition-colors text-xs font-semibold cursor-pointer"
        >
          <ChevronLeft size={14} /> Previous
        </Button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => (
            typeof p === "number" ? (
              <Button
                key={idx}
                variant={currentPage === p ? "default" : "outline"}
                onClick={() => onPageChange(p)}
                className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center transition-colors cursor-pointer ${
                  currentPage === p
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/85"
                    : "bg-card text-foreground border border-border hover:bg-primary hover:text-primary-foreground"
                }`}
              >
                {p}
              </Button>
            ) : (
              <span key={idx} className="w-6 text-center text-foreground font-bold select-none text-xs">
                ...
              </span>
            )
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-foreground disabled:cursor-not-allowed transition-colors text-xs font-semibold cursor-pointer"
        >
          Next <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
