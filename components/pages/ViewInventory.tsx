"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { History, SlidersHorizontal } from "lucide-react";
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

export type InventorySection = "raw-materials" | "tools" | "finished-products" | "write-off";

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

const SECTION_HEADERS: Record<InventorySection, { title: string; description: string }> = {
  "raw-materials": {
    title: "Raw Materials",
    description: "Perishable ingredients, raw materials, and supplies with expiration tracking",
  },
  tools: {
    title: "Tools & Supplies",
    description: "Non-perishable operational equipment, tools, and supplies",
  },
  "finished-products": {
    title: "Finished Products",
    description: "Finished goods, batch yields, and package variants ready for fulfillment",
  },
  "write-off": {
    title: "Stock Write-Off",
    description: "Review, approve, and dispose damaged, expired, or decommissioned stock",
  },
};

export default function ViewInventory({
  initialInventories,
  initialLots,
  initialTotal,
  initialCategories = [],
  initialWriteOffs = [],
  asOf,
  section = "raw-materials",
}: {
  initialInventories: InventoryItem[];
  initialLots: LotItem[];
  initialTotal: number;
  initialCategories?: { categoryId: number; categoryName: string; hasExpiry?: boolean }[];
  initialWriteOffs?: StockWriteOffDto[];
  asOf: string;
  section?: InventorySection;
}) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const isHeadCook = useIsHeadCook();
  const isImsManager = useIsImsManager();
  const canPerformActions = !isAdmin && !isHeadCook;
  const canAccessWriteOff = isAdmin || isImsManager;
  const allInventories = initialInventories;
  const lots = initialLots;

  const pendingRequestsCount = useMemo(
    () => (initialWriteOffs || []).filter((s) => s.status === "Pending Approval").length,
    [initialWriteOffs]
  );

  // Filter items scoped to this section
  const sectionInventories = useMemo(() => {
    if (section === "finished-products") {
      return allInventories.filter((item) => matchesCategory(item.categoryName, "Finished Goods"));
    }
    if (section === "tools") {
      return allInventories.filter(
        (item) => !matchesCategory(item.categoryName, "Finished Goods") && item.categoryHasExpiry === false
      );
    }
    // Default: raw-materials (items whose category has expiry)
    return allInventories.filter(
      (item) => !matchesCategory(item.categoryName, "Finished Goods") && item.categoryHasExpiry !== false
    );
  }, [allInventories, section]);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [productFilter, setProductFilter] = useState("All");
  const [page, setPage] = useState(1);

  // PR Modal State (for "Order Now" action on Raw Materials / Tools)
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

  // Category Tabs for Raw Materials and Tools
  const categoryTabs = useMemo(() => {
    if (section === "finished-products" || section === "write-off") return [];
    let baseList =
      section === "tools"
        ? initialCategories.filter((c) => c.hasExpiry === false)
        : initialCategories.filter((c) => c.hasExpiry !== false);

    if (baseList.length === 0) {
      const set = new Set<string>();
      sectionInventories.forEach((item) => {
        if (item.categoryName) set.add(item.categoryName);
      });
      baseList = Array.from(set).map((name, i) => ({
        categoryId: i + 1,
        categoryName: name,
        hasExpiry: section === "raw-materials",
      }));
    }

    const dynamicTabs = baseList.map((c) => ({
      id: c.categoryName,
      label: c.categoryName === "Tools and Supplies" ? "TOOLS & SUPPLIES" : c.categoryName.toUpperCase(),
    }));

    return [{ id: "All", label: "ALL" }, ...dynamicTabs];
  }, [section, initialCategories, sectionInventories]);

  // Reset category filter if it becomes invalid
  useEffect(() => {
    if (categoryTabs.length > 0 && !categoryTabs.some((t) => t.id === categoryFilter)) {
      setCategoryFilter("All");
    }
  }, [categoryTabs, categoryFilter]);

  // Distinct finished goods product names for the Product filter dropdown
  const availableFinishedProducts = useMemo(() => {
    if (section !== "finished-products") return [];
    const set = new Set<string>();
    sectionInventories.forEach((item) => {
      if (item.itemName) set.add(item.itemName.trim());
    });
    return Array.from(set).sort();
  }, [section, sectionInventories]);

  // Scoped items by category
  // For Finished Products: separate each product variant into its own row with its own Variant
  const categoryScopedItems = useMemo(() => {
    if (section === "finished-products") {
      const itemMap = new Map<number, InventoryItem>();
      sectionInventories.forEach((item) => {
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

    if (!categoryFilter || categoryFilter === "All") {
      return sectionInventories;
    }
    return sectionInventories.filter((item) => matchesCategory(item.categoryName, categoryFilter));
  }, [section, sectionInventories, categoryFilter]);

  // Full filtering: category/product + search
  const filteredInventories = useMemo(() => {
    const isFinishedProducts = section === "finished-products";
    return categoryScopedItems.filter((item) => {
      const matchesProduct =
        !isFinishedProducts ||
        productFilter === "All" ||
        item.itemName.toLowerCase() === productFilter.toLowerCase();
      return matchesProduct && matchesSearch(item, searchQuery);
    });
  }, [categoryScopedItems, section, productFilter, searchQuery]);

  // Counts for KPI Summary Cards
  const totalItemsCount = useMemo(() => {
    if (section === "finished-products") {
      return categoryScopedItems.length;
    }
    return sectionInventories.length;
  }, [section, categoryScopedItems.length, sectionInventories.length]);

  const lowStockCount = useMemo(() => {
    if (section === "finished-products") {
      return categoryScopedItems.filter((i) => i.isLowStock || i.currentStock <= i.minStockLevel).length;
    }
    return sectionInventories.filter((i) => i.isLowStock || i.currentStock <= i.minStockLevel).length;
  }, [section, categoryScopedItems, sectionInventories]);

  const expiringSoonCount = useMemo(() => {
    if (section === "tools") return 0;
    const sectionItemIds = new Set(sectionInventories.map((i) => i.itemId));
    return lots.filter(
      (lot) =>
        sectionItemIds.has(lot.itemId) &&
        lot.expiryDate &&
        Math.ceil((new Date(lot.expiryDate).getTime() - new Date(asOf).getTime()) / 86400000) <= 30 &&
        new Date(lot.expiryDate).getTime() >= new Date(asOf).getTime()
    ).length;
  }, [section, sectionInventories, lots, asOf]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of sectionInventories) {
      const cat = item.categoryName || "Uncategorized";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [sectionInventories]);

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

    if (section === "finished-products" || matchesCategory(item.categoryName, "Finished Goods")) {
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

    if (typeof window !== "undefined") {
      sessionStorage.setItem("prefill_pr", JSON.stringify(initialPR));
      router.push("/orders-procurement");
      return;
    }

    setSelectedPRData(initialPR as PurchaseRequisition);
    setIsCreatePROpen(true);
  };

  const headerInfo = SECTION_HEADERS[section] || SECTION_HEADERS["raw-materials"];

  if (section === "write-off") {
    return (
      <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
        <StockWriteOffTab
          initialWriteOffs={initialWriteOffs}
          initialInventories={allInventories}
          initialLots={lots}
          initialCategories={initialCategories}
        />
      </div>
    );
  }

  return (
    <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
      <PageHeader title={headerInfo.title} description={headerInfo.description} />

      {/* 3 KPI Cards */}
      <InventorySummaryCards
        totalItems={totalItemsCount}
        lowStockCount={lowStockCount}
        expiringSoonCount={expiringSoonCount}
        categoryCounts={categoryCounts}
      />

      {/* Category Sub-tabs: Visible on Raw Materials and Tools */}
      {categoryTabs.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {categoryTabs.map((tab) => {
              const isActive = categoryFilter === tab.id;
              const displayLabel = tab.id === "Tools and Supplies" ? "TOOLS & SUPPLIES" : tab.label;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(tab.id);
                    setPage(1);
                  }}
                  aria-pressed={isActive}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-status-purple-bg text-primary font-semibold"
                      : "text-ink-muted hover:text-ink hover:bg-subtle"
                  }`}
                >
                  <span>{displayLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Standalone Filters & Search Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Product Filter Dropdown: Show strictly only on Finished Products */}
        {section === "finished-products" && availableFinishedProducts.length > 0 && (
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

        {/* Dynamic Category Selector: Shown on Raw Materials and Tools */}
        {categoryTabs.length > 0 && (
          <Select
            value={categoryFilter}
            onValueChange={(val) => {
              setCategoryFilter(val);
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
              <SelectItem value="All">All Categories</SelectItem>
              {categoryTabs
                .filter((tab) => tab.id !== "All")
                .map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    {tab.id === "Tools and Supplies" ? "Tools & Supplies" : tab.id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

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

        {canAccessWriteOff && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="sm:ml-auto h-9 rounded-control border border-border bg-surface px-3.5 py-2 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
          >
            <Link href="/inventory/write-off">
              <SlidersHorizontal className="w-4 h-4 mr-1.5" />
              STOCK WRITE-OFF
              {pendingRequestsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-pill type-caption font-semibold bg-status-purple-bg text-primary tabular-nums">
                  {pendingRequestsCount}
                </span>
              )}
            </Link>
          </Button>
        )}

        {isAdmin && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className={`${canAccessWriteOff ? "" : "sm:ml-auto"} h-9 rounded-control border border-border bg-surface px-3.5 py-2 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer`}
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
          isFinishedGoods={section === "finished-products"}
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
