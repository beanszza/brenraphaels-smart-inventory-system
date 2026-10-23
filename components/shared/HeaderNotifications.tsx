"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/context/AuthContext";
import { requestNotifications, type NotificationAction, type NotificationSnapshot } from "@/lib/notifications/client";

export function NotificationSkeletons() {
  return <div aria-hidden="true" className="space-y-sm p-sm">{[0, 1, 2].map((key) =>
    <div key={key} className="flex gap-sm"><Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-xs"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-full" /></div>
    </div>)}</div>;
}

export function HeaderNotifications() {
  const { user } = useAuth();
  return user ? <StaffNotifications key={user.id} /> : null;
}

function StaffNotifications() {
  const [snapshot, setSnapshot] = useState<NotificationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const request = useCallback(async (action: NotificationAction = { type: "list" }) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await requestNotifications(action);
      if (mounted.current) setSnapshot(data);
    } catch {
      if (mounted.current) setError(action.type === "list" ? "Could not load notifications. Please retry." : "Could not mark notifications as read. Please retry.");
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const initialRefresh = window.setTimeout(() => { void request(); }, 0);
    const onFocus = () => { void request(); };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(onFocus, 60000);
    return () => {
      mounted.current = false;
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [request]);

  const count = snapshot?.unreadCount ?? 0;
  return <Popover onOpenChange={(open) => { if (open) void request(); }}>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative w-8 h-8 cursor-pointer"
        aria-label={snapshot ? `Notifications, ${count} unread` : "Notifications"} title="Notifications">
        <Bell className="w-4 h-4" />
        {count > 0 && <Badge variant="notification" className="absolute -top-1 -right-1 min-w-4 h-4 px-1 text-[10px]" aria-hidden="true">{count > 99 ? "99+" : count}</Badge>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0" aria-label="Notifications">
      <div className="flex items-center justify-between p-sm border-b border-border">
        <h2 className="text-body-sm font-bold">Notifications</h2>
        <Button variant="ghost" size="sm" className="h-auto p-0 text-label-sm" disabled={loading || count === 0}
          onClick={() => void request({ type: "read-all" })}><CheckCheck /> Mark all read</Button>
      </div>
      {error && <div role="alert" className="p-sm text-label-sm"><p>{error}</p>
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => void request()}>Retry</Button></div>}
      <div className="max-h-80 overflow-y-auto" aria-busy={loading}>
        {loading && !snapshot ? <><span role="status" className="sr-only">Loading notifications</span><NotificationSkeletons /></> :
          snapshot?.notifications.length === 0 ? <div role="status"><NotificationSkeletons /><p className="px-sm pb-sm text-label-sm text-muted-foreground">You have no notifications.</p></div> :
          <ul className="divide-y divide-border">{snapshot?.notifications.map((n) => <li key={n.id}>
            <button type="button" disabled={loading || n.readAt !== null} onClick={() => void request({ type: "read", id: n.id })}
              aria-label={`${n.title}${n.readAt === null ? ", mark as read" : ", read"}`}
              className={`flex w-full items-start gap-sm p-sm text-left enabled:hover:bg-accent focus-visible:outline-ring ${n.readAt === null ? "bg-accent/40" : ""}`}>
              <div className="p-1.5 rounded-full bg-muted border border-border mt-0.5 shrink-0"><Bell className="w-3.5 h-3.5" /></div>
              <div className="flex-1 min-w-0 space-y-0.5"><p className="text-label-sm font-semibold break-words">{n.title}</p>
                <p className="text-label-sm text-muted-foreground break-words">{n.description}</p>
                <time dateTime={n.createdAt} className="text-label-sm text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</time>
                {n.readAt === null && <span className="sr-only">Unread</span>}
              </div>
            </button>
          </li>)}</ul>}
      </div>
      <span role="status" aria-live="polite" className="sr-only">{snapshot ? `${count} unread notifications` : ""}</span>
    </PopoverContent>
  </Popover>;
}
