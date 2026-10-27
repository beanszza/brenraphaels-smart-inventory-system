"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import ModalWrapper from "./ModalWrapper";
import { Recipe, FinishedProduct, SupplyItem, Ingredient } from "./types";
import RecipeIngredientItem from "./RecipeIngredientItem";
import api from "@/lib/api";

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
  }) => void;
}

export default function RecipeModal({
  open,
  editingRecipe,
  finishedProducts,
  baseSupplies,
  onClose,
  onSave,
}: RecipeModalProps) {
  const [recipeCode, setRecipeCode] = useState("");
  const [recipeName, setRecipeName] = useState("");
  const [selectedProductName, setSelectedProductName] = useState("");
  const [productId, setProductId] = useState<number>(0);
  const [batchSize, setBatchSize] = useState<string>("");
  const [recipeActive, setRecipeActive] = useState(true);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

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

  // Fetch next recipe code or populate from editing recipe
  useEffect(() => {
    if (open) {
      if (editingRecipe) {
        setRecipeCode(editingRecipe.recipeCode || "");
        setRecipeName(editingRecipe.recipeName || "");
        const matchedFp = finishedProducts.find((p) => p.productId === editingRecipe.productId);
        if (matchedFp) {
          setSelectedProductName(matchedFp.itemName);
          setProductId(matchedFp.productId);
        } else if (finishedProducts.length > 0) {
          setSelectedProductName(finishedProducts[0].itemName);
          setProductId(finishedProducts[0].productId);
        }

        const currentOutput = Number(editingRecipe.outputQuantity) > 0 ? String(editingRecipe.outputQuantity) : "";
        setBatchSize(currentOutput);
        setRecipeActive(editingRecipe.isActive);

        if (editingRecipe.ingredients?.length > 0) {
          setIngredients(
            editingRecipe.ingredients.map((ing, idx) => ({
              id: Date.now() + idx,
              itemId: ing.itemId,
              quantity: ing.standardQuantity.toString(),
              uomId: ing.uomId || baseSupplies.find((s) => s.itemId === ing.itemId)?.uomId || 0,
            }))
          );
        } else {
          setIngredients([
            { id: Date.now(), itemId: 0, quantity: "", uomId: 0 },
          ]);
        }
      } else {
        // Create mode: fetch upcoming sequence number
        api.get("/api/recipes/next-code")
          .then((res: any) => {
            if (res.data?.nextCode) {
              setRecipeCode(res.data.nextCode);
            } else {
              setRecipeCode(`BOM-${new Date().getFullYear()}-0001`);
            }
          })
          .catch(() => {
            setRecipeCode(`BOM-${new Date().getFullYear()}-0001`);
          });

        setRecipeName("");
        if (distinctProductNames.length > 0) {
          const firstProd = distinctProductNames[0];
          setSelectedProductName(firstProd);
          const firstVariant = finishedProducts.find((p) => p.itemName.trim() === firstProd.trim());
          setProductId(firstVariant?.productId ?? 0);
        } else {
          setSelectedProductName("");
          setProductId(0);
        }

        setBatchSize("");
        setRecipeActive(true);
        // Start with empty unselected item so dropdown prompts "Select item"
        setIngredients([
          { id: Date.now(), itemId: 0, quantity: "", uomId: 0 },
        ]);
      }

      setRecipeNameError("");
      setBatchSizeError("");
      setIngredientsErrors({});
    }
  }, [editingRecipe, open, finishedProducts, distinctProductNames, baseSupplies]);

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

  const handleSave = () => {
    let isValid = true;

    if (!recipeName.trim()) {
      setRecipeNameError("Recipe Name is required.");
      isValid = false;
    }

    const parsedBatchSize = Number(batchSize);
    if (!batchSize.trim() || isNaN(parsedBatchSize) || parsedBatchSize <= 0) {
      setBatchSizeError("Please enter a valid batch size (greater than 0).");
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

    onSave({
      recipeName: recipeName.trim(),
      productId: Number(productId),
      outputQuantity: parsedBatchSize,
      ingredients: ingredients.map((i) => ({
        itemId: i.itemId,
        uomId: i.uomId,
        standardQuantity: Number(i.quantity),
      })),
      notes: "",
      isActive: recipeActive,
    });
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
    ingredients.some((i) => !i.itemId || i.itemId <= 0 || !i.quantity.trim() || Number(i.quantity) <= 0) ||
    Object.values(ingredientsErrors).some((err) => !!err);

  return (
    <ModalWrapper
      open={open}
      title={editingRecipe ? "Edit Bill of Materials" : "Create Bill of Materials"}
      onClose={onClose}
      size="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Recipe Name */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">
            Recipe Name <span className="text-destructive">*</span>
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
            style={recipeNameError ? { borderColor: "var(--destructive)" } : undefined}
            className={`w-full h-10 rounded-xl border ${
              recipeNameError ? "!border-destructive focus-visible:!ring-destructive" : "border-border"
            } bg-card px-3.5 text-sm text-foreground transition-colors focus:ring-1 focus:ring-ring focus:outline-none`}
          />
          {recipeNameError && (
            <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{recipeNameError}</p>
          )}
        </div>

        {/* Row 2: Product, Variant, Batch Size */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          {/* Product Selector */}
          <div className="sm:col-span-5">
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Product <span className="text-destructive">*</span>
            </label>
            <select
              value={selectedProductName}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-card px-3.5 text-sm text-foreground focus:ring-1 focus:ring-ring focus:outline-none transition-colors"
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
          <div className="sm:col-span-4">
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Variant <span className="text-destructive">*</span>
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(Number(e.target.value))}
              className="w-full h-10 rounded-xl border border-border bg-card px-3.5 text-sm text-foreground focus:ring-1 focus:ring-ring focus:outline-none transition-colors"
            >
              {availableVariants.length === 0 ? (
                <option value={0}>No variant configured</option>
              ) : (
                availableVariants.map((v) => (
                  <option key={v.productId} value={v.productId}>
                    {v.variant ? v.variant : "Standard"}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Batch Size (pcs) */}
          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Batch Size (pcs) <span className="text-destructive">*</span>
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
              style={batchSizeError ? { borderColor: "var(--destructive)" } : undefined}
              className={`w-full h-10 rounded-xl border ${
                batchSizeError ? "!border-destructive focus-visible:!ring-destructive" : "border-border"
              } bg-card px-3.5 text-sm text-foreground transition-colors focus:ring-1 focus:ring-ring focus:outline-none`}
            />
            {batchSizeError && (
              <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{batchSizeError}</p>
            )}
          </div>
        </div>

        {/* Bill of Materials Section */}
        <div className="pt-2 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Bill of Materials
              </h3>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
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
            className="w-full h-10 rounded-xl border border-dashed border-border bg-card/60 text-xs font-semibold text-foreground hover:bg-muted/70 hover:border-foreground/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
        </div>

        {/* Status (when editing) */}
        {editingRecipe && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">Status</label>
            <select
              value={recipeActive ? "true" : "false"}
              onChange={(e) => setRecipeActive(e.target.value === "true")}
              className="w-full h-10 rounded-xl border border-border bg-card text-foreground px-3.5 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isFormInvalid}
            onClick={handleSave}
            className="rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:bg-foreground/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editingRecipe ? "Save Changes" : "Create Recipe"}
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
}
