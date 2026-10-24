"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { prisma } from "@/lib/prisma";
import { PROD_REQ_INCLUDE, mapProductionRequest } from "@/lib/production/production-requests";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, positiveId, validateInput } from "@/lib/production/mutate";
import { notifyApprovalRequested, notifyRequester } from "@/lib/production/notify";
export async function getProductionRequest(idInput: string | number) {
    await requireModule("Production & Quality");
    return read(async () => {
        const id = positiveId(idInput);
        const prodReq = await prisma.productionRequests.findUnique({
            where: { ProdReqId: id },
            include: PROD_REQ_INCLUDE,
        });
        if (!prodReq) {
            return refuse("Production request not found.");
        }
        return resourceResult({ success: true, data: mapProductionRequest(prodReq) });
    });
}
export async function updateProductionRequest(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        if (body.action !== undefined && !["submit_approval", "approve", "reject", "cancel"].includes(body.action))
            refuse("Invalid production request action.");
        if (body.quantity !== undefined && body.quantity <= 0)
            refuse("Quantity must be greater than zero.");
        const action = body.action; // 'submit_approval' | 'approve' | 'reject' | 'cancel' | undefined
        const existing = await tx.productionRequests.findUnique({
            where: { ProdReqId: id },
            include: {
                ProductionReqLotReservations: true,
                Recipes: {
                    include: {
                        RecipeIngredients: true,
                    },
                },
            },
        });
        if (!existing) {
            return refuse("Production request not found.");
        }
        await (async () => {
            // ── SUBMIT FOR APPROVAL ────────────────────────────────────────────────
            if (action === "submit_approval") {
                if (existing.Status !== "Draft") {
                    refuse(`Cannot submit request in '${existing.Status}' status for approval.`);
                }
                const req = await tx.productionRequests.update({
                    where: { ProdReqId: id },
                    data: {
                        Status: "Pending Approval",
                        UpdatedAt: new Date(),
                    },
                });
                await tx.approvalRequests.create({
                    data: {
                        EntityType: "ProductionRequest",
                        EntityId: id,
                        DocumentNumber: existing.ReqNumber,
                        Amount: 0,
                        Status: "Pending",
                        Reason: existing.Reason || "Production Request Approval",
                        RequestedBy: staff.username,
                        RequestedAt: new Date(),
                    },
                });
                return req;
            }
            // ── ADMIN APPROVE ──────────────────────────────────────────────────────
            if (action === "approve") {
                if (existing.Status !== "Pending Approval") {
                    refuse(`Only requests in 'Pending Approval' can be approved. Current: ${existing.Status}`);
                }
                const req = await tx.productionRequests.update({
                    where: { ProdReqId: id },
                    data: {
                        Status: "Approved",
                        ApprovedBy: staff.username,
                        ApprovedAt: new Date(),
                        AdminNotes: body.adminNotes ?? existing.AdminNotes,
                        UpdatedAt: new Date(),
                    },
                });
                // Update ApprovalRequests if exists
                await tx.approvalRequests.updateMany({
                    where: {
                        EntityType: "ProductionRequest",
                        EntityId: id,
                        Status: "Pending",
                    },
                    data: {
                        Status: "Approved",
                        ApproverId: staff.username,
                        ApproverName: staff.name,
                        ActionAt: new Date(),
                        Comments: body.adminNotes || "Approved",
                    },
                });
                return req;
            }
            // ── ADMIN REJECT ───────────────────────────────────────────────────────
            if (action === "reject") {
                if (existing.Status !== "Pending Approval") {
                    refuse(`Only requests in 'Pending Approval' can be rejected. Current: ${existing.Status}`);
                }
                const reason = body.rejectionReason || "Requirements not met";
                // Release lot reservations
                for (const res of existing.ProductionReqLotReservations) {
                    if (!res.IsReleased) {
                        const lot = await tx.inventoryLots.findUnique({ where: { LotId: res.LotId } });
                        const currentReserved = Number(lot?.ReservedQuantity || 0);
                        const toDeduct = Number(res.ReservedQuantity);
                        const safeReserved = Math.max(0, currentReserved - toDeduct);
                        await tx.inventoryLots.update({
                            where: { LotId: res.LotId },
                            data: { ReservedQuantity: safeReserved },
                        });
                        await tx.productionReqLotReservations.update({
                            where: { ReservationId: res.ReservationId },
                            data: { IsReleased: true, ReleasedAt: new Date() },
                        });
                    }
                }
                const req = await tx.productionRequests.update({
                    where: { ProdReqId: id },
                    data: {
                        Status: "Rejected",
                        RejectedBy: staff.username,
                        RejectedAt: new Date(),
                        RejectionReason: reason,
                        UpdatedAt: new Date(),
                    },
                });
                await tx.approvalRequests.updateMany({
                    where: {
                        EntityType: "ProductionRequest",
                        EntityId: id,
                        Status: "Pending",
                    },
                    data: {
                        Status: "Rejected",
                        ApproverId: staff.username,
                        ApproverName: staff.name,
                        ActionAt: new Date(),
                        Comments: reason,
                    },
                });
                return req;
            }
            // ── CANCEL ─────────────────────────────────────────────────────────────
            if (action === "cancel") {
                if (["Completed", "In Production", "Cancelled"].includes(existing.Status)) {
                    refuse(`Cannot cancel a request that is '${existing.Status}'.`);
                }
                // Release lot reservations
                for (const res of existing.ProductionReqLotReservations) {
                    if (!res.IsReleased) {
                        const lot = await tx.inventoryLots.findUnique({ where: { LotId: res.LotId } });
                        const currentReserved = Number(lot?.ReservedQuantity || 0);
                        const toDeduct = Number(res.ReservedQuantity);
                        const safeReserved = Math.max(0, currentReserved - toDeduct);
                        await tx.inventoryLots.update({
                            where: { LotId: res.LotId },
                            data: { ReservedQuantity: safeReserved },
                        });
                        await tx.productionReqLotReservations.update({
                            where: { ReservationId: res.ReservationId },
                            data: { IsReleased: true, ReleasedAt: new Date() },
                        });
                    }
                }
                // Cancel pending approval request if any
                await tx.approvalRequests.updateMany({
                    where: {
                        EntityType: "ProductionRequest",
                        EntityId: id,
                        Status: "Pending",
                    },
                    data: {
                        Status: "Cancelled",
                        ActionAt: new Date(),
                        Comments: "Request was cancelled by user.",
                    },
                });
                return await tx.productionRequests.update({
                    where: { ProdReqId: id },
                    data: {
                        Status: "Cancelled",
                        UpdatedAt: new Date(),
                    },
                });
            }
            // ── GENERAL EDIT (Draft only) ──────────────────────────────────────────
            if (existing.Status !== "Draft") {
                refuse("Only Draft requests can be edited.");
            }
            const updateData: any = {
                UpdatedAt: new Date(),
            };
            if (body.reason !== undefined)
                updateData.Reason = body.reason;
            if (body.priority !== undefined)
                updateData.Priority = body.priority === "Priority" ? "Priority" : "Normal";
            if (body.requiredDate !== undefined)
                updateData.RequiredDate = new Date(body.requiredDate);
            if (body.requiredTime !== undefined)
                updateData.RequiredTime = body.requiredTime;
            if (body.adminNotes !== undefined)
                updateData.AdminNotes = body.adminNotes;
            const newQty = body.quantity !== undefined ? Number(body.quantity) : Number(existing.Quantity);
            const newRecipeId = body.recipeId !== undefined ? Number(body.recipeId) : existing.RecipeId;
            if (newQty !== Number(existing.Quantity) || newRecipeId !== existing.RecipeId) {
                updateData.Quantity = newQty;
                updateData.RecipeId = newRecipeId;
                // Release old reservations
                for (const res of existing.ProductionReqLotReservations) {
                    if (!res.IsReleased) {
                        const lot = await tx.inventoryLots.findUnique({ where: { LotId: res.LotId } });
                        const currentReserved = Number(lot?.ReservedQuantity || 0);
                        const toDeduct = Number(res.ReservedQuantity);
                        const safeReserved = Math.max(0, currentReserved - toDeduct);
                        await tx.inventoryLots.update({
                            where: { LotId: res.LotId },
                            data: { ReservedQuantity: safeReserved },
                        });
                    }
                }
                await tx.productionReqLotReservations.deleteMany({
                    where: { ProdReqId: id },
                });
                // Re-allocate reservations
                const recipe = await tx.recipes.findUnique({
                    where: { RecipeId: newRecipeId },
                    include: { RecipeIngredients: true },
                });
                if (recipe) {
                    const multiplier = Number(recipe.OutputQuantity) > 0 ? newQty / Number(recipe.OutputQuantity) : 1;
                    for (const ing of recipe.RecipeIngredients) {
                        const requiredQty = Number(ing.StandardQuantity) * multiplier;
                        let stillNeeded = requiredQty;
                        const lots = await tx.inventoryLots.findMany({
                            where: {
                                ItemId: ing.ItemId,
                                Status: { in: ["Available", "Active"] },
                                QuantityRemaining: { gt: 0 },
                            },
                            orderBy: [{ ExpiryDate: "asc" }, { ReceivedDate: "asc" }],
                        });
                        for (const lot of lots) {
                            if (stillNeeded <= 0)
                                break;
                            const availableInLot = Math.max(0, Number(lot.QuantityRemaining) - Number(lot.ReservedQuantity || 0));
                            if (availableInLot <= 0)
                                continue;
                            const toReserve = Math.min(stillNeeded, availableInLot);
                            await tx.productionReqLotReservations.create({
                                data: {
                                    ProdReqId: id,
                                    IngredientId: ing.IngredientId,
                                    ItemId: ing.ItemId,
                                    LotId: lot.LotId,
                                    ReservedQuantity: toReserve,
                                    IsReleased: false,
                                },
                            });
                            await tx.inventoryLots.update({
                                where: { LotId: lot.LotId },
                                data: { ReservedQuantity: { increment: toReserve } },
                            });
                            stillNeeded -= toReserve;
                        }
                    }
                }
            }
            return await tx.productionRequests.update({
                where: { ProdReqId: id },
                data: updateData,
            });
        })();
        const fullResult = await tx.productionRequests.findUnique({
            where: { ProdReqId: id },
            include: PROD_REQ_INCLUDE,
        });
        return { result: resourceResult({
                success: true,
                message: `Production request updated successfully.`,
                data: mapProductionRequest(fullResult),
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-request", id, name: existing.ReqNumber }, description: `${staff.name} ${action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "submit_approval" ? "submitted for approval" : action === "cancel" ? "cancelled" : "updated"} production request ${existing.ReqNumber}` }, after: () => body.action === "submit_approval" ? notifyApprovalRequested(staff, existing.ReqNumber) : ["approve", "reject"].includes(body.action) ? notifyRequester(existing.RequestedBy, body.action === "approve" ? "approved" : "rejected", existing.ReqNumber) : Promise.resolve() };
    });
}
export async function deleteProductionRequest(idInput: string | number) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        const existing = await tx.productionRequests.findUnique({
            where: { ProdReqId: id },
            include: { ProductionReqLotReservations: true },
        });
        if (!existing) {
            return refuse("Production request not found.");
        }
        if (existing.Status !== "Draft") {
            return refuse(`Only Draft requests can be deleted. Current status: ${existing.Status}`);
        }
        await (async () => {
            // Release any reservations
            for (const res of existing.ProductionReqLotReservations) {
                if (!res.IsReleased) {
                    const lot = await tx.inventoryLots.findUnique({ where: { LotId: res.LotId } });
                    const currentReserved = Number(lot?.ReservedQuantity || 0);
                    const toDeduct = Number(res.ReservedQuantity);
                    const safeReserved = Math.max(0, currentReserved - toDeduct);
                    await tx.inventoryLots.update({
                        where: { LotId: res.LotId },
                        data: { ReservedQuantity: safeReserved },
                    });
                }
            }
            await tx.productionReqLotReservations.deleteMany({ where: { ProdReqId: id } });
            await tx.productionRequests.delete({ where: { ProdReqId: id } });
        })();
        return { result: resourceResult({ success: true, message: "Production request deleted." }), audit: { module: "Production & Quality", change: "deleted", target: { type: "production-request", id: id, name: String(id) }, description: `${staff.name} deleted production request (${String(id)})` } };
    });
}
