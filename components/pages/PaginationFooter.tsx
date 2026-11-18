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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-divider bg-surface type-caption text-ink-muted">
      <div>
        Showing <span className="font-semibold text-ink">{startIndex + 1}</span> to{" "}
        <span className="font-semibold text-ink">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of{" "}
        <span className="font-semibold text-ink">{totalItems}</span> entries
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft size={16} /> Previous
        </Button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => (
            typeof p === "number" ? (
              <Button
                key={idx}
                variant={currentPage === p ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(p)}
                className={`size-8 p-0 rounded-control font-medium type-label-button-sm cursor-pointer ${
                  currentPage === p ? "shadow-none" : ""
                }`}
              >
                {p}
              </Button>
            ) : (
              <span key={idx} className="w-6 text-center text-ink-muted select-none type-caption">
                ...
              </span>
            )
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 cursor-pointer"
        >
          Next <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
