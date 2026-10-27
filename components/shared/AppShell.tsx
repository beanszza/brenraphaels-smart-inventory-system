"use client";

import React from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useMounted } from "@/hooks/use-mounted";
import type { Module } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

function MainContent({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar();
  const mounted = useMounted();

  // Use a stable class during SSR/hydration (matching defaultOpen=true).
  // After mount, switch to the dynamic value based on sidebar state.
  const marginClass = !mounted || open ? "md:ml-(--sidebar-width)" : "md:ml-0";

  return (
    <div
      className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ${marginClass}`}
    >
      {/* Top Header Shell */}
      <Header />

      {/* Main Canvas */}
      <main className="flex-1 w-full bg-background relative">
        {children}
      </main>
    </div>
  );
}

export function AppShell({
  modules,
  staff,
  children,
}: {
  modules: Module[];
  staff: Staff;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background text-foreground relative">
        {/* Sidebar Shell */}
        <Sidebar modules={modules} staff={staff} />

        {/* Content Area Container */}
        <MainContent>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}
