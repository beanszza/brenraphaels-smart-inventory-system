"use server";
import { prisma } from "@/lib/prisma";
import { ISSUANCE_INCLUDE, mapMaterialIssuance } from "@/lib/production/material-issuances";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, refuse, positiveId } from "@/lib/production/mutate";
export async function getIssuance(idInput: string | number) {
    await requireModule("Production & Quality");
    return read(async () => {
        const id = positiveId(idInput);
        const issuance = await prisma.materialIssuances.findUnique({
            where: { IssuanceId: id },
            include: ISSUANCE_INCLUDE,
        });
        if (!issuance) {
            return refuse("Material issuance not found.");
        }
        return resourceResult({ success: true, data: mapMaterialIssuance(issuance) });
    });
}
