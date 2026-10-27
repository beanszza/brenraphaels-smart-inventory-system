"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
export async function scanIssuance(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const qrRaw = body.qrRaw?.toString().trim();
        const ingredientId = Number(body.ingredientId);
        const scannedBy = staff.username;
        if (!qrRaw) {
            return refuse("QR payload is required.");
        }
        const issuance = await tx.materialIssuances.findUnique({
            where: { IssuanceId: id },
            include: {
                ProductionRequests: {
                    include: {
                        ProductionReqLotReservations: {
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
            return refuse("This issuance has already been completed.");
        }
        // Parse QR payload (from Goods & Receiving Stock-In / Put-Away QR code)
        let scannedLotCode = qrRaw;
        try {
            const parsed = typeof qrRaw === "object" ? qrRaw : JSON.parse(qrRaw);
            if (parsed.lot)
                scannedLotCode = String(parsed.lot).trim();
            else if (parsed.lotCode)
                scannedLotCode = String(parsed.lotCode).trim();
            else if (parsed.lot_code)
                scannedLotCode = String(parsed.lot_code).trim();
            else if (parsed.lotNo)
                scannedLotCode = String(parsed.lotNo).trim();
            else if (parsed.code)
                scannedLotCode = String(parsed.code).trim();
        }
        catch {
            // Not JSON, use raw string as lot code
            scannedLotCode = qrRaw.trim();
        }
        // Find the allocated reservation in this issuance that matches the scanned lot code
        const matchingReservation = issuance.ProductionRequests.ProductionReqLotReservations.find((res) => {
            const lotMatch = res.InventoryLots.LotCode.trim().toLowerCase() === scannedLotCode.trim().toLowerCase();
            const ingMatch = !ingredientId || res.IngredientId === ingredientId;
            return lotMatch && ingMatch;
        }) ||
            issuance.ProductionRequests.ProductionReqLotReservations.find((res) => {
                return res.InventoryLots.LotCode.trim().toLowerCase() === scannedLotCode.trim().toLowerCase();
            });
        if (!matchingReservation) {
            return refuse(`Verification failed. Lot code '${scannedLotCode}' is not assigned to this ingredient or request.`);
        }
        // Record the verified scan
        const scan = await (async () => {
            // Upsert scan
            const existingScan = await tx.materialIssuanceScans.findFirst({
                where: {
                    IssuanceId: id,
                    IngredientId: matchingReservation.IngredientId,
                    LotId: matchingReservation.LotId,
                },
            });
            let recordedScan;
            if (existingScan) {
                recordedScan = await tx.materialIssuanceScans.update({
                    where: { ScanId: existingScan.ScanId },
                    data: {
                        IsVerified: true,
                        ScannedAt: new Date(),
                        ScannedBy: scannedBy,
                    },
                });
            }
            else {
                recordedScan = await tx.materialIssuanceScans.create({
                    data: {
                        IssuanceId: id,
                        IngredientId: matchingReservation.IngredientId,
                        ItemId: matchingReservation.ItemId,
                        LotId: matchingReservation.LotId,
                        LotCode: matchingReservation.InventoryLots.LotCode,
                        ScannedAt: new Date(),
                        ScannedBy: scannedBy,
                        IsVerified: true,
                    },
                });
            }
            if (issuance.Status === "Pending") {
                await tx.materialIssuances.update({
                    where: { IssuanceId: id },
                    data: { Status: "Scanning" },
                });
            }
            return recordedScan;
        })();
        return { result: resourceResult({
                success: true,
                verified: true,
                message: `Verified: ${matchingReservation.Items.ItemName} (Lot: ${matchingReservation.InventoryLots.LotCode})`,
                data: {
                    scanId: scan.ScanId,
                    ingredientId: matchingReservation.IngredientId,
                    lotId: matchingReservation.LotId,
                    lotCode: matchingReservation.InventoryLots.LotCode,
                    itemName: matchingReservation.Items.ItemName,
                },
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "material-issuance", id: id, name: String(id) }, description: `${staff.name} verified material lot for issuance (${String(id)})` } };
    });
}
