"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { ISSUANCE_INCLUDE, mapMaterialIssuance } from "@/lib/production/material-issuances";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
export async function issueMaterials(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const issuedBy = staff.username;
        const bypassScanCheck = Boolean(body.bypassScanCheck);
        const issuance = await tx.materialIssuances.findUnique({
            where: { IssuanceId: id },
            include: {
                MaterialIssuanceScans: true,
                ProductionRequests: {
                    include: {
                        ProductionReqLotReservations: {
                            where: { IsReleased: false },
                            include: {
                                InventoryLots: true,
                                Items: true,
                            },
                        },
                    },
                },
            },
        });
        if (!issuance) {
            return refuse("Material issuance not found.");
        }
        if (issuance.Status === "Issued") {
            return refuse("Materials have already been issued.");
        }
        const reservations = issuance.ProductionRequests.ProductionReqLotReservations;
        if (reservations.length === 0) {
            return refuse("No active lot reservations found for this request.");
        }
        // Verify all reservations have verified scans (unless bypass explicitly requested)
        if (!bypassScanCheck) {
            const verifiedLotIds = new Set(issuance.MaterialIssuanceScans.filter((s) => s.IsVerified).map((s) => s.LotId));
            const unscanned = reservations.filter((r) => !verifiedLotIds.has(r.LotId));
            if (unscanned.length > 0) {
                return refuse(`Cannot issue materials. ${unscanned.length} ingredient lot(s) have not been verified by QR scan yet.`);
            }
        }
        // Execute issuance transaction
        await (async () => {
            const now = new Date();
            for (const res of reservations) {
                const qtyToDeduct = Number(res.ReservedQuantity);
                const lot = res.InventoryLots;
                // 1. Decrement QuantityRemaining & ReservedQuantity on InventoryLots
                await tx.inventoryLots.update({
                    where: { LotId: lot.LotId },
                    data: {
                        QuantityRemaining: { decrement: qtyToDeduct },
                        ReservedQuantity: { decrement: qtyToDeduct },
                    },
                });
                // 2. Decrement CurrentStock on Inventories
                if (lot.LocationId) {
                    const inv = await tx.inventories.findUnique({
                        where: {
                            ItemId_LocationId: {
                                ItemId: res.ItemId,
                                LocationId: lot.LocationId,
                            },
                        },
                    });
                    if (inv) {
                        await tx.inventories.update({
                            where: {
                                ItemId_LocationId: {
                                    ItemId: res.ItemId,
                                    LocationId: lot.LocationId,
                                },
                            },
                            data: {
                                CurrentStock: { decrement: qtyToDeduct },
                            },
                        });
                    }
                }
                // 3. Create StockLedgers row
                await tx.stockLedgers.create({
                    data: {
                        LotId: lot.LotId,
                        ItemId: res.ItemId,
                        LocationId: lot.LocationId,
                        MovementType: "PRODUCTION_ISSUE",
                        Quantity: -qtyToDeduct,
                        UomId: lot.UomId,
                        UnitCost: lot.UnitCost,
                        ReferenceType: "MaterialIssuance",
                        ReferenceId: issuance.IssuanceNumber,
                        UserId: issuedBy,
                        UserName: staff.name,
                        PostedAt: now,
                        Notes: `Issued for Production Request ${issuance.ProductionRequests.ReqNumber}`,
                    },
                });
                // 4. Mark reservation as released
                await tx.productionReqLotReservations.update({
                    where: { ReservationId: res.ReservationId },
                    data: {
                        IsReleased: true,
                        ReleasedAt: now,
                    },
                });
            }
            // 5. Update MaterialIssuances
            await tx.materialIssuances.update({
                where: { IssuanceId: id },
                data: {
                    Status: "Issued",
                    IssuedAt: now,
                    IssuedBy: issuedBy,
                },
            });
            // 6. Update ProductionRequests status
            await tx.productionRequests.update({
                where: { ProdReqId: issuance.ProdReqId },
                data: {
                    Status: "Materials Issued",
                    UpdatedAt: now,
                },
            });
        })();
        const fullUpdated = await tx.materialIssuances.findUnique({
            where: { IssuanceId: id },
            include: ISSUANCE_INCLUDE,
        });
        return { result: resourceResult({
                success: true,
                message: `Materials issued successfully for ${issuance.ProductionRequests.ReqNumber}. The Head Cook can now start production.`,
                data: mapMaterialIssuance(fullUpdated),
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "material-issuance", id: id, name: String(id) }, description: `${staff.name} issued production materials (${String(id)})` } };
    });
}
