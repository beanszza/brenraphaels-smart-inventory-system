"use client";

import React, { useState } from "react";
import { MoreHorizontal, Pencil, Eye } from "lucide-react";
import { LocationItem } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface LocationTableProps {
  locations: LocationItem[];
  onEdit: (loc: LocationItem) => void;
  onView: (loc: LocationItem) => void;
}

export default function LocationTable({ locations, onEdit, onView }: LocationTableProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-panel border border-divider bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-divider bg-surface-hover">
            <th className="sticky left-0 z-20 min-w-[160px] w-48 px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap bg-surface-hover backdrop-blur-xs border-r border-divider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">LOCATION NAME</th>
            <th className="px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">TYPE</th>
            <th className="px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">ADDRESS</th>
            <th className="px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">STATUS</th>
            <th className="px-3 py-3 text-center font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {locations.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-10 text-center type-body font-semibold text-text-muted">
                No Locations Found
              </td>
            </tr>
          ) : (
            locations.map((loc) => (
              <tr key={loc.id} className="hover:bg-surface-hover/60 transition-colors group">
                <td className="sticky left-0 z-10 min-w-[160px] w-48 px-3 py-3 font-semibold text-text-primary type-table-cell whitespace-nowrap bg-surface group-hover:bg-surface-hover transition-colors border-r border-divider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">{loc.name}</td>
                <td className="px-3 py-3 text-text-muted type-table-cell whitespace-nowrap">{loc.type}</td>
                <td className="px-3 py-3 text-text-muted type-table-cell">{loc.address}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={loc.status} />
                </td>
                <td className="px-3 py-3 text-center relative">
                  <button
                    type="button"
                    onClick={() => setActiveDropdownId(activeDropdownId === loc.id ? null : loc.id)}
                    className="p-1.5 rounded-control text-text-primary hover:bg-surface-hover transition-colors focus:outline-none"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeDropdownId === loc.id && (
                    <div className="absolute right-10 top-2 z-[100] w-36 rounded-control border border-divider bg-surface shadow-xl py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => { onEdit(loc); setActiveDropdownId(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-hover transition-colors"
                      >
                        <Pencil size={14} className="shrink-0" /> Edit Location
                      </button>
                      <button
                        type="button"
                        onClick={() => { onView(loc); setActiveDropdownId(null); }}
                        className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-hover transition-colors"
                      >
                        <Eye size={14} className="shrink-0" /> View Details
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
