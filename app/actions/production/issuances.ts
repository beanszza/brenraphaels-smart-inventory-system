"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { prisma } from "@/lib/prisma";
import { mapMaterialIssuance, ISSUANCE_INCLUDE } from "@/lib/production/material-issuances";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, validateInput } from "@/lib/production/mutate";
export async function listIssuances(query = "") {
    await requireModule("Production & Quality");
    return read(async () => {
        const searchParams = new URLSearchParams(query);
        const status = searchParams.get("status") || "All";
        const prodReqId = searchParams.get("prodReqId");
        const search = searchParams.get("search")?.trim().toLowerCase() || "";
        const where: any = {};
        if (status !== "All") {
            where.Status = status;
        }
        if (prodReqId) {
            where.ProdReqId = Number(prodReqId);
        }
        if (search) {
            where.OR = [
                { IssuanceNumber: { contains: search, mode: "insensitive" } },
                { ProductionRequests: { ReqNumber: { contains: search, mode: "insensitive" } } },
                { ProductionRequests: { FinishedProducts: { Items: { ItemName: { contains: search, mode: "insensitive" } } } } },
            ];
        }
        const issuances = await prisma.materialIssuances.findMany({
            where,
            include: ISSUANCE_INCLUDE,
            orderBy: { IssuanceId: "desc" },
        });
        return resourceResult({
            success: true,
            data: issuances.map(mapMaterialIssuance),
        });
    });
}
export async function createIssuance(body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        validateInput(body);
        const prodReqId = Number(body.prodReqId);
        if (!prodReqId) {
            return refuse("Production Request ID is required.");
        }
        const prodReq = await tx.productionRequests.findUnique({
            where: { ProdReqId: prodReqId },
            include: {
                MaterialIssuances: true,
                ProductionReqLotReservations: true,
            },
        });
        if (!prodReq) {
            return refuse("Production request not found.");
        }
        if (prodReq.Status !== "Approved") {
            return refuse(`Only Approved requests can be issued. Current status: ${prodReq.Status}`);
        }
        // Check if there is already an active issuance
        const activeIssuance = prodReq.MaterialIssuances.find((i) => i.Status !== "Cancelled");
        if (activeIssuance) {
            const fullExisting = await tx.materialIssuances.findUnique({
                where: { IssuanceId: activeIssuance.IssuanceId },
                include: ISSUANCE_INCLUDE,
            });
            return { result: resourceResult({
                    success: true,
                    message: "Existing issuance session loaded.",
                    data: mapMaterialIssuance(fullExisting),
                }) };
        }
        const year = new Date().getFullYear();
        const seq = await tx.documentSequences.upsert({
            where: { DocType_Year: { DocType: "Issuance", Year: year } },
            update: { LastNumber: { increment: 1 } },
            create: { DocType: "Issuance", Year: year, LastNumber: 1 },
        });
        const issuanceNumber = `ISS-${year}-${String(seq.LastNumber).padStart(4, "0")}`;
        const newIssuance = await tx.materialIssuances.create({
            data: {
                IssuanceNumber: issuanceNumber,
                ProdReqId: prodReqId,
                IssuedBy: staff.username,
                Status: "Pending",
            },
            include: ISSUANCE_INCLUDE,
        });
        return { result: resourceResult({
                success: true,
                message: "Material issuance session initialized.",
                data: mapMaterialIssuance(newIssuance),
            }), audit: { module: "Production & Quality", change: "created", target: { type: "material-issuance", id: newIssuance.IssuanceId, name: newIssuance.IssuanceNumber }, description: `${staff.name} created material issuance (${newIssuance.IssuanceNumber})` } };
    });
}
