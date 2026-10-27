import { MODULES, type Module } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

export type KnownStaffRecord = { staffId: string; name: string; username: string; modules: Module[] };

/** Where Known Staff is kept; replaced with a fake in tests. */
export interface KnownStaffStore {
  upsert(record: KnownStaffRecord): Promise<void>;
  holding(module: Module): Promise<KnownStaffRecord[]>;
}

const isModule = (value: string): value is Module => (MODULES as readonly string[]).includes(value);

/**
 * Records or refreshes a Staff member with the Modules they hold right now. Called at sign-in.
 * Known Staff only decides who to notify and never grants access.
 */
export async function recordKnownStaff(
  staff: Staff,
  modules: Module[],
  store: KnownStaffStore = prismaKnownStaff,
): Promise<void> {
  await store.upsert({ staffId: staff.id, name: staff.name, username: staff.username, modules });
}

/** Staff IMS has seen sign in who held the Module then; they may since have lost it. */
export async function knownStaffHolding(
  module: Module,
  store: KnownStaffStore = prismaKnownStaff,
): Promise<KnownStaffRecord[]> {
  return store.holding(module);
}

export const prismaKnownStaff: KnownStaffStore = {
  async upsert(record) {
    const { prisma } = await import("@/lib/prisma");
    const data = { Name: record.name, Username: record.username, Modules: record.modules, SeenAt: new Date() };
    await prisma.knownStaff.upsert({
      where: { StaffId: record.staffId },
      create: { StaffId: record.staffId, ...data },
      update: data,
    });
  },

  async holding(module) {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.knownStaff.findMany({ where: { Modules: { has: module } } });
    return rows.map((row) => ({
      staffId: row.StaffId,
      name: row.Name,
      username: row.Username,
      modules: row.Modules.filter(isModule),
    }));
  },
};
