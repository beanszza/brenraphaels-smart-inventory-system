import { BarChart3 } from "lucide-react";

export function EmptyChart({ title, subtitle, message = "No records available for this period." }: { title: string; subtitle?: string; message?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted mb-3">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
      </div>
    </div>
  );
}
