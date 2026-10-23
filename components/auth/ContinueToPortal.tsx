"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { primaryActionClass } from "./AuthScreen";

/** Hands the browser on to the Portal; the link covers a blocked or failed script. */
export function ContinueToPortal({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);
  return (
    <div className="flex flex-col items-center gap-4">
      <Loader2 aria-hidden className="size-6 animate-spin text-primary" />
      {/* A full navigation: the login route sets a cookie and redirects off-site. */}
      <a href={href} className={primaryActionClass}>
        Continue to sign in
      </a>
    </div>
  );
}
