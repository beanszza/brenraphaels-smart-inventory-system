import { toast } from "sonner";
import type { ResourceResult } from "@/lib/resources/result";
import { actionResponse } from "@/lib/resources/action-response";
import * as receipts from "@/app/actions/receiving/receipts";
import * as quality from "@/app/actions/receiving/quality";
import * as stockins from "@/app/actions/receiving/stock-ins";
import * as discrepancies from "@/app/actions/receiving/discrepancies";
import * as returns from "@/app/actions/receiving/returns";
import * as losses from "@/app/actions/receiving/losses";
import * as lookups from "@/app/actions/receiving/lookups";

// Surface successful mutations even when their dialog closes immediately.
async function receivingMutation(result: Promise<ResourceResult>) {
  const response = await actionResponse(result);
  toast.success(response.data.message || "Goods Receiving updated successfully.");
  return response;
}

// Keep the existing modal response and error shapes while invoking guarded server actions.
export const receiving = {
  listReceipts: (...args: Parameters<typeof receipts.listReceipts>) => actionResponse(receipts.listReceipts(...args)),
  getReceipt: (...args: Parameters<typeof receipts.getReceipt>) => actionResponse(receipts.getReceipt(...args)),
  createReceipt: (...args: Parameters<typeof receipts.createReceipt>) => receivingMutation(receipts.createReceipt(...args)),
  updateReceipt: (...args: Parameters<typeof receipts.updateReceipt>) => receivingMutation(receipts.updateReceipt(...args)),
  postReceipt: (...args: Parameters<typeof receipts.postReceipt>) => receivingMutation(receipts.postReceipt(...args)),
  cancelReceipt: (...args: Parameters<typeof receipts.cancelReceipt>) => receivingMutation(receipts.cancelReceipt(...args)),
  rejectReceipt: (...args: Parameters<typeof receipts.rejectReceipt>) => receivingMutation(receipts.rejectReceipt(...args)),
  proceedToQa: (...args: Parameters<typeof receipts.proceedToQa>) => receivingMutation(receipts.proceedToQa(...args)),
  listInspections: (...args: Parameters<typeof quality.listInspections>) => actionResponse(quality.listInspections(...args)),
  completeInspection: (...args: Parameters<typeof quality.completeInspection>) => receivingMutation(quality.completeInspection(...args)),
  listStockIns: (...args: Parameters<typeof stockins.listStockIns>) => actionResponse(stockins.listStockIns(...args)),
  createStockIn: (...args: Parameters<typeof stockins.createStockIn>) => receivingMutation(stockins.createStockIn(...args)),
  submitStockIn: (...args: Parameters<typeof stockins.submitStockIn>) => receivingMutation(stockins.submitStockIn(...args)),
  approveStockIn: (...args: Parameters<typeof stockins.approveStockIn>) => receivingMutation(stockins.approveStockIn(...args)),
  rejectStockIn: (...args: Parameters<typeof stockins.rejectStockIn>) => receivingMutation(stockins.rejectStockIn(...args)),
  commitStockIn: (...args: Parameters<typeof stockins.commitStockIn>) => receivingMutation(stockins.commitStockIn(...args)),
  listDiscrepancies: (...args: Parameters<typeof discrepancies.listDiscrepancies>) => actionResponse(discrepancies.listDiscrepancies(...args)),
  resolveDiscrepancy: (...args: Parameters<typeof discrepancies.resolveDiscrepancy>) => receivingMutation(discrepancies.resolveDiscrepancy(...args)),
  resolveAsLoss: (...args: Parameters<typeof discrepancies.resolveAsLoss>) => receivingMutation(discrepancies.resolveAsLoss(...args)),
  resolveAsReturn: (...args: Parameters<typeof discrepancies.resolveAsReturn>) => receivingMutation(discrepancies.resolveAsReturn(...args)),
  listReturns: (...args: Parameters<typeof returns.listReturns>) => actionResponse(returns.listReturns(...args)),
  approveReturn: (...args: Parameters<typeof returns.approveReturn>) => receivingMutation(returns.approveReturn(...args)),
  rejectReturn: (...args: Parameters<typeof returns.rejectReturn>) => receivingMutation(returns.rejectReturn(...args)),
  dispatchReturn: (...args: Parameters<typeof returns.dispatchReturn>) => receivingMutation(returns.dispatchReturn(...args)),
  listLossReports: (...args: Parameters<typeof losses.listLossReports>) => actionResponse(losses.listLossReports(...args)),
  acknowledgeLoss: (...args: Parameters<typeof losses.acknowledgeLoss>) => receivingMutation(losses.acknowledgeLoss(...args)),
  listStockBalances: (...args: Parameters<typeof lookups.listStockBalances>) => actionResponse(lookups.listStockBalances(...args)),
};
