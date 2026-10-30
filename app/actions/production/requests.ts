"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { prisma } from "@/lib/prisma";
import { mapProductionRequest, PROD_REQ_INCLUDE } from "@/lib/production/production-requests";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, validateInput } from "@/lib/production/mutate";
import { notifyApprovalRequested } from "@/lib/production/notify";
export async function listProductionRequests(query = "") {
    await requireModule("Production & Quality");
    return read(async () => {
        const searchParams = new URLSearchParams(query);
        const status = searchParams.get("status") || "All";
        const priority = searchParams.get("priority") || "All";
        const search = searchParams.get("search")?.trim().toLowerCase() || "";
        const role = searchParams.get("role")?.toLowerCase() || "";
        const where: any = {};
        // Role-based visibility
        if (role === "head_cook") {
            where.Status = { in: ["Materials Issued", "In Production", "Completed"] };
        }
        if (status !== "All") {
            if (status === "Ready for Production") {
                where.Status = { in: ["Materials Issued", "Ready for Production"] };
            }
            else if (status === "In Progress") {
                where.Status = { in: ["In Production", "In Progress"] };
            }
            else {
                where.Status = status;
            }
        }
        if (priority !== "All") {
            if (priority === "High") {
                where.Priority = { in: ["High", "Priority"] };
            }
            else if (priority === "Medium") {
                where.Priority = { in: ["Medium", "Normal"] };
            }
            else if (priority === "Low") {
                where.Priority = "Low";
            }
            else {
                where.Priority = priority;
            }
        }
        if (search) {
            where.OR = [
                { ReqNumber: { contains: search, mode: "insensitive" } },
                { RequestedBy: { contains: search, mode: "insensitive" } },
                { FinishedProducts: { Items: { ItemName: { contains: search, mode: "insensitive" } } } },
                { Recipes: { RecipeName: { contains: search, mode: "insensitive" } } },
            ];
        }
        const requests = await prisma.productionRequests.findMany({
            where,
            include: PROD_REQ_INCLUDE,
            orderBy: [
                { Priority: "desc" }, // 'Priority' precedes 'Normal' alphabetically in DESC order
                { ProdReqId: "desc" },
            ],
        });
        return resourceResult({
            success: true,
            data: requests.map(mapProductionRequest),
        });
    });
}
export async function createProductionRequest(body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        validateInput(body);
        const productId = Number(body.productId);
        const recipeId = Number(body.recipeId);
        const quantity = Number(body.quantity);
        if (!productId || !recipeId || !quantity || quantity <= 0) {
            return refuse("Valid Product, Recipe, and positive Quantity are required.");
        }
        // Verify recipe and get output quantity and ingredients
        const recipe = await tx.recipes.findUnique({
            where: { RecipeId: recipeId },
            include: {
                RecipeIngredients: {
                    include: {
                        Items: true,
                        Uom: true,
                    },
                },
            },
        });
        if (!recipe) {
            return refuse("Recipe not found.");
        }
        const year = new Date().getFullYear();
        const seq = await tx.documentSequences.upsert({
            where: { DocType_Year: { DocType: "ProdReq", Year: year } },
            update: { LastNumber: { increment: 1 } },
            create: { DocType: "ProdReq", Year: year, LastNumber: 1 },
        });
        const reqNumber = `PRQ-${year}-${String(seq.LastNumber).padStart(4, "0")}`;
        const initialStatus = "Pending Approval";
        const multiplier = Number(recipe.OutputQuantity) > 0 ? quantity / Number(recipe.OutputQuantity) : 1;
        const rawPriority = body.priority || "Medium";
        const mappedPriority = ["Low", "Medium", "High"].includes(rawPriority)
            ? rawPriority
            : rawPriority === "Priority"
                ? "High"
                : "Medium";
        // Use transaction to create request and allocate FIFO/FEFO lot reservations
        const createdRequest = await (async () => {
            const prodReq = await tx.productionRequests.create({
                data: {
                    ReqNumber: reqNumber,
                    ProductId: productId,
                    RecipeId: recipeId,
                    Quantity: quantity,
                    Reason: body.reason || "",
                    Priority: mappedPriority,
                    RequiredDate: body.requiredDate ? new Date(body.requiredDate) : new Date(Date.now() + 86400000),
                    RequiredTime: body.requiredTime || "",
                    RequestedBy: staff.username,
                    Status: initialStatus,
                    AdminNotes: body.notes || "",
                },
            });
            // Allocate lot reservations per ingredient using FIFO/FEFO
            for (const ing of recipe.RecipeIngredients) {
                const requiredQty = Number(ing.StandardQuantity) * multiplier;
                let stillNeeded = requiredQty;
                // Query available lots
                const lots = await tx.inventoryLots.findMany({
                    where: {
                        ItemId: ing.ItemId,
                        Status: { in: ["Available", "Active"] },
                        QuantityRemaining: { gt: 0 },
                    },
                    orderBy: [
                        { ExpiryDate: "asc" },
                        { ReceivedDate: "asc" },
                    ],
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
                            ProdReqId: prodReq.ProdReqId,
                            IngredientId: ing.IngredientId,
                            ItemId: ing.ItemId,
                            LotId: lot.LotId,
                            ReservedQuantity: toReserve,
                            IsReleased: false,
                        },
                    });
                    await tx.inventoryLots.update({
                        where: { LotId: lot.LotId },
                        data: {
                            ReservedQuantity: { increment: toReserve },
                        },
                    });
                    stillNeeded -= toReserve;
                }
            }
            return prodReq;
        })();
        const fullProdReq = await tx.productionRequests.findUnique({
            where: { ProdReqId: createdRequest.ProdReqId },
            include: PROD_REQ_INCLUDE,
        });
        return {
            result: resourceResult({
                success: true,
                message: "Production request created successfully.",
                data: mapProductionRequest(fullProdReq),
            }),
            audit: {
                module: "Production & Quality",
                change: "created",
                target: { type: "production-request", id: createdRequest.ProdReqId, name: createdRequest.ReqNumber },
                description: `${staff.name} created production request (${createdRequest.ReqNumber})`,
            },
            after: async () => {
                if (initialStatus === "Pending Approval") {
                    try {
                        await prisma.approvalRequests.create({
                            data: {
                                EntityType: "ProductionRequest",
                                EntityId: createdRequest.ProdReqId,
                                DocumentNumber: createdRequest.ReqNumber,
                                Amount: 0,
                                Status: "Pending",
                                Reason: createdRequest.Reason || "Production Request Approval",
                                RequestedBy: staff.username,
                                RequestedAt: new Date(),
                            },
                        });
                    } catch (apprErr) {
                        console.warn("Optional ApprovalRequests record creation skipped:", apprErr);
                    }
                }
                await notifyApprovalRequested(staff, createdRequest.ReqNumber);
            },
        };
    });
}
