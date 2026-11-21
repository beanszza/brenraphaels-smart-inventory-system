"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Pagination from "@/components/Pagination";
import { InventoryItem } from "@/components/inventory/types";
import { LotItem } from "@/components/lots/types";
import InventorySummaryCards from "@/components/inventory/InventorySummaryCards";
import InventoryTable from "@/components/inventory/InventoryTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatePRModal } from "@/components/orders-procurement/pr/CreatePRForm";
import { PurchaseRequisition } from "@/components/orders-procurement/types";
import ProductionRequestModal from "@/components/production/ProductionRequestModal";
import { useIsAdmin, useIsHeadCook, useIsImsManager } from "@/context/StaffContext";
import { StockWriteOffTab } from "@/components/inventory/write-off/StockWriteOffTab";
import type { StockWriteOffDto } from "@/components/inventory/write-off/types";

function matchesCategory(itemCat: string, filter: string): boolean {
  if (!filter || filter === "All") return true;
  const c = (itemCat || "").toLowerCase().trim();
  const f = filter.toLowerCase().trim();

  // Legacy mappings for initial categories
  if (f === "raw materials" || f === "raw material") return c === "raw materials" || c === "raw material" || c.includes("raw");
  if (f === "ingredients" || f === "ingredient") return c === "ingredients" || c === "ingredient" || c.includes("ingredient");
  if (f === "tools and supplies" || f === "tools" || f === "tools & supplies" || f === "tool") {
    return c === "tools and supplies" || c === "tools & supplies" || c.includes("tool") || c.includes("suppl");
  }
  if (f === "finished goods" || f === "finished good") {
    return c === "finished goods" || c === "finished good" || c.includes("finish") || c.includes("prod");
  }

  return c === f;
}

function matchesSearch(item: InventoryItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const nameMatch = item.itemName?.toLowerCase().includes(q) ?? false;
  const codeMatch = item.itemCode?.toLowerCase().includes(q) ?? false;
  const splCodeMatch = `spl-${String(item.itemId).padStart(4, "0")}`.toLowerCase().includes(q);
  const idMatch = item.itemId?.toString().includes(q) ?? false;
  const variantMatch =
    (item.variantName?.toLowerCase().includes(q) || item.variantSku?.toLowerCase().includes(q)) ?? false;
  return nameMatch || codeMatch || splCodeMatch || idMatch || variantMatch;
}

export default function ViewInventory({
  initialInventories,
  initialLots,
  initialTotal,
  initialCategories = [],
  initialWriteOffs = [],
  asOf,
}: {
  initialInventories: InventoryItem[];
  initialLots: LotItem[];
  initialTotal: number;
  initialCategories?: { categoryId: number; categoryName: string }[];
  initialWriteOffs?: StockWriteOffDto[];
  asOf: string;
}) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const isHeadCook = useIsHeadCook();
  const isImsManager = useIsImsManager();
  const canPerformActions = !isAdmin && !isHeadCook;
  const canAccessWriteOff = isAdmin || isImsManager;
  const [mainTab, setMainTab] = useState<"inventory" | "write-off">(
    isAdmin ? "write-off" : "inventory"
  );
  const pendingRequestsCount = useMemo(
    () => (initialWriteOffs || []).filter((s) => s.status === "Pending Approval").length,
    [initialWriteOffs]
  );
  const allInventories = initialInventories;
  const [searchQuery, setSearchQuery] = useState("");
  const firstTabId =
    initialCategories && initialCategories.length > 0
      ? initialCategories[0].categoryName
      : initialInventories.find(
          (item) => item.categoryName && !item.categoryName.toLowerCase().includes("finished good")
        )?.categoryName || "Finished Goods";
  const [categoryFilter, setCategoryFilter] = useState(firstTabId);
  const [productFilter, setProductFilter] = useState("All");
  const [page, setPage] = useState(1);

  const totalItemsCount = initialTotal;
  const lots = initialLots;
  const lowStockCount = allInventories.filter(
    (i) => i.isLowStock || i.currentStock <= i.minStockLevel
  ).length;
  const expiringSoonCount = lots.filter(
    (lot) =>
      lot.expiryDate &&
      Math.ceil((new Date(lot.expiryDate).getTime() - new Date(asOf).getTime()) / 86400000) <= 30 &&
      new Date(lot.expiryDate).getTime() >= new Date(asOf).getTime()
  ).length;

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allInventories) {
      const cat = item.categoryName || "Uncategorized";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [allInventories]);

  // PR Modal State (for "Order Now" action on Raw Materials / Supplies)
  const [isCreatePROpen, setIsCreatePROpen] = useState(false);
  const [selectedPRData, setSelectedPRData] = useState<PurchaseRequisition | undefined>(undefined);

  // Production Request Modal State (for "Produce Now" action on Finished Goods)
  const [isProduceModalOpen, setIsProduceModalOpen] = useState(false);
  const [producePrefill, setProducePrefill] = useState<{
    productId?: number;
    productName?: string;
    variant?: string;
    quantity?: number;
    priority?: "Low" | "Medium" | "High";
    reason?: string;
  } | null>(null);

  // Dynamic Category Tabs from active supply categories + Finished Goods
  const categoryTabs = useMemo(() => {
    let baseList = initialCategories;
    if (!baseList || baseList.length === 0) {
      const set = new Set<string>();
      allInventories.forEach((item) => {
        if (item.categoryName && !item.categoryName.toLowerCase().includes("finished good")) {
          set.add(item.categoryName);
        }
      });
      baseList = Array.from(set).map((name, i) => ({ categoryId: i + 1, categoryName: name }));
    }

    const dynamicTabs = baseList.map((c) => ({
      id: c.categoryName,
      label: c.categoryName === "Tools and Supplies" ? "TOOLS & SUPPLIES" : c.categoryName.toUpperCase(),
    }));
    return [...dynamicTabs, { id: "Finished Goods", label: "FINISHED GOODS" }];
  }, [initialCategories, allInventories]);

  // Ensure categoryFilter is valid when tabs load
  useEffect(() => {
    if (categoryTabs.length > 0 && !categoryTabs.some((t) => t.id === categoryFilter)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryFilter(categoryTabs[0].id);
    }
  }, [categoryTabs, categoryFilter]);

  // Distinct finished goods product names for the Product filter dropdown
  const availableFinishedProducts = useMemo(() => {
    const set = new Set<string>();
    allInventories
      .filter((item) => matchesCategory(item.categoryName, "Finished Goods"))
      .forEach((item) => {
        if (item.itemName) set.add(item.itemName.trim());
      });
    return Array.from(set).sort();
  }, [allInventories]);

  // Scoped items by category
  // For Finished Goods: separate each product variant into its own row with its own Variant & SKU column!
  const categoryScopedItems = useMemo(() => {
    if (categoryFilter === "Finished Goods") {
      const rawFinishedGoods = allInventories.filter((item) =>
        matchesCategory(item.categoryName, "Finished Goods")
      );
      // Group by ItemId so multiple warehouse location rows for the same product don't duplicate variants!
      const itemMap = new Map<number, InventoryItem>();
      rawFinishedGoods.forEach((item) => {
        if (!itemMap.has(item.itemId)) {
          itemMap.set(item.itemId, item);
        }
      });

      const rows: InventoryItem[] = [];
      itemMap.forEach((item) => {
        if (item.finishedProductVariants && item.finishedProductVariants.length > 0) {
          item.finishedProductVariants.forEach((v) => {
            const variantStock = v.currentStock !== undefined ? Number(v.currentStock) : (item.currentStock ?? 0);
            const variantReserved = v.reservedStock ?? 0;
            const minStock = v.minStockLevel !== undefined ? Number(v.minStockLevel) : (item.minStockLevel || 0);
            const maxStock = v.maxStockLevel !== undefined ? Number(v.maxStockLevel) : (item.maxStockLevel || 100);
            rows.push({
              ...item,
              inventoryId: `fp-${v.productId}`,
              variantName: v.variant || "Standard",
              variantSku: v.sku || item.itemCode || "",
              productId: v.productId,
              currentStock: variantStock,
              reservedStock: variantReserved,
              availableStock: Math.max(0, variantStock - variantReserved),
              minStockLevel: minStock,
              maxStockLevel: maxStock,
              isLowStock: variantStock <= minStock,
            });
          });
        } else {
          rows.push({
            ...item,
            variantName: "Standard",
            variantSku: item.itemCode || "",
          });
        }
      });
      return rows;
    }

    return allInventories.filter((item) => matchesCategory(item.categoryName, categoryFilter));
  }, [allInventories, categoryFilter]);

  // Full filtering: category + product filter (Finished Goods only) + search
  const filteredInventories = useMemo(() => {
    const isFinishedGoods = categoryFilter === "Finished Goods";
    return categoryScopedItems.filter((item) => {
      const matchesProduct =
        !isFinishedGoods ||
        productFilter === "All" ||
        item.itemName.toLowerCase() === productFilter.toLowerCase();
      return matchesProduct && matchesSearch(item, searchQuery);
    });
  }, [categoryScopedItems, categoryFilter, productFilter, searchQuery]);

  const pageSize = 10;
  const totalCount = filteredInventories.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedInventories = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInventories.slice(start, start + pageSize);
  }, [filteredInventories, page, pageSize]);

  // Order Now / Produce Now handler
  const handleOrderNow = (item: InventoryItem) => {
    if (!canPerformActions) return;
    const neededQty = Math.max(
      1,
      Math.round((item.maxStockLevel > 0 ? item.maxStockLevel : 100) - item.currentStock)
    );

    if (categoryFilter === "Finished Goods" || matchesCategory(item.categoryName, "Finished Goods")) {
      setProducePrefill({
        productId: item.productId,
        productName: item.itemName,
        variant: item.variantName || "Standard",
        quantity: neededQty,
        priority: "High",
        reason: "Regular Stock Replenishment",
      });
      setIsProduceModalOpen(true);
      return;
    }

    const prNeededQty = Math.max(
      0.001,
      Number(((item.maxStockLevel > 0 ? item.maxStockLevel : 10) - item.currentStock).toFixed(3))
    );

    const initialPR: Partial<PurchaseRequisition> = {
      department: "Inventory",
      requestType: "Restock",
      priority: "High",
      purpose: `Restock request for low stock item: ${item.itemName}`,
      notes: `Current Stock: ${item.currentStock} ${item.uomName} | Reorder Point: ${item.minStockLevel} | Max: ${item.maxStockLevel}`,
      items: [
        {
          prItemId: 0,
          itemId: item.itemId,
          itemCode: `SPL-${String(item.itemId).padStart(4, "0")}`,
          itemName: item.itemName,
          uomName: item.uomName || "Unit",
          actualInventory: item.currentStock,
          requestedQuantity: prNeededQty,
        },
      ],
    };

    setSelectedPRData(initialPR as PurchaseRequisition);
    setIsCreatePROpen(true);
  };

  return (
    <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
      <PageHeader
        title="Inventory Management"
        description="Monitor real-time warehouse stocks, ingredients, raw materials, and finished goods"
      />

      {/* Main Process Tabs (Only visible to IMS Manager & Admin; other accounts cannot see Stock Write-Off) */}
      {canAccessWriteOff && (
        <div className="border-b border-divider">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setMainTab("inventory")}
              className={`flex items-center gap-2 px-4 py-2.5 type-label-tab font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap outline-none ${
                mainTab === "inventory"
                  ? "border-primary text-primary -mb-px"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              <span>INVENTORY</span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab("write-off")}
              className={`flex items-center gap-2 px-4 py-2.5 type-label-tab font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap outline-none ${
                mainTab === "write-off"
                  ? "border-primary text-primary -mb-px"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              <span>STOCK WRITE-OFF</span>
              {pendingRequestsCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-pill type-caption font-semibold tabular-nums ${
                    mainTab === "write-off"
                      ? "bg-status-purple-bg text-primary"
                      : "bg-subtle text-ink-muted"
                  }`}
                >
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {canAccessWriteOff && mainTab === "write-off" ? (
        <StockWriteOffTab
          initialWriteOffs={initialWriteOffs}
          initialInventories={allInventories}
          initialLots={lots}
          initialCategories={initialCategories}
        />
      ) : (
        <>
          {/* 3 KPI Cards */}
          <InventorySummaryCards
            totalItems={totalItemsCount}
            lowStockCount={lowStockCount}
            expiringSoonCount={expiringSoonCount}
            categoryCounts={categoryCounts}
          />

          {/* Dynamic Category Sub-tabs */}
          <div className="overflow-x-auto">
            <div className="flex items-center gap-1 min-w-max">
              {categoryTabs.map((tab) => {
                const isActive = categoryFilter === tab.id;
                const displayLabel = tab.id === "Tools and Supplies" ? "Tools & Supplies" : tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(tab.id);
                      setProductFilter("All");
                      setPage(1);
                    }}
                    aria-pressed={isActive}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-status-purple-bg text-primary"
                        : "text-ink-muted hover:text-ink hover:bg-subtle"
                    }`}
                  >
                    <span>{displayLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Standalone Filters & Search Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Product Filter Dropdown: Show strictly only when on Finished Goods */}
            {categoryFilter === "Finished Goods" && availableFinishedProducts.length > 0 && (
              <Select
                value={productFilter}
                onValueChange={(val) => {
                  setProductFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-[38px] w-full sm:w-auto sm:min-w-[220px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
                  <span className="truncate">
                    <span className="text-ink-muted font-normal mr-1.5">Product:</span>
                    <span className="font-medium text-ink">
                      <SelectValue placeholder="All Products" />
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  avoidCollisions={false}
                  className="min-w-[220px] max-h-72"
                >
                  <SelectItem value="All">All Products</SelectItem>
                  {availableFinishedProducts.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Dynamic Category Selector */}
            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val);
                setProductFilter("All");
                setPage(1);
              }}
            >
              <SelectTrigger className="h-[38px] w-full sm:w-auto sm:min-w-[230px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
                <span className="truncate">
                  <span className="text-ink-muted font-normal mr-1.5">Category:</span>
                  <span className="font-medium text-ink">
                    <SelectValue placeholder="Select Category" />
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
                {categoryTabs.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    {tab.id === "Tools and Supplies" ? "Tools & Supplies" : tab.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <SearchInput
              containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
              aria-label="Search inventory"
              placeholder="Search item name or code..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />

            {isAdmin && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="sm:ml-auto h-9 rounded-control border border-border bg-surface px-3.5 py-2 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
              >
                <Link href="/inventory/logs">
                  <History className="w-4 h-4 mr-1.5" />
                  Transaction History
                </Link>
              </Button>
            )}
          </div>

          {/* Padded Table Card */}
          <div className="rounded-card border border-border bg-surface p-5">
            <InventoryTable
              items={paginatedInventories}
              currentPage={page}
              pageSize={pageSize}
              onOrderNow={canPerformActions ? handleOrderNow : undefined}
              isFinishedGoods={categoryFilter === "Finished Goods"}
              showActions={canPerformActions}
            />

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={setPage}
              embedded
            />
          </div>
        </>
      )}

      {/* Create PR Modal triggered by Order Now */}
      {isCreatePROpen && (
        <CreatePRModal
          open={isCreatePROpen}
          onClose={() => {
            setIsCreatePROpen(false);
            setSelectedPRData(undefined);
          }}
          onSuccess={() => {
            setIsCreatePROpen(false);
            setSelectedPRData(undefined);
            toast.success("Restock requisition saved successfully.");
            router.refresh();
          }}
          initialData={selectedPRData}
        />
      )}

      {/* Production Request Modal triggered by Produce Now on Finished Goods */}
      <ProductionRequestModal
        open={isProduceModalOpen}
        prefillData={producePrefill}
        onClose={() => {
          setIsProduceModalOpen(false);
          setProducePrefill(null);
        }}
        onSuccess={() => {
          setIsProduceModalOpen(false);
          setProducePrefill(null);
          toast.success("Production request submitted successfully.");
          router.refresh();
        }}
      />
    </div>
  );
}
