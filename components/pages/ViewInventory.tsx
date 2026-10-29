"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import Pagination from "@/components/Pagination";
import { InventoryItem } from "@/components/inventory/types";
import { LotItem } from "@/components/lots/types";
import InventorySummaryCards from "@/components/inventory/InventorySummaryCards";
import InventoryTable from "@/components/inventory/InventoryTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatePRModal } from "@/components/orders-procurement/pr/CreatePRForm";
import { PurchaseRequisition } from "@/components/orders-procurement/types";

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
  asOf,
}: {
  initialInventories: InventoryItem[];
  initialLots: LotItem[];
  initialTotal: number;
  initialCategories?: { categoryId: number; categoryName: string }[];
  asOf: string;
}) {
  const router = useRouter();
  const allInventories = initialInventories;
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Raw Materials");
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

  // PR Modal State (for "Order Now" action)
  const [isCreatePROpen, setIsCreatePROpen] = useState(false);
  const [selectedPRData, setSelectedPRData] = useState<PurchaseRequisition | undefined>(undefined);

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
            const variantStock = (v.currentStock && v.currentStock > 0) ? v.currentStock : (item.currentStock ?? 0);
            const variantReserved = v.reservedStock ?? 0;
            const minStock = item.minStockLevel || 0;
            rows.push({
              ...item,
              inventoryId: `fp-${v.productId}`,
              variantName: v.variant || "Standard",
              variantSku: v.sku || item.itemCode || "",
              productId: v.productId,
              currentStock: variantStock,
              reservedStock: variantReserved,
              availableStock: Math.max(0, variantStock - variantReserved),
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

  // Order Now handler
  const handleOrderNow = (item: InventoryItem) => {
    const neededQty = Math.max(
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
          requestedQuantity: neededQty,
        },
      ],
    };

    setSelectedPRData(initialPR as PurchaseRequisition);
    setIsCreatePROpen(true);
  };

  return (
    <div className="w-full min-w-0 min-h-full py-6 px-4 sm:px-6 md:px-8 space-y-6 animate-page-in">
      <Toaster />
      <PageHeader
        title="Inventory Management"
        description="Monitor real-time warehouse stocks, ingredients, raw materials, and finished goods"
        actions={
          <Button size="sm" variant="outline" asChild className="gap-1.5 cursor-pointer">
            <Link href="/reports?tab=inventory">
              <FileText className="w-4 h-4" /> Reports
            </Link>
          </Button>
        }
      />

      {/* 3 KPI Cards */}
      <InventorySummaryCards
        totalItems={totalItemsCount}
        lowStockCount={lowStockCount}
        expiringSoonCount={expiringSoonCount}
        categoryCounts={categoryCounts}
      />

      {/* Dynamic Category Tabs */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          {categoryTabs.map((tab) => {
            const isActive = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCategoryFilter(tab.id);
                  setProductFilter("All");
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search, Product Filter (Finished Goods only), and Category Filter Bar */}
      <div className="border border-border rounded-md overflow-hidden bg-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-sm px-md py-sm bg-muted/20">
          <div className="flex items-center gap-sm flex-1">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              aria-label="Search inventory"
              placeholder="Search by name or Supply No (e.g. SPL-0001)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-body-sm flex-1 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex flex-wrap items-center gap-sm shrink-0">
            {/* Product Filter Dropdown: Show strictly only when on Finished Goods */}
            {categoryFilter === "Finished Goods" && availableFinishedProducts.length > 0 && (
              <Select
                value={productFilter}
                onValueChange={(val) => {
                  setProductFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 min-w-[180px] w-auto rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-sm focus:ring-1 focus:ring-ring">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent className="min-w-[180px]">
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
              <SelectTrigger className="h-10 min-w-[210px] w-auto rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-sm focus:ring-1 focus:ring-ring">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent className="min-w-[210px]">
                {categoryTabs.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    {tab.id === "Tools and Supplies" ? "Tools & Supplies" : tab.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table with progress bar & order now */}
      <InventoryTable
        items={paginatedInventories}
        currentPage={page}
        pageSize={pageSize}
        onOrderNow={handleOrderNow}
        isFinishedGoods={categoryFilter === "Finished Goods"}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
      />

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
    </div>
  );
}
