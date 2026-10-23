import { fileRoutes, purchaseOrderReceipt } from "@/lib/file-routes";

export const POST = fileRoutes("Orders & Procurement", purchaseOrderReceipt).confirm;
