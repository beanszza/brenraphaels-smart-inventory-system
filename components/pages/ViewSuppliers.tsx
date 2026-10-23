"use client";

import { createItem, updateItem } from "@/app/actions/resources/items";
import { createSupplier, updateSupplier } from "@/app/actions/resources/suppliers";
import { removeSupplierItem, saveSupplierItem, supplierItemsByItem } from "@/app/actions/resources/supplier-items";
import { createRecipe, updateRecipe } from "@/app/actions/resources/recipes";
import { actionResponse } from "@/lib/resources/action-response";


import React, { useState } from "react";
import { SupplyItem, Supplier, Recipe, FinishedProduct, UomOption } from "@/components/resources-suppliers/types";
import SupplyTab from "@/components/resources-suppliers/SupplyTab";
import SupplierTab from "@/components/resources-suppliers/SupplierTab";
import RecipeTab from "@/components/resources-suppliers/RecipeTab";
import SupplyModal, { SupplyCategory } from "@/components/resources-suppliers/SupplyModal";
import SupplyDetailsModal from "@/components/resources-suppliers/SupplyDetailsModal";
import SupplierModal from "@/components/resources-suppliers/SupplierModal";
import SupplierDetailsModal from "@/components/resources-suppliers/SupplierDetailsModal";
import RecipeModal from "@/components/resources-suppliers/RecipeModal";
import { loadResources } from "@/app/actions/resources/page-data";
import type { ResourcesData } from "@/lib/resources/data";
import { PageHeader } from "@/components/shared/PageHeader";

export default function ResourcesSuppliersPage({ initialData }: { initialData: ResourcesData }) {
  const [activeTab, setActiveTab] = useState<"supply" | "supplier" | "recipe">("supply");
  const [supplyData, setSupplyData] = useState<SupplyItem[]>(initialData.supplies);
  const [supplierData, setSupplierData] = useState<Supplier[]>(initialData.suppliers);
  const [recipeData, setRecipeData] = useState<Recipe[]>(initialData.recipes);
  const [finishedProductData, setFinishedProductData] = useState<FinishedProduct[]>(initialData.products);
  const [supplyCategories, setSupplyCategories] = useState<SupplyCategory[]>(initialData.categories);
  const [uoms, setUoms] = useState<UomOption[]>(initialData.units);

  // Search & Filter State
  const [supplyFilter, setSupplyFilter] = useState("All");
  const [supplyStatusFilter, setSupplyStatusFilter] = useState("All");
  const [supplySearchQuery, setSupplySearchQuery] = useState("");
  const [supplyPage, setSupplyPage] = useState(1);

  const [supplierFilter, setSupplierFilter] = useState("All");
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [supplierPage, setSupplierPage] = useState(1);

  const [recipeFilter, setRecipeFilter] = useState("All");
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [recipePage, setRecipePage] = useState(1);

  // Modals & Selected Items
  const [openSupplyModal, setOpenSupplyModal] = useState(false);
  const [editingSupply, setEditingSupply] = useState<SupplyItem | null>(null);
  const [viewSupply, setViewSupply] = useState<SupplyItem | null>(null);
  const [openSupplierModal, setOpenSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);
  const [openRecipeModal, setOpenRecipeModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const fetchData = async () => {
    const data = await loadResources();
    setSupplyData(data.supplies);
    setSupplierData(data.suppliers);
    setRecipeData(data.recipes);
    setFinishedProductData(data.products);
    setSupplyCategories(data.categories);
    setUoms(data.units);
  };

  const handleSaveSupply = async (data: any) => {
    try {
      const payload = {
        itemName: data.itemName, categoryId: data.categoryId, uomId: data.uomId,
        minStockLevel: data.minStock, maxStockLevel: data.maxStock, isActive: data.isActive,
      };
      let itemId: number;
      if (editingSupply) {
        await actionResponse(updateItem(editingSupply.itemId, payload));
        itemId = editingSupply.itemId;
      } else {
        const res = await actionResponse(createItem(payload));
        itemId = res.data.data.itemId;
      }
      // Sync linked suppliers
      if (itemId) {
        const targetSupplierIds: number[] = data.supplierIds || [];
        if (editingSupply) {
          try {
            const curRes = await actionResponse(supplierItemsByItem(itemId));
            const existingItems = curRes.data?.data || curRes.data || [];
            const existingIds: number[] = existingItems.map((s: any) => s.supplierId);

            const removedIds = existingIds.filter((id) => !targetSupplierIds.includes(id));
            await Promise.allSettled(
              removedIds.map((supplierId) => actionResponse(removeSupplierItem(supplierId, itemId)).catch(() => {}))
            );

            const addedIds = targetSupplierIds.filter((id) => !existingIds.includes(id));
            await Promise.allSettled(
              addedIds.map((supplierId) =>
                actionResponse(saveSupplierItem({
                  supplierId: supplierId,
                  itemId: itemId,
                  purchaseUomId: data.uomId,
                  unitPrice: 0,
                  leadTimeDays: 3,
                  packSize: 1,
                  minOrderQuantity: 1,
                  isPreferred: false,
                  isActive: true,
                })).catch(() => {})
              )
            );
          } catch {
            await Promise.allSettled(
              targetSupplierIds.map((supplierId) =>
                actionResponse(saveSupplierItem({
                  supplierId: supplierId,
                  itemId: itemId,
                  purchaseUomId: data.uomId,
                  unitPrice: 0,
                  leadTimeDays: 3,
                  packSize: 1,
                  minOrderQuantity: 1,
                  isPreferred: false,
                  isActive: true,
                })).catch(() => {})
              )
            );
          }
        } else if (targetSupplierIds.length > 0) {
          await Promise.allSettled(
            targetSupplierIds.map((supplierId: number) =>
              actionResponse(saveSupplierItem({
                supplierId: supplierId,
                itemId: itemId,
                purchaseUomId: data.uomId,
                unitPrice: 0,
                leadTimeDays: 3,
                packSize: 1,
                minOrderQuantity: 1,
                isPreferred: false,
                isActive: true,
              })).catch(() => {})
            )
          );
        }
      }
      setOpenSupplyModal(false); setEditingSupply(null); setSupplyPage(1); await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to save supply item.";
      alert(msg);
    }
  };

  const handleSaveSupplier = async (data: any) => {
    try {
      if (editingSupplier) await actionResponse(updateSupplier(editingSupplier.supplierId, data));
      else await actionResponse(createSupplier(data));
      setOpenSupplierModal(false); setEditingSupplier(null); setSupplierPage(1); await fetchData();
    } catch { alert("Failed to save supplier."); }
  };

  const handleSaveRecipe = async (data: any) => {
    try {
      const payload = {
        recipeName: data.recipeName,
        productId: data.productId,
        outputQuantity: data.outputQuantity,
        notes: data.notes,
        isActive: data.isActive,
        ingredients: data.ingredients,
      };
      if (editingRecipe) await actionResponse(updateRecipe(editingRecipe.recipeId, payload));
      else await actionResponse(createRecipe(payload));
      setOpenRecipeModal(false); setEditingRecipe(null); setRecipePage(1); await fetchData();
    } catch { alert("Failed to save recipe."); }
  };

  return (
    <div className="w-full min-h-full py-8 px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="Resources & Suppliers"
        description="Manage your foundation data - Supply, Suppliers, and Recipes"
      />

      {/* Process Tabs */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: "supply", label: "SUPPLY LIST" },
            { id: "supplier", label: "SUPPLIER LIST" },
            { id: "recipe", label: "BILL OF MATERIAL" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
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

      {activeTab === "supply" && (
        <SupplyTab
          supplies={supplyData} searchQuery={supplySearchQuery} onSearchChange={setSupplySearchQuery}
          categoryFilter={supplyFilter} onCategoryFilterChange={setSupplyFilter}
          statusFilter={supplyStatusFilter} onStatusFilterChange={setSupplyStatusFilter}
          currentPage={supplyPage} onPageChange={setSupplyPage} isAuthorizedForReports={true}
          onAddNew={() => { setEditingSupply(null); setOpenSupplyModal(true); }}
          onEdit={(item) => { setEditingSupply(item); setOpenSupplyModal(true); }}
          onView={(item) => setViewSupply(item)}
        />
      )}

      {activeTab === "supplier" && (
        <SupplierTab
          suppliers={supplierData} searchQuery={supplierSearchQuery} onSearchChange={setSupplierSearchQuery}
          statusFilter={supplierFilter} onStatusFilterChange={setSupplierFilter}
          currentPage={supplierPage} onPageChange={setSupplierPage} isAuthorizedForReports={true}
          onAddNew={() => { setEditingSupplier(null); setOpenSupplierModal(true); }}
          onEdit={(s) => { setEditingSupplier(s); setOpenSupplierModal(true); }}
          onView={(s) => setViewSupplier(s)}
        />
      )}

      {activeTab === "recipe" && (
        <RecipeTab
          recipes={recipeData} searchQuery={recipeSearchQuery} onSearchChange={setRecipeSearchQuery}
          statusFilter={recipeFilter} onStatusFilterChange={setRecipeFilter}
          currentPage={recipePage} onPageChange={setRecipePage} isAuthorizedForReports={true}
          onAddNew={() => { setEditingRecipe(null); setOpenRecipeModal(true); }}
          onEdit={(r) => { setEditingRecipe(r); setOpenRecipeModal(true); }}
        />
      )}

      <SupplyModal
        open={openSupplyModal}
        editingItem={editingSupply}
        existingSupplies={supplyData}
        suppliers={supplierData.map((s: any) => ({ supplierId: s.supplierId, companyName: s.companyName, supplierCode: s.supplierCode }))}
        categories={supplyCategories}
        uoms={uoms}
        onClose={() => { setOpenSupplyModal(false); setEditingSupply(null); }}
        onSave={handleSaveSupply}
      />
      <SupplyDetailsModal
        item={viewSupply}
        onClose={() => setViewSupply(null)}
        onEdit={(item) => {
          setViewSupply(null);
          setEditingSupply(item);
          setOpenSupplyModal(true);
        }}
      />
      <SupplierModal open={openSupplierModal} editingSupplier={editingSupplier} onClose={() => { setOpenSupplierModal(false); setEditingSupplier(null); }} onSave={handleSaveSupplier} />
      <SupplierDetailsModal supplier={viewSupplier} onClose={() => setViewSupplier(null)} />
      <RecipeModal open={openRecipeModal} editingRecipe={editingRecipe} finishedProducts={finishedProductData} baseSupplies={supplyData} onClose={() => { setOpenRecipeModal(false); setEditingRecipe(null); }} onSave={handleSaveRecipe} />
    </div>
  );
}
