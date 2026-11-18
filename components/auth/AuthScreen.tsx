import { BrandLockup } from "@/components/brand/brand-lockup";
import type { ReactNode } from "react";

/** The shared frame of the sign-in screens: a centred card that fits a phone. */
export function AuthScreen({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-modal border border-border bg-surface p-6 text-center shadow-modal sm:p-10">
        <BrandLockup system="Enterprise Suite" />
        <div className="space-y-2">
          <h1 className="type-page-title text-ink">{title}</h1>
          <div className="space-y-3 type-body text-ink-secondary">{children}</div>
        </div>
        {actions && (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">{actions}</div>
        )}
      </div>
    </main>
  );
}

const actionClass =
"inline-flex h-10 w-full items-center justify-center gap-2 rounded-control px-4 type-label-button transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40 sm:w-auto";

export const primaryActionClass = `${actionClass} bg-primary text-primary-foreground hover:bg-primary-hover`;
export const secondaryActionClass = `${actionClass} border border-input bg-surface text-ink hover:bg-subtle`;
