// How the Orders & Procurement screens call their actions. Each keeps the `{ data }` shape the
// screens read from the old route handlers, and a refusal throws with the reason attached.
import * as requisitions from "@/app/actions/orders/requisitions";
import * as orders from "@/app/actions/orders/orders";
import * as deliveries from "@/app/actions/orders/deliveries";
import * as mrp from "@/app/actions/orders/mrp";
import * as reports from "@/app/actions/orders/reports";
import { actionResponse } from "@/lib/resources/action-response";

export const procurement = {
  listRequisitions: (status?: string) => actionResponse(requisitions.listRequisitions(status)),
  createRequisition: (...args: Parameters<typeof requisitions.createRequisition>) => actionResponse(requisitions.createRequisition(...args)),
  updateRequisition: (...args: Parameters<typeof requisitions.updateRequisition>) => actionResponse(requisitions.updateRequisition(...args)),
  setRequisitionStatus: (...args: Parameters<typeof requisitions.setRequisitionStatus>) => actionResponse(requisitions.setRequisitionStatus(...args)),

  listOrders: (query?: string) => actionResponse(orders.listOrders(query)),
  nextOrderNumber: () => actionResponse(orders.nextOrderNumber()),
  orderedQuantities: (prId: string | number) => actionResponse(orders.orderedQuantities(prId)),
  createOrder: (...args: Parameters<typeof orders.createOrder>) => actionResponse(orders.createOrder(...args)),
  updateOrder: (...args: Parameters<typeof orders.updateOrder>) => actionResponse(orders.updateOrder(...args)),
  setOrderStatus: (...args: Parameters<typeof orders.setOrderStatus>) => actionResponse(orders.setOrderStatus(...args)),

  listDeliveries: (query?: string) => actionResponse(deliveries.listDeliveries(query)),
  outstandingItems: (poId: string | number) => actionResponse(deliveries.outstandingItems(poId)),
  createDelivery: (...args: Parameters<typeof deliveries.createDelivery>) => actionResponse(deliveries.createDelivery(...args)),
  cancelDelivery: (...args: Parameters<typeof deliveries.cancelDelivery>) => actionResponse(deliveries.cancelDelivery(...args)),
  dispatchDelivery: (...args: Parameters<typeof deliveries.dispatchDelivery>) => actionResponse(deliveries.dispatchDelivery(...args)),
  arriveDelivery: (...args: Parameters<typeof deliveries.arriveDelivery>) => actionResponse(deliveries.arriveDelivery(...args)),

  planMrp: (...args: Parameters<typeof mrp.planMrp>) => actionResponse(mrp.planMrp(...args)),
  loadReport: (type: string, query?: string) => actionResponse(reports.loadReport(type, query)),
};
