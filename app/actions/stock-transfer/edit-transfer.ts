"use server";
import { requireModule } from "@/lib/portal/staff";
import { mutate, positiveId, refuse, saved, validateInput } from "@/lib/stock-transfer/operations";
import { resourceResult } from "@/lib/resources/result";

export async function editTransfer(idInput: number, body: {
  productId: number; sourceLocationId: number; destLocationId: number;
  transferQuantity: number; transferDate: string;
}) {
  const staff = await requireModule("Stock Transfer");
  return mutate(staff, async tx => {
    const id = positiveId(idInput);
    validateInput(body);
    const transfer = await tx.stockTransfers.findUnique({ where: { TransferId: id } });
    if (!transfer || transfer.Status !== "Scheduled") refuse("Only scheduled transfers can be edited.");
    if (body.productId !== transfer.ProductId || body.sourceLocationId !== transfer.SourceLocationId || body.destLocationId !== transfer.DestLocationId) {
      refuse("The product and locations must match the approved request.");
    }
    if (!transfer.RequestId) refuse("An approved request is required.");
    const request = await tx.stockTransferRequests.findUnique({ where: { RequestId: transfer.RequestId }, include: { StockTransferRequestItems: true } });
    if (!request || request.Status !== "Approved") refuse("An approved request is required.");
    const other = await tx.stockTransfers.aggregate({ where: { RequestId: transfer.RequestId, ProductId: transfer.ProductId, TransferId: { not: id }, Status: { not: "Cancelled" } }, _sum: { TransferQuantity: true } });
    const limit = request.StockTransferRequestItems.filter(item => item.ProductId === transfer.ProductId).reduce((sum, item) => sum + Number(item.RequestedQuantity), 0);
    if (Number(other._sum.TransferQuantity || 0) + body.transferQuantity > limit) refuse("The quantity exceeds the unscheduled request quantity.");
    const updated = await tx.stockTransfers.update({ where: { TransferId: id }, data: { TransferQuantity: body.transferQuantity, ScheduledDate: new Date(body.transferDate) } });
    return saved(staff, "stock-transfer", id, updated.TransferNumber, "updated", resourceResult({ success: true, data: { transferId: id } }));
  });
}
