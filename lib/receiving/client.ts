import { actionResponse } from "@/lib/resources/action-response";
import * as receipts from "@/app/actions/receiving/receipts";
import * as quality from "@/app/actions/receiving/quality";
import * as stockins from "@/app/actions/receiving/stock-ins";
import * as discrepancies from "@/app/actions/receiving/discrepancies";
import * as returns from "@/app/actions/receiving/returns";
import * as losses from "@/app/actions/receiving/losses";
import * as lookups from "@/app/actions/receiving/lookups";

// Keep the existing modal response and error shapes while invoking guarded server actions.
export const receiving = {
  listReceipts: (...args: Parameters<typeof receipts.listReceipts>) => actionResponse(receipts.listReceipts(...args)),
  getReceipt: (...args: Parameters<typeof receipts.getReceipt>) => actionResponse(receipts.getReceipt(...args)),
  createReceipt: (...args: Parameters<typeof receipts.createReceipt>) => actionResponse(receipts.createReceipt(...args)),
  updateReceipt: (...args: Parameters<typeof receipts.updateReceipt>) => actionResponse(receipts.updateReceipt(...args)),
  postReceipt: (...args: Parameters<typeof receipts.postReceipt>) => actionResponse(receipts.postReceipt(...args)),
  cancelReceipt: (...args: Parameters<typeof receipts.cancelReceipt>) => actionResponse(receipts.cancelReceipt(...args)),
  rejectReceipt: (...args: Parameters<typeof receipts.rejectReceipt>) => actionResponse(receipts.rejectReceipt(...args)),
  proceedToQa: (...args: Parameters<typeof receipts.proceedToQa>) => actionResponse(receipts.proceedToQa(...args)),
  listInspections: (...args: Parameters<typeof quality.listInspections>) => actionResponse(quality.listInspections(...args)),
  completeInspection: (...args: Parameters<typeof quality.completeInspection>) => actionResponse(quality.completeInspection(...args)),
  listStockIns: (...args: Parameters<typeof stockins.listStockIns>) => actionResponse(stockins.listStockIns(...args)),
  createStockIn: (...args: Parameters<typeof stockins.createStockIn>) => actionResponse(stockins.createStockIn(...args)),
  submitStockIn: (...args: Parameters<typeof stockins.submitStockIn>) => actionResponse(stockins.submitStockIn(...args)),
  approveStockIn: (...args: Parameters<typeof stockins.approveStockIn>) => actionResponse(stockins.approveStockIn(...args)),
  rejectStockIn: (...args: Parameters<typeof stockins.rejectStockIn>) => actionResponse(stockins.rejectStockIn(...args)),
  commitStockIn: (...args: Parameters<typeof stockins.commitStockIn>) => actionResponse(stockins.commitStockIn(...args)),
  listDiscrepancies: (...args: Parameters<typeof discrepancies.listDiscrepancies>) => actionResponse(discrepancies.listDiscrepancies(...args)),
  resolveDiscrepancy: (...args: Parameters<typeof discrepancies.resolveDiscrepancy>) => actionResponse(discrepancies.resolveDiscrepancy(...args)),
  resolveAsLoss: (...args: Parameters<typeof discrepancies.resolveAsLoss>) => actionResponse(discrepancies.resolveAsLoss(...args)),
  resolveAsReturn: (...args: Parameters<typeof discrepancies.resolveAsReturn>) => actionResponse(discrepancies.resolveAsReturn(...args)),
  listReturns: (...args: Parameters<typeof returns.listReturns>) => actionResponse(returns.listReturns(...args)),
  approveReturn: (...args: Parameters<typeof returns.approveReturn>) => actionResponse(returns.approveReturn(...args)),
  rejectReturn: (...args: Parameters<typeof returns.rejectReturn>) => actionResponse(returns.rejectReturn(...args)),
  dispatchReturn: (...args: Parameters<typeof returns.dispatchReturn>) => actionResponse(returns.dispatchReturn(...args)),
  listLossReports: (...args: Parameters<typeof losses.listLossReports>) => actionResponse(losses.listLossReports(...args)),
  acknowledgeLoss: (...args: Parameters<typeof losses.acknowledgeLoss>) => actionResponse(losses.acknowledgeLoss(...args)),
  listStockBalances: (...args: Parameters<typeof lookups.listStockBalances>) => actionResponse(lookups.listStockBalances(...args)),
};
