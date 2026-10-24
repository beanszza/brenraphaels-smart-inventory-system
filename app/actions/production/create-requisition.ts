"use server";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { notifyApprovalRequested } from "@/lib/orders/notify";
import { mutate, refuse, positiveId } from "@/lib/production/mutate";
export async function createShortfallRequisition(idInput: string | number) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        const prodReq = await tx.productionRequests.findUnique({
            where: { ProdReqId: id },
            include: {
                Recipes: {
                    include: {
                        RecipeIngredients: {
                            include: {
                                Items: {
                                    include: {
                                        Uom: true,
                                        SupplierItems: {
                                            where: { IsActive: true },
                                            orderBy: { IsPreferred: "desc" },
                                        },
                                    },
                                },
                                Uom: true,
                            },
                        },
                    },
                },
            },
        });
        if (!prodReq) {
            return refuse("Production request not found.");
        }
        if (prodReq.LinkedPrId) {
            const existingPr = await tx.purchaseRequisitions.findUnique({
                where: { PrId: prodReq.LinkedPrId },
                include: {
                    PurchaseRequisitionItems: {
                        include: { Items: true },
                    },
                },
            });
            if (existingPr) {
                return { result: resourceResult({
                        success: true,
                        message: "Purchase Requisition already exists for this request.",
                        data: {
                            prId: existingPr.PrId,
                            prNumber: existingPr.PrNumber,
                            status: existingPr.Status,
                            estimatedTotal: Number(existingPr.EstimatedTotalAmount),
                            items: existingPr.PurchaseRequisitionItems.map((item) => ({
                                itemId: item.ItemId,
                                itemName: item.Items.ItemName,
                                requestedQuantity: Number(item.RequestedQuantity),
                                estimatedUnitPrice: Number(item.EstimatedUnitPrice),
                            })),
                        },
                    }) };
            }
        }
        const recipe = prodReq.Recipes;
        const multiplier = Number(recipe.OutputQuantity) > 0 ? Number(prodReq.Quantity) / Number(recipe.OutputQuantity) : 1;
        const shortfalls: Array<{
            itemId: number;
            itemName: string;
            itemCode: string;
            requestedQuantity: number;
            purchaseUomId: number;
            suggestedSupplierId: number | null;
            estimatedUnitPrice: number;
        }> = [];
        let estimatedTotal = 0;
        for (const ing of recipe.RecipeIngredients) {
            const requiredQty = Number(ing.StandardQuantity) * multiplier;
            // Available in lots
            const lots = await tx.inventoryLots.findMany({
                where: {
                    ItemId: ing.ItemId,
                    Status: { in: ["Available", "Active"] },
                    QuantityRemaining: { gt: 0 },
                },
            });
            const totalAvailable = lots.reduce((acc, lot) => {
                const available = Math.max(0, Number(lot.QuantityRemaining) - Number(lot.ReservedQuantity || 0));
                return acc + available;
            }, 0);
            const shortfallQty = Math.max(0, requiredQty - totalAvailable);
            if (shortfallQty > 0) {
                const preferredSupplierItem = ing.Items.SupplierItems[0];
                const supplierId = preferredSupplierItem?.SupplierId ?? null;
                const unitPrice = preferredSupplierItem ? Number(preferredSupplierItem.UnitPrice) : 0;
                const uomId = preferredSupplierItem?.PurchaseUomId ?? ing.UomId;
                const lineTotal = shortfallQty * unitPrice;
                estimatedTotal += lineTotal;
                shortfalls.push({
                    itemId: ing.ItemId,
                    itemName: ing.Items.ItemName,
                    itemCode: ing.Items.ItemCode,
                    requestedQuantity: Math.ceil(shortfallQty * 100) / 100,
                    purchaseUomId: uomId,
                    suggestedSupplierId: supplierId,
                    estimatedUnitPrice: unitPrice,
                });
            }
        }
        if (shortfalls.length === 0) {
            return refuse("No shortfalls detected. All ingredients have sufficient stock available.");
        }
        const reqDateNow = new Date();
        const year = reqDateNow.getFullYear();
        const seq = await tx.documentSequences.upsert({
            where: { DocType_Year: { DocType: "PurchaseRequisition", Year: year } },
            update: { LastNumber: { increment: 1 } },
            create: { DocType: "PurchaseRequisition", Year: year, LastNumber: 1 },
        });
        const prNumber = `PR-${year}-${String(seq.LastNumber).padStart(4, "0")}`;
        const createdPr = await (async () => {
            const pr = await tx.purchaseRequisitions.create({
                data: {
                    PrNumber: prNumber,
                    Department: "Production",
                    RequestedBy: staff.username,
                    RequestDate: reqDateNow,
                    RequiredDate: prodReq.RequiredDate || new Date(reqDateNow.getTime() + 7 * 86400000),
                    Status: "PendingApproval",
                    RequestType: "Production Shortfall",
                    Priority: prodReq.Priority === "Priority" ? "Urgent" : "Normal",
                    Purpose: `Material shortfall replenishment for ${prodReq.ReqNumber}`,
                    Notes: `Auto-generated for Production Request ${prodReq.ReqNumber}. Shortfall ingredients: ${shortfalls.map((s) => s.itemName).join(", ")}.`,
                    EstimatedTotalAmount: estimatedTotal,
                    UpdatedAt: reqDateNow,
                    PurchaseRequisitionItems: {
                        create: shortfalls.map((s) => ({
                            ItemId: s.itemId,
                            SuggestedSupplierId: s.suggestedSupplierId,
                            RequestedQuantity: s.requestedQuantity,
                            PurchaseUomId: s.purchaseUomId,
                            EstimatedUnitPrice: s.estimatedUnitPrice,
                        })),
                    },
                },
                include: {
                    PurchaseRequisitionItems: {
                        include: { Items: true },
                    },
                },
            });
            await tx.productionRequests.update({
                where: { ProdReqId: id },
                data: {
                    LinkedPrId: pr.PrId,
                },
            });
            return pr;
        })();
        return { result: resourceResult({
                success: true,
                message: `Purchase Requisition ${createdPr.PrNumber} created successfully for material shortfalls.`,
                data: {
                    prId: createdPr.PrId,
                    prNumber: createdPr.PrNumber,
                    status: createdPr.Status,
                    estimatedTotal: Number(createdPr.EstimatedTotalAmount),
                    items: createdPr.PurchaseRequisitionItems.map((item) => ({
                        itemId: item.ItemId,
                        itemName: item.Items.ItemName,
                        requestedQuantity: Number(item.RequestedQuantity),
                        estimatedUnitPrice: Number(item.EstimatedUnitPrice),
                    })),
                },
            }), audit: { module: "Production & Quality", change: "created", target: { type: "purchase-requisition", id: createdPr.PrId, name: createdPr.PrNumber }, description: `${staff.name} created shortfall requisition ${createdPr.PrNumber}` }, after: () => notifyApprovalRequested(staff, createdPr.PrNumber) };
    });
}
