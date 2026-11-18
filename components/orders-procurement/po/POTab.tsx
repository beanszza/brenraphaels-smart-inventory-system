"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  History,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
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

function mapPO(o: Record<string, unknown>): PurchaseOrderPO {
  return {
    poId: Number(o.poId),
    poNumber: String(o.poNumber || ""),
    prId: o.prId ? Number(o.prId) : undefined,
    prNumber: o.prNumber ? String(o.prNumber) : undefined,
    supplierId: Number(o.supplierId),
    supplierName: String(o.supplierName || "—"),
    supplierAddress: o.supplierAddress ? String(o.supplierAddress) : undefined,
    supplierEmail: o.supplierEmail ? String(o.supplierEmail) : undefined,
    supplierContactPerson: o.supplierContactPerson ? String(o.supplierContactPerson) : undefined,
    supplierPhone: o.supplierPhone ? String(o.supplierPhone) : undefined,
    supplierApprovedBy: o.supplierApprovedBy ? String(o.supplierApprovedBy) : undefined,
    supplierApprovedDate: o.supplierApprovedDate ? String(o.supplierApprovedDate) : undefined,
    requestedBy: String(o.requestedBy || "—"),
    orderDate: String(o.orderDate || ""),
    expectedArrivalDate: String(o.expectedArrivalDate || ""),
    status: (o.status === "PendingApproval" ? "Pending Approval" : o.status === "PartiallyDelivered" ? "Partially Delivered" : o.status) as POStatus,
    paymentType: String(o.paymentType || ""),
    adminNotes: o.adminNotes ? String(o.adminNotes) : undefined,
    totalAmount: Number(o.totalAmount || 0),
    hasRemainingToSchedule: Boolean(o.hasRemainingToSchedule),
    items: (Array.isArray(o.items) ? o.items : []).map((raw) => {
      const i = raw as Record<string, unknown>;
      return {
        poItemId: Number(i.poItemId),
        itemId: Number(i.itemId),
        itemCode: String(i.itemCode || `SPL-${String(i.itemId || 0).padStart(4, "0")}`),
        itemName: String(i.itemName || ""),
        poItemQuantity: Number(i.poItemQuantity),
        receivedQuantity: Number(i.receivedQuantity || 0),
        unitPrice: Number(i.unitPrice ?? (Number(i.totalPrice) / Math.max(1, Number(i.poItemQuantity)))),
        totalPrice: Number(i.totalPrice ?? i.lineTotal ?? (Number(i.poItemQuantity) * (Number(i.unitPrice) || 0))),
        purchaseUomId: Number(i.purchaseUomId || 0),
        purchaseUomName: i.purchaseUomName ? String(i.purchaseUomName) : "Unit",
        lineTotal: Number(i.lineTotal ?? i.totalPrice ?? (Number(i.poItemQuantity) * (Number(i.unitPrice) || 0))),
      };
    }),
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
  const [actionModal, setActionModal] = useState<{ po: PurchaseOrderPO; type: POActionType; returnToDetails?: boolean } | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrderPO | null>(null);
  const [deliveryPO, setDeliveryPO] = useState<PurchaseOrderPO | null>(null);
  const [discardingPO, setDiscardingPO] = useState<PurchaseOrderPO | null>(null);
  const [discardSubmitting, setDiscardSubmitting] = useState(false);

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
        <p role="status" className="rounded-control bg-surface-muted border border-divider p-3 type-body text-accent">
          {notice}
        </p>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-text-primary">Purchase Orders</h2>
          <p className="mt-1 type-body text-text-muted">
            Manage supplier purchase orders referencing approved purchase requisitions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-control bg-surface border border-divider px-4 py-2 type-label-button text-text-primary hover:bg-hover transition-colors h-10 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>

          {isAdmin && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex items-center justify-center gap-2 rounded-control bg-surface border border-divider px-4 py-2 type-label-button text-text-primary hover:bg-hover transition-colors h-10 cursor-pointer"
            >
              <Link href="/orders-procurement/logs">
                <History className="w-4 h-4" /> Transaction History
              </Link>
            </Button>
          )}

          {!isAdmin && (
            <Button
              type="button"
              onClick={() => setOpenCreateModal(true)}
              className="flex items-center justify-center gap-2 rounded-control bg-button-primary px-5 py-2.5 type-label-button text-button-primary-foreground hover:bg-button-primary-hover transition-colors shadow-sm h-10 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Purchase Order
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="mb-6 rounded-card border border-divider bg-surface p-3 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SearchInput
            containerClassName="flex-1"
            placeholder="Search by Purchase Order No., Purchase Requisition Reference, Supplier, or Requester..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <div className="flex items-center gap-3">
            <Select
              value={supplierFilter === "" ? "all" : supplierFilter}
              onValueChange={(val) => {
                setSupplierFilter(val === "all" ? "" : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 min-w-[210px] w-auto rounded-control border border-divider bg-surface px-3.5 type-body text-text-primary shadow-sm focus:ring-1 focus:ring-accent">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent className="min-w-[210px] rounded-menu border border-divider bg-surface shadow-menu">
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
      <div className="border-b border-divider overflow-x-auto">
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
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-pill type-label-tab transition-all cursor-pointer ${
                  isSelected
                    ? "bg-button-primary text-button-primary-foreground shadow-sm"
                    : "text-text-muted hover:text-text-primary hover:bg-hover"
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-pill type-caption font-mono font-medium ${
                    isSelected ? "bg-surface text-text-primary" : "bg-surface-muted text-text-muted"
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
          onDiscardDraft={(po) => setDiscardingPO(po)}
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
          setActionModal({ po, type: "cancel", returnToDetails: true });
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
            setNotice(`Purchase Order ${updated.poNumber} confirmed and moved to Approved.`);
            setActiveTab("Approved");
            fetchOrders();
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
          onClose={() => {
            if (actionModal.returnToDetails) {
              setSelectedPO(actionModal.po);
            }
            setActionModal(null);
          }}
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
          onDraftDiscarded={(poNumber) => {
            fetchOrders();
            if (poNumber) {
              setNotice(`${poNumber} was not sent. You can create and send it again.`);
            }
          }}
          onSuccess={(created) => {
            setOpenCreateModal(false);
            fetchOrders();
            setActiveTab("Pending Approval");
            if (created?.poNumber) {
              setNotice(`${created.poNumber} marked as sent — awaiting supplier confirmation.`);
            }
          }}
        />
      )}

      {/* Resend / Edit Draft Purchase Order Modal */}
      {editingPO && (
        <CreatePOModal
          open={!!editingPO}
          isEdit
          initialPo={editingPO}
          onClose={() => setEditingPO(null)}
          onDraftDiscarded={(poNumber) => {
            setEditingPO(null);
            fetchOrders();
            if (poNumber) {
              setNotice(`${poNumber} was not sent. You can create and send it again.`);
            }
          }}
          onSuccess={(updated) => {
            setEditingPO(null);
            fetchOrders();
            setActiveTab("Pending Approval");
            if (updated?.poNumber) {
              setNotice(`${updated.poNumber} marked as sent — awaiting supplier confirmation.`);
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

      <ActionConfirmModal
        open={!!discardingPO}
        title="Discard Draft Purchase Order"
        subtitle={discardingPO ? `Purchase Order No: ${discardingPO.poNumber}` : undefined}
        description={
          discardingPO
            ? `Are you sure you want to discard unsent draft ${discardingPO.poNumber}? Its items will remain available on the Purchase Requisition.`
            : ""
        }
        confirmLabel="Discard Draft"
        submitting={discardSubmitting}
        onCancel={() => setDiscardingPO(null)}
        onConfirm={async () => {
          if (!discardingPO) return;
          const po = discardingPO;
          setDiscardSubmitting(true);
          try {
            await procurement.discardDraftOrder(po.poId);
            setNotice(`${po.poNumber} was not sent. Draft discarded — you can create and send it again.`);
            setDiscardingPO(null);
            fetchOrders();
          } catch (e: unknown) {
            setNotice(e instanceof Error ? e.message : "Failed to discard draft purchase order.");
            setDiscardingPO(null);
          } finally {
            setDiscardSubmitting(false);
          }
        }}
      />
    </div>
  );
}
