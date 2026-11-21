import { BarChart3 } from "lucide-react";

export function EmptyChart({
  title,
  subtitle,
  message = "No records available for this period.",
}: {
  title: string;
  subtitle?: string;
  message?: string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full">
      <div>
        <p className="type-caption font-medium text-ink-muted">{title}</p>
        {subtitle && (
          <h3 className="type-card-title text-ink mt-0.5 tracking-tight">
            {subtitle}
          </h3>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center py-8 px-4 text-center">
        <div className="flex items-center justify-center size-10 rounded-control bg-tint-soft mb-3">
          <BarChart3 className="size-5 text-primary" />
        </div>
        <p className="type-caption text-ink-muted max-w-xs">{message}</p>
      </div>
    </div>
  );
}
