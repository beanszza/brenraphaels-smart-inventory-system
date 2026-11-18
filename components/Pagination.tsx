"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages?: number;
  totalCount: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages: propTotalPages,
  totalCount,
  itemsPerPage = 10,
  onPageChange,
}: PaginationProps) {
  if (totalCount === 0) return null;
  const totalPages = propTotalPages ?? (Math.ceil(totalCount / itemsPerPage) || 1);
  if (totalPages <= 1) return null;
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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-divider bg-surface type-caption text-ink-muted rounded-b-card">
      <div>
        Showing <span className="font-semibold text-ink">{startIndex + 1}</span> to{" "}
        <span className="font-semibold text-ink">{Math.min(startIndex + itemsPerPage, totalCount)}</span> of{" "}
        <span className="font-semibold text-ink">{totalCount}</span> entries
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="flex items-center gap-1 h-8 px-3 rounded-control border border-input bg-surface text-ink hover:bg-subtle disabled:opacity-40 disabled:hover:bg-surface disabled:hover:text-ink disabled:cursor-not-allowed transition-colors type-label-button-sm cursor-pointer"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) =>
            typeof p === "number" ? (
              <button
                key={idx}
                type="button"
                onClick={() => onPageChange(p)}
                className={`size-8 rounded-control font-medium type-label-button-sm flex items-center justify-center transition-colors cursor-pointer ${
                  currentPage === p
                    ? "bg-primary text-on-brand shadow-none hover:bg-primary-hover"
                    : "bg-surface text-ink border border-input hover:bg-subtle"
                }`}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="w-6 text-center text-ink-muted select-none type-caption">
                ...
              </span>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 h-8 px-3 rounded-control border border-input bg-surface text-ink hover:bg-subtle disabled:opacity-40 disabled:hover:bg-surface disabled:hover:text-ink disabled:cursor-not-allowed transition-colors type-label-button-sm cursor-pointer"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
