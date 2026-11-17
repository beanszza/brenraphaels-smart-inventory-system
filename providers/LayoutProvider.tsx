"use client";

import { SidebarProvider, useSharedTheme } from "@r3b2p/uilib";
import { Toaster } from "@/components/ui/sonner";

export default function LayoutProvider({ children }: { children: React.ReactNode }) {
  useSharedTheme();
  return (
    <SidebarProvider>
      {children}
      <Toaster />
    </SidebarProvider>
  );
}
