"use client";

import React, { createContext, useContext } from "react";
import type { Staff } from "@/lib/portal/client";
import { isAdminStaff, isQaStaff, isImsManager } from "@/lib/auth-roles";

export { isAdminStaff, isQaStaff, isImsManager } from "@/lib/auth-roles";

const StaffContext = createContext<Staff | null>(null);

/** Carries the signed-in Staff the server shell already resolved. It grants nothing; Modules do. */
export function StaffProvider({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  return <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>;
}

export function useStaff(): Staff {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error("useStaff must be used within StaffProvider");
  return staff;
}

export function useIsAdmin(): boolean {
  const staff = useContext(StaffContext);
  return isAdminStaff(staff);
}

export function useIsQa(): boolean {
  const staff = useContext(StaffContext);
  return isQaStaff(staff);
}

export function useIsImsManager(): boolean {
  const staff = useContext(StaffContext);
  return isImsManager(staff);
}
