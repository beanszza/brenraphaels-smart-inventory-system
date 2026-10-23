"use client";
import { StaffProvider } from "@/context/StaffContext";
import { AppShell } from "@/components/shared/AppShell";
import type { Module } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

export function RootShell({
  modules,
  staff,
  children,
}: {
  modules: Module[];
  staff: Staff;
  children: React.ReactNode;
}) {
  return (
    <StaffProvider staff={staff}>
      <AppShell modules={modules} staff={staff}>{children}</AppShell>
    </StaffProvider>
  );
}
