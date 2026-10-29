"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  RefreshCw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrdersSkeleton } from "@/components/orders-procurement/OrdersSkeleton";
import { procurement } from "@/lib/orders/client";
import { PurchaseOrderPO, POStatus } from "../types";
import { POTable } from "./POTable";
import { PODetailsModal } from "./PODetailsModal";
import { POApprovalModal } from "./POApprovalModal";
import { PurchaseOrderPrintDocument } from "./PurchaseOrderPrintDocument";
import { POActionModal, POActionType } from "./POActionModal";
import { CreatePOModal } from "./CreatePOModal";
import { CreateDeliveryModal } from "../delivery/CreateDeliveryModal";
import Pagination from "@/components/Pagination";
import { useStaff } from "@/context/StaffContext";
import { isAdminStaff } from "@/lib/auth-roles";

const STATUS_TABS: (POStatus | "All")[] = [
  "All",
  "Pending Approval",
  "Approved",
  "Ordered",
  "Partially Delivered",
  "Delivered",
  "Cancelled",
];

function mapPO(o: any): PurchaseOrderPO {
  return {
    poId: o.poId,
    poNumber: o.poNumber,
    prId: o.prId ?? undefined,
    prNumber: o.prNumber ?? undefined,
    supplierId: o.supplierId,
    supplierName: o.supplierName || "—",
    supplierAddress: o.supplierAddress,
    supplierEmail: o.supplierEmail,
    supplierContactPerson: o.supplierContactPerson,
    supplierPhone: o.supplierPhone,
    supplierApprovedBy: o.supplierApprovedBy,
    supplierApprovedDate: o.supplierApprovedDate,
    requestedBy: o.requestedBy || "—",
    orderDate: o.orderDate,
    expectedArrivalDate: o.expectedArrivalDate,
    status: (o.status === "PendingApproval" ? "Pending Approval" : o.status === "PartiallyDelivered" ? "Partially Delivered" : o.status) as POStatus,
    paymentType: o.paymentType,
    adminNotes: o.adminNotes ?? undefined,
    totalAmount: o.totalAmount || 0,
    items: (o.items || []).map((i: any) => ({
      poItemId: i.poItemId,
      itemId: i.itemId,
      itemName: i.itemName,
      poItemQuantity: Number(i.poItemQuantity),
      receivedQuantity: Number(i.receivedQuantity || 0),
      unitPrice: Number(i.unitPrice ?? (Number(i.totalPrice) / Math.max(1, Number(i.poItemQuantity)))),
      totalPrice: Number(i.totalPrice ?? i.lineTotal ?? (Number(i.poItemQuantity) * (i.unitPrice || 0))),
      purchaseUomId: i.purchaseUomId,
      purchaseUomName: i.purchaseUomName || "Unit",
      lineTotal: Number(i.lineTotal ?? i.totalPrice ?? (Number(i.poItemQuantity) * (i.unitPrice || 0))),
    })),
  };
}

export function POTab({ initialOrders }: { initialOrders: PurchaseOrderPO[] }) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = isAdminStaff(staff);
  const orders = initialOrders.map(mapPO);
  const [loading, startRefresh] = useTransition();
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modals state
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderPO | null>(null);
  const [approvingPO, setApprovingPO] = useState<PurchaseOrderPO | null>(null);
  const [printingPO, setPrintingPO] = useState<PurchaseOrderPO | null>(null);
  const [actionModal, setActionModal] = useState<{ po: PurchaseOrderPO; type: POActionType } | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrderPO | null>(null);
  const [deliveryPO, setDeliveryPO] = useState<PurchaseOrderPO | null>(null);

  // Extract unique suppliers for filter
  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Set(orders.map((po) => po.supplierName).filter(Boolean));
    return Array.from(suppliers).sort();
  }, [orders]);

  const fetchOrders = () => startRefresh(() => router.refresh());

  // Counts per tab
  const counts = useMemo(() => {
    const map: Record<string, number> = { All: orders.length };
    STATUS_TABS.forEach((t) => {
      map[t] = 0;
    });
    orders.forEach((po) => {
      const st = po.status;
      if (map[st] !== undefined) map[st]++;
    });
    map.All = orders.length;
    return map;
  }, [orders]);

  // Filtered list
  const filteredList = useMemo(() => {
    return orders.filter((po) => {
      if (activeTab !== "All" && po.status !== activeTab) {
        return false;
      }

      if (supplierFilter && po.supplierName !== supplierFilter) return false;

      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          po.poNumber?.toLowerCase().includes(s) ||
          po.prNumber?.toLowerCase().includes(s) ||
          po.supplierName?.toLowerCase().includes(s) ||
          po.requestedBy?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [orders, activeTab, search, supplierFilter]);

  const totalCount = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  const handleStatusUpdate = async (poId: number, status: string, adminNotes?: string) => {
    await procurement.setOrderStatus(poId, {
      status,
      adminNotes: adminNotes || null,
    });
    setNotice("Purchase order updated successfully.");
    fetchOrders();
  };

  return (
    <div className="space-y-6 animate-page-in">
      {notice && (
        <p role="status" className="rounded-xl bg-primary/10 p-3 text-xs text-primary font-medium">
          {notice}
        </p>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Purchase Orders</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage supplier purchase orders referencing approved purchase requisitions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors h-10 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>

          {!isAdmin && (
            <Button
              type="button"
              onClick={() => setOpenCreateModal(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm h-10 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Purchase Order
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="mb-6 border border-border rounded-xl overflow-hidden bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-3 flex-1">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search by Purchase Order No., Purchase Requisition Reference, Supplier, or Requester..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-xs flex-1 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-3 pl-4 border-l border-border/50">
            <Select
              value={supplierFilter === "" ? "all" : supplierFilter}
              onValueChange={(val) => {
                setSupplierFilter(val === "all" ? "" : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 min-w-[210px] w-auto rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs focus:ring-1 focus:ring-ring">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent className="min-w-[210px]">
                <SelectItem value="all">All Suppliers</SelectItem>
                {uniqueSuppliers.map((sup) => (
                  <SelectItem key={sup} value={sup}>
                    {sup}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max pb-2">
          {STATUS_TABS.map((tab) => {
            const count = counts[tab] || 0;
            const isSelected = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    isSelected ? "bg-background text-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <OrdersSkeleton />
      ) : (
        <POTable
          orders={paginatedList}
          isAdmin={isAdmin}
          onView={(po) => setSelectedPO(po)}
          onEdit={(po) => setEditingPO(po)}
          onCancel={(po) => setActionModal({ po, type: "cancel" })}
        />
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      {/* Purchase Order Details Modal */}
      <PODetailsModal
        po={selectedPO}
        isAdmin={isAdmin}
        onClose={() => setSelectedPO(null)}
        onPrint={(po) => setPrintingPO(po)}
        onApproveWithForm={(po) => {
          setSelectedPO(null);
          setApprovingPO(po);
        }}
        onCancel={(po) => {
          setSelectedPO(null);
          setActionModal({ po, type: "cancel" });
        }}
        onCreateDelivery={(po) => {
          setSelectedPO(null);
          setDeliveryPO(po);
        }}
      />

      {/* Supplier Approval Modal */}
      {approvingPO && (
        <POApprovalModal
          po={approvingPO}
          onClose={() => setApprovingPO(null)}
          onSuccess={(updated) => {
            setApprovingPO(null);
            fetchOrders();
            setActiveTab("Approved");
            setPrintingPO(updated);
          }}
        />
      )}

      {/* Printable Document Modal */}
      {printingPO && (
        <PurchaseOrderPrintDocument
          po={printingPO}
          onClose={() => setPrintingPO(null)}
        />
      )}

      {/* Action Confirmation Modal (Cancel only) */}
      {actionModal && (
        <POActionModal
          actionType={actionModal.type}
          poNumber={actionModal.po.poNumber}
          onClose={() => setActionModal(null)}
          onConfirm={async (notes) => {
            const { po, type } = actionModal;
            if (type === "cancel") {
              await handleStatusUpdate(po.poId, "Cancelled", notes);
            }
            setActionModal(null);
          }}
        />
      )}

      {/* Create Purchase Order Modal */}
      {openCreateModal && (
        <CreatePOModal
          open={openCreateModal}
          onClose={() => setOpenCreateModal(false)}
          onSuccess={(created) => {
            setOpenCreateModal(false);
            fetchOrders();
            setActiveTab("Pending Approval");
            if (created?.poNumber) {
              setNotice(`Purchase Order ${created.poNumber} created and sent automatically to supplier with PO document attached.`);
            }
          }}
        />
      )}

      {/* Create Delivery Modal */}
      {deliveryPO && (
        <CreateDeliveryModal
          open={!!deliveryPO}
          initialPo={deliveryPO}
          onClose={() => setDeliveryPO(null)}
          onSuccess={() => {
            setDeliveryPO(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
