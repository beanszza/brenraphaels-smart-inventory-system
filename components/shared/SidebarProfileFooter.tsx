"use client";

import React, { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LOGOUT_PATH } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

export function SidebarProfileFooter({ staff }: { staff: Staff }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const initials = staff.name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-3 rounded-inner border border-border bg-surface p-2.5 shadow-none">
        <Avatar className="size-10 shrink-0 rounded-pill">
          <AvatarFallback className="bg-primary text-on-brand type-label-button font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate type-body-strong font-semibold leading-tight text-ink">{staff.name}</p>
          <p className="truncate type-caption leading-tight text-ink-muted">{staff.username}</p>
          <p className="truncate type-caption leading-tight text-ink-muted">{staff.email || "No email"}</p>
        </div>
      </div>
      <form action={LOGOUT_PATH} method="post" onSubmit={() => setLoggingOut(true)}>
        <Button type="submit" variant="outline" size="sm" className="w-full h-9 rounded-control type-label-button-sm cursor-pointer" disabled={loggingOut}>
          {loggingOut ? <Loader2 aria-hidden className="animate-spin size-4" /> : <LogOut aria-hidden className="size-4" />}
          {loggingOut ? "Logging out…" : "Log out"}
        </Button>
      </form>
    </div>
  );
}
