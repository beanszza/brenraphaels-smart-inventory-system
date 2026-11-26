import { afterEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { resolveFinishedGoodsLocation } from "@/lib/production/fg-location";

type FakeLocation = {
  LocationId: number;
  LocationName: string;
  LocationType: string;
  IsActive: boolean;
};

function makeTx(locations: FakeLocation[]) {
  return {
    locations: {
      findUnique: async ({ where }: { where: { LocationId: number } }) =>
        locations.find((loc) => loc.LocationId === where.LocationId) ?? null,
      findFirst: async ({ where }: { where?: { IsActive?: boolean; LocationType?: { contains: string } } } = {}) => {
        const filtered = locations
          .filter((loc) => (where?.IsActive === undefined ? true : loc.IsActive === where.IsActive))
          .filter((loc) =>
            where?.LocationType?.contains
              ? loc.LocationType.toLowerCase().includes(where.LocationType.contains.toLowerCase())
              : true,
          )
          .sort((a, b) => a.LocationId - b.LocationId);
        return filtered[0] ?? null;
      },
    },
  } as unknown as Prisma.TransactionClient;
}

const sampleLocations: FakeLocation[] = [
  { LocationId: 1, LocationName: "Raw Materials", LocationType: "Storage", IsActive: true },
  { LocationId: 2, LocationName: "Shop Warehouse", LocationType: "Warehouse", IsActive: true },
  { LocationId: 3, LocationName: "POS Branch", LocationType: "Branch", IsActive: true },
  { LocationId: 4, LocationName: "FG Room", LocationType: "Finished Goods", IsActive: true },
  { LocationId: 5, LocationName: "Inactive Warehouse", LocationType: "Warehouse", IsActive: false },
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveFinishedGoodsLocation", () => {
  it("uses explicit locationId when provided", async () => {
    vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", "2");
    const loc = await resolveFinishedGoodsLocation(makeTx(sampleLocations), 4);
    expect(loc?.LocationId).toBe(4);
  });

  it("uses IMS_SHOP_WAREHOUSE_ID when configured and active", async () => {
    vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", "2");
    const loc = await resolveFinishedGoodsLocation(makeTx(sampleLocations));
    expect(loc?.LocationId).toBe(2);
  });

  it("ignores IMS_SHOP_WAREHOUSE_ID if it points to a Branch or inactive location and falls back to Finished Goods", async () => {
    vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", "3");
    const fromBranch = await resolveFinishedGoodsLocation(makeTx(sampleLocations));
    expect(fromBranch?.LocationId).toBe(4);

    vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", "5");
    const fromInactive = await resolveFinishedGoodsLocation(makeTx(sampleLocations));
    expect(fromInactive?.LocationId).toBe(4);
  });

  it("falls back to Finished Goods location then first active location when IMS_SHOP_WAREHOUSE_ID is unset", async () => {
    vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", "");
    const fgLoc = await resolveFinishedGoodsLocation(makeTx(sampleLocations));
    expect(fgLoc?.LocationId).toBe(4);

    const noFg = sampleLocations.filter((loc) => loc.LocationId !== 4);
    const firstActive = await resolveFinishedGoodsLocation(makeTx(noFg));
    expect(firstActive?.LocationId).toBe(1);
  });
});
