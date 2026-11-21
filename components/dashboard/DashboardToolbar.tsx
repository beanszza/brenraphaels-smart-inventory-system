"use client";

import { useState } from "react";
import { Calendar, ChevronDown, Download, FileSpreadsheet, FileText, Radio } from "lucide-react";
import type { DashboardAnalytics } from "@/lib/dashboard/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  downloadDashboardExcel,
  downloadDashboardPdf,
} from "./exportDashboardReport";

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatShortDate(iso: string): string {
  const parsed = new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatCompactRange(from: string, to: string): string {
  const f = new Date(`${from}T00:00:00.000Z`);
  const t = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return `${from} – ${to}`;
  const sameYear = f.getUTCFullYear() === t.getUTCFullYear();
  const startFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(f);
  const endFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(t);
  return from === to ? endFmt : `${startFmt} – ${endFmt}`;
}

type PresetOption = {
  id: string;
  label: string;
  resolve: (today: Date) => { from: string; to: string };
};

const PRESETS: PresetOption[] = [
  {
    id: "today",
    label: "Today",
    resolve: (today) => {
      const iso = toIsoDate(today);
      return { from: iso, to: iso };
    },
  },
  {
    id: "7d",
    label: "Last 7 days",
    resolve: (today) => {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6));
      return { from: toIsoDate(start), to: toIsoDate(today) };
    },
  },
  {
    id: "this-month",
    label: "This month",
    resolve: (today) => {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return { from: toIsoDate(start), to: toIsoDate(today) };
    },
  },
  {
    id: "last-month",
    label: "Last month",
    resolve: (today) => {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      return { from: toIsoDate(start), to: toIsoDate(end) };
    },
  },
  {
    id: "90d",
    label: "Last 90 days",
    resolve: (today) => {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 89));
      return { from: toIsoDate(start), to: toIsoDate(today) };
    },
  },
  {
    id: "6m",
    label: "Last 6 months",
    resolve: (today) => {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
      return { from: toIsoDate(start), to: toIsoDate(today) };
    },
  },
];

export function DashboardToolbar({ analytics }: { analytics: DashboardAnalytics }) {
  const activeRange = analytics.dateRange ?? null;
  const isLive = !activeRange;
  const defaultToday = analytics.generatedAt.slice(0, 10);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [fromInput, setFromInput] = useState(activeRange?.from ?? defaultToday);
  const [toInput, setToInput] = useState(activeRange?.to ?? defaultToday);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const triggerLabel = isLive
    ? `Live · ${formatShortDate(analytics.generatedAt)}`
    : activeRange.label
      ? `${activeRange.label} · ${formatCompactRange(activeRange.from, activeRange.to)}`
      : formatCompactRange(activeRange.from, activeRange.to);

  const navigateToRange = (from: string, to: string, preset?: string) => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (preset) params.set("preset", preset);
    setCalendarOpen(false);
    window.location.assign(`/?${params.toString()}`);
  };

  const handleSelectLive = () => {
    setRangeError(null);
    setCalendarOpen(false);
    window.location.assign("/");
  };

  const handleSelectPreset = (preset: PresetOption) => {
    setRangeError(null);
    const today = new Date(analytics.generatedAt);
    const { from, to } = preset.resolve(Number.isNaN(today.getTime()) ? new Date() : today);
    navigateToRange(from, to, preset.label);
  };

  const handleApplyCustom = () => {
    if (!fromInput || !toInput) {
      setRangeError("Select both start and end dates.");
      return;
    }
    if (fromInput > toInput) {
      setRangeError("Start date must be on or before end date.");
      return;
    }
    setRangeError(null);
    navigateToRange(fromInput, toInput);
  };

  const handleExportExcel = () => {
    setExportOpen(false);
    downloadDashboardExcel(analytics);
  };

  const handleExportPdf = async () => {
    setExportOpen(false);
    await downloadDashboardPdf(analytics);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-8 px-3 rounded-control border border-input bg-surface text-ink type-label-button-sm hover:bg-page transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            {isLive ? (
              <span className="size-2 rounded-pill bg-success shrink-0" aria-hidden="true" />
            ) : (
              <Calendar className="size-3.5 text-ink-muted shrink-0" />
            )}
            <span>{triggerLabel}</span>
            <ChevronDown className="size-3.5 text-ink-muted shrink-0" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-80 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="type-caption font-semibold text-ink">
              Dashboard Timeline
            </span>
            <button
              type="button"
              onClick={handleSelectLive}
              className={`h-7 px-2.5 rounded-control type-caption font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                isLive
                  ? "bg-status-green-bg text-status-green-fg"
                  : "border border-input bg-surface text-ink hover:bg-page"
              }`}
            >
              <Radio className="size-3 shrink-0" />
              Live (Present)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset) => {
              const active = !isLive && activeRange.label === preset.label;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`h-8 px-2.5 rounded-control type-caption font-medium text-left transition-colors cursor-pointer ${
                    active
                      ? "bg-primary text-on-brand border border-primary"
                      : "bg-surface text-ink-secondary border border-input hover:bg-page hover:text-ink"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="pt-2.5 border-t border-divider space-y-2.5">
            <p className="type-caption font-medium text-ink-muted">
              Custom date range
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="block type-caption text-ink-muted">From</span>
                <input
                  type="date"
                  value={fromInput}
                  onChange={(e) => {
                    setFromInput(e.target.value);
                    setRangeError(null);
                  }}
                  className="h-8 w-full rounded-control border border-input bg-surface px-2 type-caption text-ink focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </label>
              <label className="space-y-1">
                <span className="block type-caption text-ink-muted">To</span>
                <input
                  type="date"
                  value={toInput}
                  onChange={(e) => {
                    setToInput(e.target.value);
                    setRangeError(null);
                  }}
                  className="h-8 w-full rounded-control border border-input bg-surface px-2 type-caption text-ink focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </label>
            </div>

            {rangeError && (
              <p className="type-caption text-destructive">{rangeError}</p>
            )}

            <button
              type="button"
              onClick={handleApplyCustom}
              className="h-8 w-full rounded-control bg-primary text-on-brand type-label-button-sm hover:bg-primary-hover transition-colors cursor-pointer"
            >
              Apply Range
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={exportOpen} onOpenChange={setExportOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-8 px-3 rounded-control border border-input bg-surface text-ink type-label-button-sm hover:bg-page transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Download className="size-3.5 text-ink-secondary shrink-0" />
            <span>Export</span>
            <ChevronDown className="size-3.5 text-ink-muted shrink-0" />
          </button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-52 p-1.5 space-y-1">
          <button
            type="button"
            onClick={handleExportExcel}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control type-body-secondary text-ink hover:bg-page transition-colors text-left cursor-pointer"
          >
            <FileSpreadsheet className="size-4 text-primary shrink-0" />
            <span>Excel Report (.xls)</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control type-body-secondary text-ink hover:bg-page transition-colors text-left cursor-pointer"
          >
            <FileText className="size-4 text-primary shrink-0" />
            <span>PDF Report (.pdf)</span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
