"use client";

interface ResourceStatusTabsProps {
  value: string;
  onChange: (value: "All" | "Active" | "Inactive") => void;
  counts: {
    all: number;
    active: number;
    inactive: number;
  };
}

const statuses = [
  { value: "All", label: "All", countKey: "all" },
  { value: "Active", label: "Active", countKey: "active" },
  { value: "Inactive", label: "Inactive", countKey: "inactive" },
] as const;

export default function ResourceStatusTabs({ value, onChange, counts }: ResourceStatusTabsProps) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {statuses.map((status) => {
          const isSelected = value === status.value;
          const count = counts[status.countKey] || 0;

          return (
            <button
              key={status.value}
              type="button"
              onClick={() => onChange(status.value)}
              aria-pressed={isSelected}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${
                isSelected
                  ? "bg-status-purple-bg text-primary"
                  : "text-ink-muted hover:text-ink hover:bg-subtle"
              }`}
            >
              <span>{status.label}</span>
              <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
