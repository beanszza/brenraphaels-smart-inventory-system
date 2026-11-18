"use client";

import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import ModalWrapper from "./ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import { Recipe, FinishedProduct, SupplyItem, Ingredient } from "./types";
import RecipeIngredientItem from "./RecipeIngredientItem";
import { parseVariantComponents } from "@/lib/production/sku";

interface RecipeModalProps {
  open: boolean;
  editingRecipe: Recipe | null;
  finishedProducts: FinishedProduct[];
  baseSupplies: SupplyItem[];
  onClose: () => void;
  onSave: (data: {
    recipeName: string;
    productId: number;
    outputQuantity: number;
    ingredients: { itemId: number; uomId: number; standardQuantity: number }[];
    notes: string;
    isActive: boolean;
  }) => Promise<void>;
}

export default function RecipeModal(props: RecipeModalProps) {
  return props.open ? <RecipeModalForm key={props.editingRecipe?.recipeId ?? "new"} {...props} /> : null;
}

function RecipeModalForm({
  open,
  editingRecipe,
  finishedProducts,
  baseSupplies,
  onClose,
  onSave,
}: RecipeModalProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [recipeName, setRecipeName] = useState(editingRecipe?.recipeName ?? "");
  const [selectedProductName, setSelectedProductName] = useState(
    finishedProducts.find((p) => p.productId === editingRecipe?.productId)?.itemName ??
      finishedProducts[0]?.itemName ??
      ""
  );
  const [productId, setProductId] = useState<number>(
    editingRecipe?.productId ?? finishedProducts[0]?.productId ?? 0
  );
  const [batchSize, setBatchSize] = useState<string>(
    editingRecipe ? String(editingRecipe.outputQuantity) : ""
  );
  const [recipeActive, setRecipeActive] = useState(editingRecipe?.isActive ?? true);
  const [ingredients, setIngredients] = useState<Ingredient[]>(() =>
    editingRecipe?.ingredients.length
      ? editingRecipe.ingredients.map((i, index) => ({
          id: index + 1,
          itemId: i.itemId,
          uomId: i.uomId,
          quantity: String(i.standardQuantity),
        }))
      : [{ id: 1, itemId: 0, uomId: 0, quantity: "" }]
  );

  // Validation errors
  const [recipeNameError, setRecipeNameError] = useState("");
  const [batchSizeError, setBatchSizeError] = useState("");
  const [ingredientsErrors, setIngredientsErrors] = useState<{ [id: number]: string }>({});

  // Distinct product names configured in Configuration tab
  const distinctProductNames = useMemo(() => {
    const names = new Set<string>();
    finishedProducts.forEach((p) => {
      if (p.itemName && p.itemName.trim()) {
        names.add(p.itemName.trim());
      }
    });
    return Array.from(names);
  }, [finishedProducts]);

  // Variants available for the currently selected product
  const availableVariants = useMemo(() => {
    if (!selectedProductName) return [];
    return finishedProducts.filter((p) => p.itemName.trim() === selectedProductName.trim());
  }, [finishedProducts, selectedProductName]);

  // Handle Product change: automatically update Variant dropdown options & select first variant
  const handleProductChange = (prodName: string) => {
    setSelectedProductName(prodName);
    const variants = finishedProducts.filter((p) => p.itemName.trim() === prodName.trim());
    if (variants.length > 0) {
      setProductId(variants[0].productId);
    } else {
      setProductId(0);
    }
  };

  const handleRequestSave = () => {
    let isValid = true;

    if (!recipeName.trim()) {
      setRecipeNameError("Recipe Name is required.");
      isValid = false;
    }

    const parsedBatchSize = Number(batchSize);
    if (!batchSize.trim() || isNaN(parsedBatchSize) || parsedBatchSize <= 0) {
      setBatchSizeError("Please enter a valid target output quantity (greater than 0).");
      isValid = false;
    }

    if (!productId || productId <= 0) {
      isValid = false;
    }

    const errors: { [id: number]: string } = {};
    ingredients.forEach((ing) => {
      if (!ing.itemId || ing.itemId <= 0) {
        errors[ing.id] = "Please select an item.";
        isValid = false;
      } else if (!ing.quantity.trim() || Number(ing.quantity) <= 0) {
        errors[ing.id] = "Quantity must be greater than 0.";
        isValid = false;
      }
    });
    setIngredientsErrors(errors);

    if (!isValid) return;

    setConfirmSaveOpen(true);
  };

  const handleSave = async () => {
    const parsedBatchSize = Number(batchSize);
    setConfirmSaveOpen(false);
    setSaving(true);
    setSaveError("");
    try {
      await onSave({
        recipeName: recipeName.trim(),
        productId: Number(productId),
        outputQuantity: parsedBatchSize,
        ingredients: ingredients.map((i) => ({
          itemId: i.itemId,
          uomId: i.uomId,
          standardQuantity: Number(i.quantity),
        })),
        notes: editingRecipe?.notes ?? "",
        isActive: recipeActive,
      });
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Unable to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Form validity check
  const isFormInvalid =
    !recipeName.trim() ||
    !!recipeNameError ||
    !batchSize.trim() ||
    isNaN(Number(batchSize)) ||
    Number(batchSize) <= 0 ||
    !!batchSizeError ||
    !productId ||
    productId <= 0 ||
    ingredients.length === 0 ||
    ingredients.some(
      (i) => !i.itemId || i.itemId <= 0 || !i.quantity.trim() || Number(i.quantity) <= 0
    ) ||
    Object.values(ingredientsErrors).some((err) => !!err);

  return (
    <ModalWrapper
      open={open}
      title={editingRecipe ? "Edit Bill of Materials" : "Create Bill of Materials"}
      onClose={() => {
        if (!saving) onClose();
      }}
      size="max-w-[640px]"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleRequestSave();
        }}
      >
        {saveError && (
          <p role="alert" className="mb-3 type-body text-status-red font-medium animate-in fade-in-50">
            {saveError}
          </p>
        )}
        <fieldset disabled={saving} className="space-y-4">
          {/* Recipe Name */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Recipe Name <span className="text-status-red">*</span>
            </label>
            <Input
              type="text"
              maxLength={60}
              value={recipeName}
              onChange={(e) => {
                const val = e.target.value.slice(0, 60);
                setRecipeName(val);
                if (!val.trim()) setRecipeNameError("Recipe Name is required.");
                else setRecipeNameError("");
              }}
              placeholder="e.g. Ube Halaya Standard Batch"
              aria-invalid={!!recipeNameError}
              style={recipeNameError ? { borderColor: "var(--status-red)" } : undefined}
              className={`w-full h-10 rounded-control border ${
                recipeNameError ? "!border-status-red focus-visible:!ring-status-red" : "border-divider"
              } bg-surface px-3.5 type-body text-text-primary transition-colors focus:ring-1 focus:ring-accent focus:outline-none`}
            />
            {recipeNameError && (
              <p className="mt-1.5 type-caption font-medium text-status-red animate-in fade-in-50">
                {recipeNameError}
              </p>
            )}
          </div>

          {/* Row 2: Product, Variant, Target Output Quantity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
            {/* Product Selector */}
            <div className="sm:col-span-5">
              <label className="mb-1.5 block type-label font-semibold text-text-primary">
                Product <span className="text-status-red">*</span>
              </label>
              <select
                value={selectedProductName}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full h-10 rounded-control border border-divider bg-surface px-3.5 type-body text-text-primary focus:ring-1 focus:ring-accent focus:outline-none transition-colors"
              >
                {distinctProductNames.length === 0 ? (
                  <option value="">No products found (configure in Production)</option>
                ) : (
                  distinctProductNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Variant Selector */}
            <div className="sm:col-span-3">
              <label className="mb-1.5 block type-label font-semibold text-text-primary">
                Variant <span className="text-status-red">*</span>
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(Number(e.target.value))}
                className="w-full h-10 rounded-control border border-divider bg-surface px-3.5 type-body text-text-primary focus:ring-1 focus:ring-accent focus:outline-none transition-colors"
              >
                {availableVariants.length === 0 ? (
                  <option value={0}>No variant configured</option>
                ) : (
                  availableVariants.map((v) => (
                    <option key={v.productId} value={v.productId}>
                      {v.variant ? parseVariantComponents(v.variant).variantName : "Standard"}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Target Output Quantity (pcs) */}
            <div className="sm:col-span-4">
              <label className="mb-1.5 block type-label font-semibold text-text-primary">
                Target Output Quantity (pcs) <span className="text-status-red">*</span>
              </label>
              <Input
                type="number"
                min={1}
                step={1}
                value={batchSize}
                onChange={(e) => {
                  const val = e.target.value;
                  setBatchSize(val);
                  if (!val.trim() || Number(val) <= 0) {
                    setBatchSizeError("Must be > 0");
                  } else {
                    setBatchSizeError("");
                  }
                }}
                onKeyDown={(e) => {
                  if (["-", "+", "e", "E", "."].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                placeholder="e.g. 100"
                aria-invalid={!!batchSizeError}
                style={batchSizeError ? { borderColor: "var(--status-red)" } : undefined}
                className={`w-full h-10 rounded-control border ${
                  batchSizeError ? "!border-status-red focus-visible:!ring-status-red" : "border-divider"
                } bg-surface px-3.5 type-body text-text-primary transition-colors focus:ring-1 focus:ring-accent focus:outline-none`}
              />
              {batchSizeError && (
                <p className="mt-1.5 type-caption font-medium text-status-red animate-in fade-in-50">
                  {batchSizeError}
                </p>
              )}
            </div>
          </div>

          {/* Bill of Materials Section */}
          <div className="pt-2 border-t border-divider space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="type-label font-semibold text-text-primary uppercase tracking-wider">
                  Bill of Materials
                </h3>
                <span className="inline-flex items-center rounded-pill bg-surface-muted px-2 py-0.5 type-caption font-medium text-text-muted">
                  {ingredients.length} {ingredients.length === 1 ? "item" : "items"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {ingredients.map((ingredient, index) => (
                <RecipeIngredientItem
                  key={ingredient.id}
                  ingredient={ingredient}
                  index={index}
                  canRemove={ingredients.length > 1}
                  baseSupplies={baseSupplies}
                  excludedItemIds={ingredients
                    .filter((other) => other.id !== ingredient.id && other.itemId > 0)
                    .map((other) => other.itemId)}
                  error={ingredientsErrors[ingredient.id]}
                  onRemove={(id) => {
                    setIngredients((prev) => prev.filter((i) => i.id !== id));
                    setIngredientsErrors((prev) => {
                      const next = { ...prev };
                      delete next[id];
                      return next;
                    });
                  }}
                  onItemChange={(id, itemId, uomId) => {
                    setIngredients((prev) =>
                      prev.map((ing) => (ing.id === id ? { ...ing, itemId, uomId } : ing))
                    );
                    if (itemId > 0) {
                      setIngredientsErrors((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                      });
                    }
                  }}
                  onQuantityChange={(id, quantity) => {
                    setIngredients((prev) =>
                      prev.map((ing) => (ing.id === id ? { ...ing, quantity } : ing))
                    );
                    if (!quantity.trim() || Number(quantity) <= 0) {
                      setIngredientsErrors((prev) => ({
                        ...prev,
                        [id]: "Quantity must be greater than 0.",
                      }));
                    } else {
                      setIngredientsErrors((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                      });
                    }
                  }}
                />
              ))}
            </div>

            {/* Add Item Button */}
            <button
              type="button"
              onClick={() =>
                setIngredients((prev) => [
                  ...prev,
                  {
                    id: Date.now(),
                    itemId: 0,
                    quantity: "",
                    uomId: 0,
                  },
                ])
              }
              className="w-full h-10 rounded-control border border-dashed border-divider bg-surface/60 type-caption font-semibold text-text-primary hover:bg-hover hover:border-divider-strong transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Item</span>
            </button>
          </div>

          {/* Status (when editing) */}
          {editingRecipe && (
            <div>
              <label className="mb-1.5 block type-label font-semibold text-text-primary">Status</label>
              <select
                value={recipeActive ? "true" : "false"}
                onChange={(e) => setRecipeActive(e.target.value === "true")}
                className="w-full h-10 rounded-control border border-divider bg-surface text-text-primary px-3.5 type-body focus:ring-1 focus:ring-accent focus:outline-none"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 pt-5 pb-3 border-t border-divider mt-6 mb-2">
            <ModalCloseButton
              type="button"
              variant="outline"
              disabled={saving}
              fallbackOnClose={onClose}
              className="rounded-control border border-divider bg-surface px-5 py-2.5 type-label-button text-text-primary hover:bg-hover transition-colors"
            >
              Cancel
            </ModalCloseButton>
            <Button
              type="submit"
              disabled={isFormInvalid || saving}
              className="rounded-control bg-button-primary text-button-primary-foreground px-5 py-2.5 type-label-button hover:bg-button-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : editingRecipe ? "Save Changes" : "Create Recipe"}
            </Button>
          </div>
        </fieldset>
      </form>

      <ActionConfirmModal
        open={confirmSaveOpen}
        title={editingRecipe ? "Save Bill of Materials Changes" : "Create Bill of Materials"}
        subtitle={`Recipe: ${recipeName.trim() || "—"} • ${ingredients.length} ingredient(s)`}
        description={
          editingRecipe
            ? `Are you sure you want to save changes to recipe "${recipeName.trim()}"?`
            : `Are you sure you want to create the recipe "${recipeName.trim()}"?`
        }
        confirmLabel={editingRecipe ? "Save Changes" : "Create Recipe"}
        submitting={saving}
        onCancel={() => setConfirmSaveOpen(false)}
        onConfirm={handleSave}
      />
    </ModalWrapper>
  );
}
