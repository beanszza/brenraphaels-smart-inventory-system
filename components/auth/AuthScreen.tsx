import Image from "next/image";
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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-10">
        <Image
          src="/images/bren-raphaels-logo.svg"
          alt="Bren Raphael's"
          width={56}
          height={56}
          unoptimized
          className="size-14 rounded-xl"
        />
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
          <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
        </div>
        {actions && (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">{actions}</div>
        )}
      </div>
    </main>
  );
}

const actionClass =
  "inline-flex h-11 w-full items-center justify-center rounded-lg px-5 text-sm font-medium transition-colors sm:w-auto";

export const primaryActionClass = `${actionClass} bg-primary text-primary-foreground hover:bg-primary/90`;
export const secondaryActionClass = `${actionClass} border border-border bg-background text-foreground hover:bg-accent`;
