"use client";

import { HeaderNotifications } from "./HeaderNotifications";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex justify-between items-center w-full gap-4 px-4 sm:px-6 h-(--layout-topbar) bg-surface border-b border-divider">
      <SidebarTrigger className="size-8 shrink-0 rounded-control hover:bg-subtle text-ink transition-all cursor-pointer" />
      <div className="flex-1" />
      <div className="flex items-center gap-1 shrink-0">
        <HeaderNotifications />
      </div>
    </header>
  );
}
