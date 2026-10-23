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
      <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-background p-3 shadow-xs">
        <Avatar className="size-12 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-bold leading-tight text-foreground">{staff.name}</p>
          <p className="truncate text-xs leading-tight text-muted-foreground">{staff.username}</p>
          <p className="truncate text-xs leading-tight text-muted-foreground">{staff.email || "No email"}</p>
        </div>
      </div>
      <form action={LOGOUT_PATH} method="post" onSubmit={() => setLoggingOut(true)}>
        <Button type="submit" variant="outline" className="w-full" disabled={loggingOut}>
          {loggingOut ? <Loader2 aria-hidden className="animate-spin" /> : <LogOut aria-hidden />}
          {loggingOut ? "Logging out…" : "Log out"}
        </Button>
      </form>
    </div>
  );
}
