import { fileRoutes, purchaseOrderReceipt } from "@/lib/file-routes";

export const GET = fileRoutes("Orders & Procurement", purchaseOrderReceipt).resolve;
