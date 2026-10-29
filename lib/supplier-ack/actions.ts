"use server";

import { prisma } from "@/lib/prisma";
import { PO_INCLUDE, poDto } from "@/lib/orders/dto";
import { revalidatePath } from "next/cache";

export interface SupplierAckInput {
  supplierApprovedBy: string;
  supplierApprovedDate: string;
  expectedArrivalDate?: string;
  notes?: string;
  items: {
    itemId: number;
    confirmedQuantity: number;
    unitPrice: number;
  }[];
}

/**
 * Public server action to retrieve a Purchase Order by PO Number for the supplier acknowledgment form.
 * Does not require internal IMS staff session.
 */
export async function getPurchaseOrderForAck(poNumber: string) {
  try {
    if (!poNumber) {
      return { success: false, message: "Purchase Order number is required." };
    }

    const order = await prisma.purchaseOrders.findFirst({
      where: {
        PoNumber: {
          equals: poNumber.trim(),
          mode: "insensitive",
        },
      },
      include: PO_INCLUDE,
    });

    if (!order) {
      return { success: false, message: `Purchase Order "${poNumber}" not found.` };
    }

    return {
      success: true,
      data: poDto(order),
    };
  } catch (error: any) {
    console.error("Failed to load purchase order for acknowledgment:", error);
    return { success: false, message: error?.message || "Failed to load Purchase Order." };
  }
}

/**
 * Public action for suppliers to submit their accommodation, pricing, and confirmation.
 * Updates items' quantities, unit prices, and stores approval metadata in AdminNotes.
 */
export async function submitSupplierAcknowledgment(poNumber: string, input: SupplierAckInput) {
  try {
    if (!poNumber) {
      return { success: false, message: "Purchase Order number is required." };
    }

    if (!input.supplierApprovedBy?.trim()) {
      return { success: false, message: "Authorized Approver Name is required." };
    }

    if (!input.supplierApprovedDate) {
      return { success: false, message: "Confirmation date is required." };
    }

    if (!input.items || input.items.length === 0) {
      return { success: false, message: "At least one item must be confirmed." };
    }

    const order = await prisma.purchaseOrders.findFirst({
      where: {
        PoNumber: {
          equals: poNumber.trim(),
          mode: "insensitive",
        },
      },
      include: {
        PurchaseOrderItems: true,
      },
    });

    if (!order) {
      return { success: false, message: `Purchase Order "${poNumber}" not found.` };
    }

    // Execute transactional update
    await prisma.$transaction(async (tx) => {
      let calculatedTotal = 0;

      for (const item of input.items) {
        const qty = Math.max(0, Number(item.confirmedQuantity) || 0);
        const price = Math.max(0, Number(item.unitPrice) || 0);
        const lineTotal = qty * price;
        calculatedTotal += lineTotal;

        const existingItem = order.PurchaseOrderItems.find((i) => i.ItemId === item.itemId);
        if (existingItem) {
          await tx.purchaseOrderItems.update({
            where: { PoItemId: existingItem.PoItemId },
            data: {
              PoItemQuantity: qty,
              TotalPrice: lineTotal,
            },
          });
        }
      }

      // Store approval metadata
      const metadata = JSON.stringify({
        supplierApprovedBy: input.supplierApprovedBy.trim(),
        supplierApprovedDate: input.supplierApprovedDate,
        notes: input.notes?.trim() || "",
        submittedOnlineAt: new Date().toISOString(),
        onlineAcknowledged: true,
      });

      await tx.purchaseOrders.update({
        where: { PoId: order.PoId },
        data: {
          TotalAmount: calculatedTotal,
          AdminNotes: metadata,
          ...(input.expectedArrivalDate ? { ExpectedArrivalDate: new Date(input.expectedArrivalDate) } : {}),
        },
      });
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    revalidatePath("/orders-procurement");
    revalidatePath("/reports");

    return {
      success: true,
      message: "Your acknowledgment and pricing have been successfully submitted to Bren Raphael's Ube Jam & Halaya.",
    };
  } catch (error: any) {
    console.error("Failed to submit supplier acknowledgment:", error);
    return { success: false, message: error?.message || "Failed to submit acknowledgment." };
  }
}
