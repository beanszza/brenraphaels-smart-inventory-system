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
    <div className="border-b border-border overflow-x-auto mb-6">
      <div className="flex items-center gap-1.5 min-w-max pb-2">
        {statuses.map((status) => {
          const isSelected = value === status.value;
          const count = counts[status.countKey] || 0;

          return (
            <button
              key={status.value}
              type="button"
              onClick={() => onChange(status.value)}
              aria-pressed={isSelected}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <span>{status.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium ${
                  isSelected
                    ? "bg-background text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
