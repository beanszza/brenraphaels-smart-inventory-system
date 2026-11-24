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
import { PODetailsView } from "./PODetailsModal";
import { POApprovalView } from "./POApprovalModal";
import { downloadPurchaseOrderPdf } from "./downloadPurchaseOrderPdf";
import { POActionModal, POActionType } from "./POActionModal";
import { CreatePOForm } from "./CreatePOModal";
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
    emailConfirmed: o.emailConfirmed === undefined ? true : Boolean(o.emailConfirmed),
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

  // Full-page Create / Edit Purchase Order view (matching Figma Form · New purchase order)
  if (openCreateModal || editingPO) {
    const isEditMode = !!editingPO;
    return (
      <CreatePOForm
        embedded
        isEdit={isEditMode}
        initialPo={editingPO}
        onClose={() => {
          setOpenCreateModal(false);
          setEditingPO(null);
        }}
        onDraftDiscarded={(poNumber) => {
          setOpenCreateModal(false);
          setEditingPO(null);
          fetchOrders();
          if (poNumber) {
            setNotice(`${poNumber} was not sent. You can create and send it again.`);
          }
        }}
        onSuccess={(saved) => {
          setOpenCreateModal(false);
          setEditingPO(null);
          fetchOrders();
          setActiveTab("Pending Approval");
          if (saved?.poNumber) {
            setNotice(
              saved.emailConfirmed === false
                ? `${saved.poNumber} saved in Pending Approval — open it to confirm Gmail send before approving.`
                : `${saved.poNumber} marked as sent — awaiting supplier confirmation.`
            );
          }
        }}
      />
    );
  }

  // Full-page Supplier Confirmation view (replaces old POApprovalModal)
  if (approvingPO) {
    return (
      <POApprovalView
        embedded
        po={approvingPO}
        onClose={() => setApprovingPO(null)}
        onSuccess={(updated) => {
          setApprovingPO(null);
          setSelectedPO(updated);
          setNotice(`Purchase Order ${updated.poNumber} confirmed and moved to Approved.`);
          setActiveTab("Approved");
          fetchOrders();
        }}
      />
    );
  }

  // Full-page Purchase Order Details view (matching Figma Purchase order · PO-2026-0151)
  if (selectedPO) {
    const latestPo = orders.find((o) => o.poId === selectedPO.poId) || selectedPO;
    return (
      <>
        <PODetailsView
          embedded
          po={latestPo}
          isAdmin={isAdmin}
          onClose={() => setSelectedPO(null)}
          onPrint={(po) => {
            void downloadPurchaseOrderPdf(po);
          }}
          onConfirmEmailSent={async (po) => {
            const res = await procurement.setOrderStatus(po.poId, {
              status: "Pending Approval",
              emailConfirmed: true,
            });
            const updated: PurchaseOrderPO = res.data?.data
              ? mapPO(res.data.data)
              : { ...po, status: "Pending Approval", emailConfirmed: true };
            setSelectedPO(updated);
            setNotice(`${po.poNumber} email send confirmed — you can now confirm the order when the supplier replies.`);
            fetchOrders();
          }}
          onApproveWithForm={(po) => {
            setApprovingPO(po);
          }}
          onCancel={(po) => {
            setActionModal({ po, type: "cancel", returnToDetails: true });
          }}
          onCreateDelivery={(po) => {
            setDeliveryPO(po);
          }}
        />

        {actionModal && (
          <POActionModal
            actionType={actionModal.type}
            poNumber={actionModal.po.poNumber}
            onClose={() => {
              setActionModal(null);
            }}
            onConfirm={async (notes) => {
              const { po, type } = actionModal;
              if (type === "cancel") {
                await handleStatusUpdate(po.poId, "Cancelled", notes);
                setSelectedPO(null);
              }
              setActionModal(null);
            }}
          />
        )}

        {deliveryPO && (
          <CreateDeliveryModal
            open={!!deliveryPO}
            initialPo={deliveryPO}
            onClose={() => setDeliveryPO(null)}
            onSuccess={() => {
              setDeliveryPO(null);
              setSelectedPO(null);
              fetchOrders();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-5 animate-page-in">
      {notice && (
        <p role="status" className="rounded-control bg-subtle border border-border p-3 type-body text-primary">
          {notice}
        </p>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-ink">Purchase Orders</h2>
          <p className="mt-1 type-body text-ink-muted">
            Manage supplier purchase orders referencing approved purchase requisitions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded-control bg-surface border border-border px-3.5 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-9 shadow-none cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>

          {isAdmin && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex items-center justify-center gap-1.5 rounded-control bg-surface border border-border px-3.5 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-9 shadow-none cursor-pointer"
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
              className="flex items-center justify-center gap-1.5 rounded-control bg-primary px-3.5 py-2 type-label-button text-on-brand hover:bg-primary-hover transition-colors h-9 shadow-none cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Purchase Order
            </Button>
          )}
        </div>
      </div>

      {/* Status Sub-tabs */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
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
                aria-pressed={isSelected}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${isSelected
                  ? "bg-status-purple-bg text-primary"
                  : "text-ink-muted hover:text-ink hover:bg-subtle"
                  }`}
              >
                <span>{tab}</span>
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Standalone Filters & Search Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={supplierFilter === "" ? "all" : supplierFilter}
          onValueChange={(val) => {
            setSupplierFilter(val === "all" ? "" : val);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-[38px] w-full sm:w-auto sm:min-w-[230px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
            <span className="truncate">
              <span className="text-ink-muted font-normal mr-1.5">Supplier:</span>
              <span className="font-medium text-ink">
                <SelectValue placeholder="All Suppliers" />
              </span>
            </span>
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            sideOffset={4}
            avoidCollisions={false}
            className="min-w-[230px] max-h-72"
          >
            <SelectItem value="all">All Suppliers</SelectItem>
            {uniqueSuppliers.map((sup) => (
              <SelectItem key={sup} value={sup}>
                {sup}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SearchInput
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search PO No., PR ref, or supplier..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Padded Table Card */}
      {loading ? (
        <OrdersSkeleton />
      ) : (
        <div className="rounded-card border border-border bg-surface p-5">
          <POTable
            orders={paginatedList}
            isAdmin={isAdmin}
            onView={(po) => setSelectedPO(po)}
            onEdit={(po) => setEditingPO(po)}
            onCancel={(po) => setActionModal({ po, type: "cancel" })}
            onDiscardDraft={(po) => setDiscardingPO(po)}
          />

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
            embedded
          />
        </div>
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
