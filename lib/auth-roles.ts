import type { Staff } from "@/lib/portal/client";

export function isAdminStaff(staff?: Staff | null): boolean {
  if (!staff?.username) return false;
  const u = staff.username.toUpperCase();
  return (
    u === "2026-ADMIN-001" ||
    u.includes("ADMIN") ||
    staff.email?.toLowerCase().includes("admin@") ||
    false
  );
}
