"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import api from "@/lib/api";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/context/AuthContext";
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
  const c = (itemCat || "").toLowerCase();
  const f = filter.toLowerCase();
  if (f === "raw materials" || f === "raw material") return c.includes("raw");
  if (f === "ingredients" || f === "ingredient") return c.includes("ingredient");
  if (f === "tools and supplies" || f === "tools" || f === "tools & supplies" || f === "tool") {
    return c.includes("tool") || c.includes("suppl");
  }
  if (f === "finished goods" || f === "finished good") {
    return c.includes("finish") || c.includes("prod");
  }
  return c === f || c.includes(f);
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

export default function ViewInventory() {
  const auth = useAuth();
  const user = auth?.user;
  const isAuth =
    user?.username === "scmsuser" ||
    user?.username === "ERP-ADMIN" ||
    user?.email === "scmsuser@r3b2p.com" ||
    user?.email === "admin@r3b2p.com" ||
    user?.roles?.includes("Admin");

  const [allInventories, setAllInventories] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Raw Materials");
  const [productFilter, setProductFilter] = useState("All");
  const [page, setPage] = useState(1);

  // KPI Metrics
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({
    "Raw Materials": 0,
    Ingredients: 0,
    Tools: 0,
    "Finished Goods": 0,
  });

  // PR Modal State (for "Order Now" action)
  const [isCreatePROpen, setIsCreatePROpen] = useState(false);
  const [selectedPRData, setSelectedPRData] = useState<PurchaseRequisition | undefined>(undefined);

  const fetchInventories = useCallback(async () => {
    try {
      const res = await api.get(`/api/inventory?pageSize=1000`);
      if (res.data?.success) {
        const items: InventoryItem[] = res.data.data.items || res.data.data || [];
        setAllInventories(items);
      }
    } catch (e) {
      console.error("Failed to fetch inventories:", e);
    }
  }, []);

  const fetchKpiData = useCallback(async () => {
    try {
      // 1. Fetch inventories for total count & low-stock count
      const invRes = await api.get("/api/inventory?pageSize=1000");

      if (invRes.data?.success) {
        const items: InventoryItem[] = invRes.data.data.items || invRes.data.data || [];
        setTotalItemsCount(invRes.data.data.totalCount ?? items.length);
        const low = items.filter(
          (i) => i.isLowStock || i.currentStock <= i.minStockLevel
        ).length;
        setLowStockCount(low);

        const counts: Record<string, number> = {
          "Raw Materials": 0,
          Ingredients: 0,
          Tools: 0,
          "Finished Goods": 0,
        };
        items.forEach((item) => {
          const cat = (item.categoryName || "").toLowerCase();
          if (cat.includes("raw")) {
            counts["Raw Materials"] = (counts["Raw Materials"] || 0) + 1;
          } else if (cat.includes("ingredient")) {
            counts["Ingredients"] = (counts["Ingredients"] || 0) + 1;
          } else if (cat.includes("tool") || cat.includes("equip") || cat.includes("suppl")) {
            counts["Tools"] = (counts["Tools"] || 0) + 1;
          } else if (cat.includes("finish") || cat.includes("prod")) {
            counts["Finished Goods"] = (counts["Finished Goods"] || 0) + 1;
          }
        });
        setCategoryCounts(counts);
      }

      // 2. Fetch available lots for expiring soon count (<= 30 days)
      const lotsRes = await api.get("/api/inventory/lots?status=Available&pageSize=1000");

      if (lotsRes.data?.success) {
        const lots: LotItem[] = lotsRes.data.data.items || lotsRes.data.data || [];
        const now = new Date();
        const expiring = lots.filter((lot) => {
          if (!lot.expiryDate) return false;
          const exp = new Date(lot.expiryDate);
          const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 30;
        }).length;
        setExpiringSoonCount(expiring);
      }
    } catch (e) {
      console.error("Failed to fetch inventory KPI stats:", e);
    }
  }, []);

  useEffect(() => {
    fetchInventories();
  }, [fetchInventories]);

  useEffect(() => {
    fetchKpiData();
  }, [fetchKpiData]);

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
            const variantStock = v.currentStock ?? 0;
            const variantReserved = v.reservedStock ?? 0;
            const maxStock = item.maxStockLevel > 0 ? item.maxStockLevel : 100;
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

  const categoryTabs = [
    { id: "Raw Materials", label: "RAW MATERIALS" },
    { id: "Ingredients", label: "INGREDIENTS" },
    { id: "Tools and Supplies", label: "TOOLS & SUPPLIES" },
    { id: "Finished Goods", label: "FINISHED GOODS" },
  ];

  return (
    <div className="w-full min-h-full py-8 px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="Inventory Management"
        description="Monitor real-time warehouse stocks, ingredients, raw materials, and finished goods"
        actions={
          isAuth && (
            <Button size="sm" variant="outline" asChild className="gap-1.5 cursor-pointer">
              <Link href="/reports?tab=inventory">
                <FileText className="w-4 h-4" /> Reports
              </Link>
            </Button>
          )
        }
      />

      {/* 3 KPI Cards */}
      <InventorySummaryCards
        totalItems={totalItemsCount}
        lowStockCount={lowStockCount}
        expiringSoonCount={expiringSoonCount}
        categoryCounts={categoryCounts}
      />

      {/* Category Tabs */}
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
                <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                <SelectItem value="Ingredients">Ingredients</SelectItem>
                <SelectItem value="Tools and Supplies">Tools & Supplies</SelectItem>
                <SelectItem value="Finished Goods">Finished Goods</SelectItem>
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
            fetchInventories();
            fetchKpiData();
          }}
          initialData={selectedPRData}
        />
      )}
    </div>
  );
}
