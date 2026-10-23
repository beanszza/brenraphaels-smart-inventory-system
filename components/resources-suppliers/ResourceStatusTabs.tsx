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
    <div className="mb-6 overflow-x-auto border-b border-border">
      <div className="flex min-w-max items-center gap-1.5 pb-2">
        {statuses.map((status) => {
          const isSelected = value === status.value;

          return (
            <button
              key={status.value}
              type="button"
              onClick={() => onChange(status.value)}
              aria-pressed={isSelected}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span>{status.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                  isSelected
                    ? "bg-background text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {counts[status.countKey]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
