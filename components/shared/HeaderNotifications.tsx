"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStaff } from "@/context/StaffContext";
import { requestNotifications, type NotificationAction, type NotificationSnapshot } from "@/lib/notifications/client";
import { getMyNotificationLiveTicket } from "@/app/actions/notifications";
import { applyLiveEvent, needsLiveRefresh, startLiveNotifications, type LiveEvent } from "@/lib/notifications/live";

export function NotificationSkeletons() {
  return (
    <div aria-hidden="true" className="space-y-3 p-3">
      {[0, 1, 2].map((key) => (
        <div key={key} className="flex gap-3">
          <Skeleton className="size-8 rounded-pill" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3 rounded-sm" />
            <Skeleton className="h-3 w-full rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeaderNotifications() {
  const staff = useStaff();
  return <StaffNotifications key={staff.id} />;
}

function StaffNotifications() {
  const [snapshot, setSnapshot] = useState<NotificationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const refreshPending = useRef(false);
  const confirmed = useRef<NotificationSnapshot | null>(null);
  const mounted = useRef(false);
  const request = useCallback(async function execute(action: NotificationAction = { type: "list" }) {
    if (busy.current) {
      if (action.type === "list") refreshPending.current = true;
      return;
    }
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await requestNotifications(action);
      if (mounted.current) {
        confirmed.current = data;
        setSnapshot(data);
      }
    } catch {
      if (mounted.current) setError(action.type === "list" ? "Could not load notifications. Please retry." : "Could not mark notifications as read. Please retry.");
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
      if (mounted.current && refreshPending.current) {
        refreshPending.current = false;
        void execute();
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const initialRefresh = window.setTimeout(() => { void request(); }, 0);
    const onEvent = (event: LiveEvent) => {
      if (!mounted.current) return;
      if (event.type === "notification.created") {
        toast.info(event.notification.title, {
          description: event.notification.body,
        });
      }
      // A push received during REST may be newer than its response. Re-fetch after
      // that response instead of applying a push which the response could erase.
      if (busy.current || !confirmed.current) { void request(); return; }
      const previous = confirmed.current;
      const next = applyLiveEvent(previous, event);
      confirmed.current = next;
      setSnapshot(next);
      if (needsLiveRefresh(previous, event)) {
        void request();
      }
    };
    const stopLive = startLiveNotifications({
      getTicket: getMyNotificationLiveTicket,
      onCreated: (notification) => onEvent({ type: "notification.created", notification }),
      onRead: (ids) => onEvent({ type: "notifications.read", ids }),
      onSync: () => { void request(); },
    });
    return () => {
      mounted.current = false;
      window.clearTimeout(initialRefresh);
      stopLive();
    };
  }, [request]);

  const count = snapshot?.unreadCount ?? 0;
  return <Popover onOpenChange={(open) => { if (open) void request(); }}>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" className="text-ink-muted hover:text-ink relative size-8 cursor-pointer"
        aria-label={snapshot ? `Notifications, ${count} unread` : "Notifications"} title="Notifications">
        <Bell className="size-4" />
        {count > 0 && <Badge variant="notification" className="absolute -top-1 -right-1 min-w-4 h-4 px-1 type-badge-compact" aria-hidden="true">{count > 99 ? "99+" : count}</Badge>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0 rounded-inner shadow-modal bg-surface border border-border" aria-label="Notifications">
      <div className="flex items-center justify-between p-3 border-b border-divider">
        <h2 className="type-card-title text-ink font-semibold">Notifications</h2>
        <Button variant="ghost" size="sm" className="h-auto p-0 type-label-button-sm text-primary hover:text-primary-hover" disabled={loading || count === 0}
          onClick={() => void request({ type: "read-all" })}><CheckCheck className="size-4" /> Mark all read</Button>
      </div>
      {error && <div role="alert" className="p-3 type-caption text-semantic-danger"><p>{error}</p>
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => void request()}>Retry</Button></div>}
      <div className="max-h-80 overflow-y-auto" aria-busy={loading}>
        {loading && !snapshot ? <><span role="status" className="sr-only">Loading notifications</span><NotificationSkeletons /></> :
          snapshot?.notifications.length === 0 ? (
            <div role="status" className="p-6 text-center text-ink-muted space-y-1">
              <Bell className="size-6 mx-auto opacity-30" />
              <p className="type-body-secondary font-medium text-ink-muted">You have no notifications.</p>
            </div>
          ) :
          <ul className="divide-y divide-divider">{snapshot?.notifications.map((n) => <li key={n.id}>
            <button type="button" disabled={loading || n.readAt !== null} onClick={() => void request({ type: "read", id: n.id })}
              aria-label={`${n.title}${n.readAt === null ? ", mark as read" : ", read"}`}
              className={`flex w-full items-start gap-2.5 p-3 text-left enabled:hover:bg-subtle focus-visible:outline-focus ${n.readAt === null ? "bg-subtle/50" : ""}`}>
              <div className="p-1.5 rounded-pill bg-subtle border border-border mt-0.5 shrink-0"><Bell className="size-3.5 text-ink-secondary" /></div>
              <div className="flex-1 min-w-0 space-y-0.5"><p className="type-body-strong text-ink font-semibold break-words">{n.title}</p>
                <p className="type-body-secondary text-ink-secondary break-words">{n.description}</p>
                <time dateTime={n.createdAt} className="type-caption text-ink-muted">{new Date(n.createdAt).toLocaleString()}</time>
                {n.readAt === null && <span className="sr-only">Unread</span>}
              </div>
            </button>
          </li>)}</ul>}
      </div>
      <span role="status" aria-live="polite" className="sr-only">{snapshot ? `${count} unread notifications` : ""}</span>
    </PopoverContent>
  </Popover>;
}
