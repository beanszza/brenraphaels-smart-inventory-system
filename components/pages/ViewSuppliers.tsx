"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  saveSupply,
  saveSupplier,
  saveRecipe,
  saveCategory,
  toggleCategoryStatus,
  type SupplyInput,
  type SupplierInput,
  type RecipeInput,
} from "@/lib/resources-suppliers/actions";
import type { ResourcesData } from "@/lib/resources-suppliers/data";
import { useRouter } from "next/navigation";
import { useIsAdmin, useIsImsManager } from "@/context/StaffContext";
import {
  SupplyItem,
  Supplier,
  Recipe,
  CategoryItem,
} from "@/components/resources-suppliers/types";
import CategoryTab from "@/components/resources-suppliers/CategoryTab";
import CategoryModal from "@/components/resources-suppliers/CategoryModal";
import SupplyTab from "@/components/resources-suppliers/SupplyTab";
import SupplierTab from "@/components/resources-suppliers/SupplierTab";
import RecipeTab from "@/components/resources-suppliers/RecipeTab";
import SupplyModal from "@/components/resources-suppliers/SupplyModal";
import SupplyDetailsModal from "@/components/resources-suppliers/SupplyDetailsModal";
import SupplierModal from "@/components/resources-suppliers/SupplierModal";
import SupplierDetailsModal from "@/components/resources-suppliers/SupplierDetailsModal";
import RecipeModal from "@/components/resources-suppliers/RecipeModal";
import { PageHeader } from "@/components/shared/PageHeader";

export default function ResourcesSuppliersPage({ data }: { data: ResourcesData }) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const isImsManager = useIsImsManager();

  // Admin: can see & configure BOM, but can ONLY see (cannot configure) Categories, Suppliers, and Supply.
  // IMS Manager: cannot see or configure BOM, but can see & configure Categories, Suppliers, and Supply.
  const canConfigureCatalog = !isAdmin;
  const canSeeBom = !isImsManager;

  const [message, setMessage] = useState("");

  // Process Tab Order: Categories -> Supplier List -> Supply List -> BOM
  const [activeTab, setActiveTab] = useState<"category" | "supplier" | "supply" | "recipe">("category");

  useEffect(() => {
    if (!canSeeBom && activeTab === "recipe") {
      setActiveTab("category");
    }
  }, [canSeeBom, activeTab]);

  const {
    supplies: supplyData,
    suppliers: supplierData,
    recipes: recipeData,
    products: finishedProductData,
    categories: supplyCategories,
    allCategories: categoryData = [],
    units: uoms,
  } = data;

  const [categoriesState, setCategoriesState] = useState<CategoryItem[]>(categoryData);
  useEffect(() => {
    setCategoriesState(categoryData);
  }, [categoryData]);

  // Active categories for Supply dropdowns (excludes inactive categories immediately)
  const activeSupplyCategories = useMemo(() => {
    if (categoriesState.length > 0) {
      return categoriesState
        .filter((c) => c.isActive !== false)
        .map((c) => ({ categoryId: c.categoryId, categoryName: c.categoryName, isActive: true }));
    }
    return supplyCategories.filter((c: any) => c.isActive !== false);
  }, [categoriesState, supplyCategories]);

  // Search & Filter State
  const [categoryStatusFilter, setCategoryStatusFilter] = useState("All");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [categoryPage, setCategoryPage] = useState(1);

  const [supplyFilter, setSupplyFilter] = useState("All");
  const [supplyStatusFilter, setSupplyStatusFilter] = useState("All");
  const [supplySearchQuery, setSupplySearchQuery] = useState("");
  const [supplyPage, setSupplyPage] = useState(1);

  useEffect(() => {
    if (
      supplyFilter !== "All" &&
      !activeSupplyCategories.some((c) => c.categoryName === supplyFilter)
    ) {
      setSupplyFilter("All");
    }
  }, [activeSupplyCategories, supplyFilter]);

  const [supplierFilter, setSupplierFilter] = useState("All");
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [supplierPage, setSupplierPage] = useState(1);

  const [recipeFilter, setRecipeFilter] = useState("All");
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [recipePage, setRecipePage] = useState(1);

  // Modals & Selected Items
  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);

  const [openSupplyModal, setOpenSupplyModal] = useState(false);
  const [editingSupply, setEditingSupply] = useState<SupplyItem | null>(null);
  const [viewSupply, setViewSupply] = useState<SupplyItem | null>(null);

  const [openSupplierModal, setOpenSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);

  const [openRecipeModal, setOpenRecipeModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const handleSaveCategory = async (input: { categoryName: string; description: string; isActive: boolean; hasExpiry: boolean }) => {
    const result = await saveCategory(input, editingCategory?.categoryId);
    if (!result.success) throw new Error(result.message);
    if (editingCategory) {
      setCategoriesState((prev) =>
        prev.map((c) =>
          c.categoryId === editingCategory.categoryId
            ? {
                ...c,
                categoryName: input.categoryName.trim(),
                description: input.description.trim(),
                isActive: input.isActive,
                hasExpiry: input.hasExpiry,
              }
            : c
        )
      );
    }
    setMessage(result.message);
    setOpenCategoryModal(false);
    setEditingCategory(null);
    setCategoryPage(1);
    router.refresh();
  };

  const handleToggleCategoryStatus = async (cat: CategoryItem) => {
    const nextActive = cat.isActive === false;
    const result = await toggleCategoryStatus(cat.categoryId, nextActive);
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    setCategoriesState((prev) =>
      prev.map((c) => (c.categoryId === cat.categoryId ? { ...c, isActive: nextActive } : c))
    );
    setMessage(result.message);
    router.refresh();
  };

  const handleSaveSupply = async (input: SupplyInput) => {
    const result = await saveSupply(input, editingSupply?.itemId);
    if (!result.success) throw new Error(result.message);
    setMessage(result.message);
    setOpenSupplyModal(false);
    setEditingSupply(null);
    setSupplyPage(1);
    router.refresh();
  };

  const handleSaveSupplier = async (input: SupplierInput) => {
    const result = await saveSupplier(input, editingSupplier?.supplierId);
    if (!result.success) throw new Error(result.message);
    setMessage(result.message);
    setOpenSupplierModal(false);
    setEditingSupplier(null);
    setSupplierPage(1);
    router.refresh();
  };

  const handleSaveRecipe = async (input: RecipeInput) => {
    const result = await saveRecipe(input, editingRecipe?.recipeId);
    if (!result.success) throw new Error(result.message);
    setMessage(result.message);
    setOpenRecipeModal(false);
    setEditingRecipe(null);
    setRecipePage(1);
    router.refresh();
  };

  const visibleTabs = [
    { id: "category", label: "CATEGORIES" },
    { id: "supplier", label: "SUPPLIER LIST" },
    { id: "supply", label: "SUPPLY LIST" },
    ...(canSeeBom ? [{ id: "recipe", label: "BILL OF MATERIAL" }] : []),
  ];

  return (
    <div className="w-full min-h-full py-7 px-4 sm:px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="Resources & Suppliers"
        description={
          canSeeBom
            ? "Manage your foundation data - Categories, Suppliers, Supply, and Recipes"
            : "Manage your foundation data - Categories, Suppliers, and Supply"
        }
      />

      {message && (
        <p role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          {message}
        </p>
      )}

      {/* Process Tabs in Uniform Order: Categories -> Supplier List -> Supply List -> BOM */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                  isActive
                    ? "border-primary text-primary -mb-px"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "category" && (
        <CategoryTab
          categories={categoriesState}
          searchQuery={categorySearchQuery}
          onSearchChange={setCategorySearchQuery}
          statusFilter={categoryStatusFilter}
          onStatusFilterChange={setCategoryStatusFilter}
          currentPage={categoryPage}
          onPageChange={setCategoryPage}
          canConfigure={canConfigureCatalog}
          onAddNew={() => {
            if (!canConfigureCatalog) return;
            setEditingCategory(null);
            setOpenCategoryModal(true);
          }}
          onEdit={(cat) => {
            if (!canConfigureCatalog) return;
            setEditingCategory(cat);
            setOpenCategoryModal(true);
          }}
        />
      )}

      {activeTab === "supplier" && (
        <SupplierTab
          suppliers={supplierData}
          searchQuery={supplierSearchQuery}
          onSearchChange={setSupplierSearchQuery}
          statusFilter={supplierFilter}
          onStatusFilterChange={setSupplierFilter}
          currentPage={supplierPage}
          onPageChange={setSupplierPage}
          isAuthorizedForReports={true}
          canConfigure={canConfigureCatalog}
          onAddNew={() => {
            if (!canConfigureCatalog) return;
            setEditingSupplier(null);
            setOpenSupplierModal(true);
          }}
          onEdit={(s) => {
            if (!canConfigureCatalog) return;
            setEditingSupplier(s);
            setOpenSupplierModal(true);
          }}
          onView={(s) => setViewSupplier(s)}
        />
      )}

      {activeTab === "supply" && (
        <SupplyTab
          supplies={supplyData}
          categories={activeSupplyCategories}
          searchQuery={supplySearchQuery}
          onSearchChange={setSupplySearchQuery}
          categoryFilter={supplyFilter}
          onCategoryFilterChange={setSupplyFilter}
          statusFilter={supplyStatusFilter}
          onStatusFilterChange={setSupplyStatusFilter}
          currentPage={supplyPage}
          onPageChange={setSupplyPage}
          isAuthorizedForReports={true}
          canConfigure={canConfigureCatalog}
          onAddNew={() => {
            if (!canConfigureCatalog) return;
            setEditingSupply(null);
            setOpenSupplyModal(true);
          }}
          onEdit={(item) => {
            if (!canConfigureCatalog) return;
            setEditingSupply(item);
            setOpenSupplyModal(true);
          }}
          onView={(item) => setViewSupply(item)}
        />
      )}

      {canSeeBom && activeTab === "recipe" && (
        <RecipeTab
          recipes={recipeData}
          searchQuery={recipeSearchQuery}
          onSearchChange={setRecipeSearchQuery}
          statusFilter={recipeFilter}
          onStatusFilterChange={setRecipeFilter}
          currentPage={recipePage}
          onPageChange={setRecipePage}
          isAuthorizedForReports={true}
          onAddNew={() => {
            setEditingRecipe(null);
            setOpenRecipeModal(true);
          }}
          onEdit={(r) => {
            setEditingRecipe(r);
            setOpenRecipeModal(true);
          }}
        />
      )}

      {/* Category Modal */}
      {canConfigureCatalog && (
        <CategoryModal
          open={openCategoryModal}
          editingCategory={editingCategory}
          existingCategories={categoriesState}
          onClose={() => {
            setOpenCategoryModal(false);
            setEditingCategory(null);
          }}
          onSave={handleSaveCategory}
        />
      )}

      {/* Supply Modal */}
      {canConfigureCatalog && (
        <SupplyModal
          open={openSupplyModal}
          editingItem={editingSupply}
          existingSupplies={supplyData}
          suppliers={supplierData.map((s) => ({
            supplierId: s.supplierId,
            companyName: s.companyName,
            supplierCode: s.supplierCode,
          }))}
          categories={activeSupplyCategories}
          uoms={uoms}
          onClose={() => {
            setOpenSupplyModal(false);
            setEditingSupply(null);
          }}
          onSave={handleSaveSupply}
        />
      )}
      <SupplyDetailsModal
        item={viewSupply}
        onClose={() => setViewSupply(null)}
        onEdit={
          canConfigureCatalog
            ? (item) => {
                setViewSupply(null);
                setEditingSupply(item);
                setOpenSupplyModal(true);
              }
            : undefined
        }
      />
      {canConfigureCatalog && (
        <SupplierModal
          open={openSupplierModal}
          editingSupplier={editingSupplier}
          onClose={() => {
            setOpenSupplierModal(false);
            setEditingSupplier(null);
          }}
          onSave={handleSaveSupplier}
        />
      )}
      <SupplierDetailsModal supplier={viewSupplier} onClose={() => setViewSupplier(null)} />
      {canSeeBom && (
        <RecipeModal
          open={openRecipeModal}
          editingRecipe={editingRecipe}
          finishedProducts={finishedProductData}
          baseSupplies={supplyData}
          onClose={() => {
            setOpenRecipeModal(false);
            setEditingRecipe(null);
          }}
          onSave={handleSaveRecipe}
        />
      )}
    </div>
  );
}
