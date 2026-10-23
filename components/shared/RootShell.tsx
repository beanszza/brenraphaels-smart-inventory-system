"use client";
import { AuthProvider } from "@/context/AuthContext";
import { AppShell } from "@/components/shared/AppShell";
import type { Module } from "@/lib/portal/config";

export function RootShell({
  modules,
  children,
}: {
  modules: Module[];
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppShell modules={modules}>{children}</AppShell>
    </AuthProvider>
  );
}
