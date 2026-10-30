import type { Staff } from "@/lib/portal/client";

export function isAdminStaff(staff?: Staff | null): boolean {
  if (!staff?.username) return false;
  const u = staff.username.toUpperCase();
  const name = (staff.name || "").toLowerCase();
  const email = (staff.email || "").toLowerCase();
  return (
    u === "2026-ADMIN-001" ||
    u.includes("ADMIN") ||
    email.includes("admin@") ||
    email.includes("jude.nitram") ||
    name.includes("jude nitram") ||
    false
  );
}

export function isQaStaff(staff?: Staff | null): boolean {
  if (!staff?.username) return false;
  if (isAdminStaff(staff)) return false;
  const u = staff.username.toUpperCase();
  const email = (staff.email || "").toLowerCase();
  const name = (staff.name || "").toLowerCase();
  return (
    u === "2026-JP-008" ||
    u.includes("QA") ||
    email.includes("qualityassurance") ||
    email.includes("qa@") ||
    email.includes("alwinajocson") ||
    name.includes("quality assurance") ||
    name.includes("jo ann") ||
    name.includes("paglicawan") ||
    false
  );
}

export function isImsManager(staff?: Staff | null): boolean {
  if (!staff?.username) return false;
  if (isAdminStaff(staff)) return false;
  const u = staff.username.toUpperCase();
  const name = (staff.name || "").toLowerCase();
  const email = (staff.email || "").toLowerCase();
  return (
    u === "2026-VM-007" ||
    u.includes("IMS") ||
    name.includes("inventory manager") ||
    name.includes("vince neil") ||
    email.includes("madejavinceneil") ||
    false
  );
}

export function isHeadCook(staff?: Staff | null): boolean {
  if (!staff?.username) return false;
  if (isAdminStaff(staff)) return false;
  const u = staff.username.toUpperCase();
  const name = (staff.name || "").toLowerCase();
  const email = (staff.email || "").toLowerCase();
  return (
    u === "2026-BD-009" ||
    u.includes("COOK") ||
    u.includes("HEADCOOK") ||
    name.includes("head cook") ||
    name.includes("bren ralph") ||
    name.includes("bianca") ||
    name.includes("dela peña") ||
    name.includes("dela pena") ||
    email.includes("beansmadeja") ||
    email.includes("headcook") ||
    email.includes("brenralph") ||
    false
  );
}

