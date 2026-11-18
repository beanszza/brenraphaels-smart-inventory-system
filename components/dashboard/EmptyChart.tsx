import { BarChart3 } from "lucide-react";

export function EmptyChart({ title, subtitle, message = "No records available for this period." }: { title: string; subtitle?: string; message?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6 flex flex-col justify-between">
      <div>
        <h3 className="type-card-title text-ink">{title}</h3>
        {subtitle && <p className="type-caption text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="flex items-center justify-center size-10 rounded-control bg-subtle mb-3">
          <BarChart3 className="size-5 text-ink-muted" />
        </div>
        <p className="type-caption text-ink-muted max-w-xs">{message}</p>
      </div>
    </div>
  );
}
