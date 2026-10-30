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

export function isQaStaff(staff?: Staff | null): boolean {
  if (!staff?.username) return false;
  const u = staff.username.toUpperCase();
  const email = (staff.email || "").toLowerCase();
  const name = (staff.name || "").toLowerCase();
  return (
    u === "2026-JP-008" ||
    u.includes("QA") ||
    email.includes("qualityassurance") ||
    email.includes("qa@") ||
    name.includes("quality assurance") ||
    false
  );
}

export function isImsManager(staff?: Staff | null): boolean {
  if (!staff?.username) return false;
  const u = staff.username.toUpperCase();
  const name = (staff.name || "").toLowerCase();
  const email = (staff.email || "").toLowerCase();
  return (
    u === "2026-VM-007" ||
    u.includes("IMS") ||
    u.includes("INVENTORY") ||
    name.includes("inventory manager") ||
    name.includes("vince neil") ||
    email.includes("madejavinceneil") ||
    false
  );
}

