import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedPosRequest } from "@/lib/pos/auth";
import { notifyBranchStockRequestReceived } from "@/lib/stock-transfer/notify";
import { ensureBranchRequestColumns } from "@/lib/stock-transfer/ensure-branch-request-tables";

function formatImsRequestId(branchRequestId: number): string {
  return `br_${branchRequestId}`;
}

function hasAngleBrackets(value: string): boolean {
  return /[<>]/.test(value);
}

function normalizeTokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Matches an incoming POS item to an IMS FinishedProducts record.
 * 1. Exact case-insensitive match on FinishedProducts.Sku
 * 2. Synthetic SKU-<ProductId> fallback
 * 3. Match via POS productId (Items.ItemCode / SCM-PRD-<id>) or exact Items.ItemName + variant/SKU tokens
 *    (handles minor SKU format differences like UHJ-250G-CONTAINER vs UHJ-CON-250G while still rejecting unknown items)
 */
async function resolveFinishedProduct(
  sku: string,
  posProductId: string | null,
  productName: string,
  variationName: string
) {
  // 1. Canonical SKU match
  const byExactSku = await prisma.finishedProducts.findFirst({
    where: { Sku: { equals: sku, mode: "insensitive" } },
    include: { Items: true },
  });
  if (byExactSku) return byExactSku;

  // 2. Fallback for synthetic SKU-<id>
  const synthSkuMatch = /^SKU-(\d+)$/i.exec(sku);
  if (synthSkuMatch && typeof prisma.finishedProducts.findUnique === "function") {
    const byId = await prisma.finishedProducts.findUnique({
      where: { ProductId: Number(synthSkuMatch[1]) },
      include: { Items: true },
    });
    if (byId) return byId;
  }

  // 3. Fallback via productId (ItemCode or SCM-PRD-XXXX) or exact ItemName + variant token match
  if (typeof prisma.finishedProducts.findMany !== "function") return null;

  const candidateOr: Array<Record<string, unknown>> = [];
  if (posProductId) {
    candidateOr.push({ Items: { ItemCode: { equals: posProductId, mode: "insensitive" } } });
    const scmIdMatch = /^SCM-PRD-0*(\d+)$/i.exec(posProductId);
    if (scmIdMatch) {
      candidateOr.push({ ProductId: Number(scmIdMatch[1]) });
    }
  }
  if (productName) {
    candidateOr.push({ Items: { ItemName: { equals: productName, mode: "insensitive" } } });
  }
  if (candidateOr.length === 0) return null;

  const candidates = await prisma.finishedProducts.findMany({
    where: { OR: candidateOr },
    include: { Items: true },
  });
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Score candidates by shared tokens between incoming (variationName + sku) and IMS (Variant + Sku)
  const incomingTokens = new Set([
    ...normalizeTokens(variationName),
    ...normalizeTokens(sku),
  ]);
  let best = candidates[0];
  let bestScore = -1;
  for (const cand of candidates) {
    const candTokens = normalizeTokens(`${cand.Variant || ""} ${cand.Sku || ""}`);
    const score = candTokens.filter((t) => incomingTokens.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return bestScore > 0 ? best : null;
}

/**
 * POST /api/pos/stock-requests
 * Receives a branch stock replenishment request from POS (§3.1).
 * Idempotent on `requestId` (e.g. SR-000123): duplicate retries return 200 with the original body.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedPosRequest(req)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Invalid or missing SCMS API key." },
        { status: 401 }
      );
    }

    await ensureBranchRequestColumns();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body provided." },
        { status: 400 }
      );
    }

    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    if (!requestId || requestId.length > 50) {
      return NextResponse.json(
        { success: false, message: "requestId is required and must be at most 50 characters." },
        { status: 400 }
      );
    }

    // Idempotency check: same requestId already received -> 200 with same payload
    const existing = await prisma.branchRequests.findUnique({
      where: { RequestNumber: requestId },
      select: { BranchRequestId: true, RequestNumber: true, Status: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          success: true,
          data: {
            requestId: existing.RequestNumber,
            imsRequestId: formatImsRequestId(existing.BranchRequestId),
            status: "Submitted",
          },
        },
        { status: 200 }
      );
    }

    const branchIdRaw = body.branch?.branchId;
    const branchName = typeof body.branch?.branchName === "string" ? body.branch.branchName.trim() : "";
    if (branchIdRaw === undefined || branchIdRaw === null || String(branchIdRaw).trim() === "" || !branchName) {
      return NextResponse.json(
        { success: false, message: "branch.branchId and branch.branchName are required." },
        { status: 400 }
      );
    }

    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (!notes || notes.length > 500 || hasAngleBrackets(notes)) {
      return NextResponse.json(
        { success: false, message: "notes is required (1-500 characters) and must not contain '<' or '>'." },
        { status: 400 }
      );
    }

    const requestedBy = typeof body.requestedBy === "string" ? body.requestedBy.trim() : "";
    const requestedByName = typeof body.requestedByName === "string" ? body.requestedByName.trim() : "";
    if (!requestedBy || !requestedByName) {
      return NextResponse.json(
        { success: false, message: "requestedBy and requestedByName are required." },
        { status: 400 }
      );
    }

    const requestedAtRaw = typeof body.requestedAt === "string" ? body.requestedAt.trim() : "";
    const requestedAt = requestedAtRaw ? new Date(requestedAtRaw) : null;
    if (!requestedAt || Number.isNaN(requestedAt.getTime())) {
      return NextResponse.json(
        { success: false, message: "requestedAt must be a valid ISO 8601 UTC date string." },
        { status: 400 }
      );
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "items must be a non-empty array." },
        { status: 400 }
      );
    }

    // Resolve branch in IMS Locations
    const parsedBranchId = Number(branchIdRaw);
    let location =
      Number.isInteger(parsedBranchId) && parsedBranchId > 0
        ? await prisma.locations.findUnique({ where: { LocationId: parsedBranchId } })
        : null;

    if (!location) {
      location = await prisma.locations.findFirst({
        where: { LocationName: { equals: branchName, mode: "insensitive" } },
      });
    }

    if (!location) {
      return NextResponse.json(
        { success: false, message: `Branch "${branchName}" (id ${branchIdRaw}) is not registered in IMS.` },
        { status: 400 }
      );
    }

    // Validate & match each requested item by canonical SKU
    const resolvedItems: Array<{
      productId: number;
      sku: string;
      productName: string;
      variationName: string;
      posProductId: string | null;
      quantity: number;
      currentStock: number;
    }> = [];

    for (let i = 0; i < rawItems.length; i++) {
      const it = rawItems[i];
      const sku = typeof it?.sku === "string" ? it.sku.trim() : "";
      const productName = typeof it?.productName === "string" ? it.productName.trim() : "";
      const variationName = typeof it?.variationName === "string" ? it.variationName.trim() : "";
      const quantity = Number(it?.quantity);
      const currentStock = Number(it?.currentStock);

      if (!sku) {
        return NextResponse.json(
          { success: false, message: `items[${i}].sku is required.` },
          { status: 400 }
        );
      }
      if (!productName) {
        return NextResponse.json(
          { success: false, message: `items[${i}].productName is required.` },
          { status: 400 }
        );
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
        return NextResponse.json(
          { success: false, message: `items[${i}].quantity must be a whole number between 1 and 10000.` },
          { status: 400 }
        );
      }
      if (!Number.isInteger(currentStock) || currentStock < 0) {
        return NextResponse.json(
          { success: false, message: `items[${i}].currentStock must be a non-negative whole number.` },
          { status: 400 }
        );
      }

      const posProductId =
        typeof it?.productId === "string" && it.productId.trim() ? it.productId.trim() : null;

      const matchedProduct = await resolveFinishedProduct(
        sku,
        posProductId,
        productName,
        variationName
      );

      if (!matchedProduct) {
        return NextResponse.json(
          { success: false, message: `items[${i}].sku ${sku} is not an IMS product.` },
          { status: 400 }
        );
      }

      resolvedItems.push({
        productId: matchedProduct.ProductId,
        // Preserve the exact SKU POS sent so dispatch manifests match POS §3.3 validation
        sku: sku || matchedProduct.Sku,
        productName: productName || matchedProduct.Items?.ItemName || "Finished Product",
        variationName: variationName || matchedProduct.Variant || "",
        posProductId,
        quantity,
        currentStock,
      });
    }

    // Create BranchRequest + items (handle unique race cleanly for concurrent POS retries)
    let created;
    try {
      created = await prisma.branchRequests.create({
        data: {
          RequestNumber: requestId,
          BranchId: location.LocationId,
          BranchName: branchName || location.LocationName,
          RequestDate: requestedAt,
          Status: "Submitted",
          RequestedBy: requestedBy,
          RequestedByName: requestedByName,
          Notes: notes,
          PosSyncStatus: "Synced",
          BranchRequestItems: {
            create: resolvedItems.map((ri) => ({
              ProductId: ri.productId,
              Sku: ri.sku,
              ProductName: ri.productName,
              VariationName: ri.variationName,
              PosProductId: ri.posProductId,
              BranchCurrentStock: ri.currentStock,
              RequestedQuantity: ri.quantity,
              ApprovedQuantity: 0,
              DispatchedQuantity: 0,
              ReceivedQuantity: 0,
            })),
          },
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        const raced = await prisma.branchRequests.findUnique({
          where: { RequestNumber: requestId },
          select: { BranchRequestId: true, RequestNumber: true },
        });
        if (raced) {
          return NextResponse.json(
            {
              success: true,
              data: {
                requestId: raced.RequestNumber,
                imsRequestId: formatImsRequestId(raced.BranchRequestId),
                status: "Submitted",
              },
            },
            { status: 200 }
          );
        }
      }
      throw err;
    }

    // Best-effort real-time notification to Stock Transfer module staff (no polling)
    const itemSummary = resolvedItems
      .map((i) => `${i.productName}${i.variationName ? ` (${i.variationName})` : ""} ×${i.quantity}`)
      .join(", ");
    await notifyBranchStockRequestReceived(requestId, branchName || location.LocationName, itemSummary).catch(
      (notifyErr) => console.error("[POS-STOCK-REQUEST-NOTIFY-ERROR]", notifyErr)
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          requestId: created.RequestNumber,
          imsRequestId: formatImsRequestId(created.BranchRequestId),
          status: "Submitted",
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[POS-STOCK-REQUEST-ERROR]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error processing stock request." },
      { status: 500 }
    );
  }
}
