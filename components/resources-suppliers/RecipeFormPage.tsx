"use client";

import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus, Trash2, Check } from "lucide-react";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import {
  Recipe,
  FinishedProduct,
  SupplyItem,
  CategoryOption,
} from "./types";
import { parseVariantComponents } from "@/lib/production/sku";
import {
  DEFAULT_PRODUCTION_STAGES,
  countWords,
  decodeRecipeNotes,
} from "@/lib/resources-suppliers/recipe-stages";

interface CategoryIngredientRow {
  id: number;
  categoryName: string;
  itemId: number;
  uomId: number;
  quantity: string;
}

interface RecipeFormPageProps {
  editingRecipe: Recipe | null;
  finishedProducts: FinishedProduct[];
  baseSupplies: SupplyItem[];
  categories: CategoryOption[];
  onCancel: () => void;
  onSave: (data: {
    recipeName: string;
    productId: number;
    outputQuantity: number;
    ingredients: { itemId: number; uomId: number; standardQuantity: number }[];
    notes: string;
    stages: string[];
    isActive: boolean;
  }) => Promise<void>;
}

export default function RecipeFormPage({
  editingRecipe,
  finishedProducts,
  baseSupplies,
  categories,
  onCancel,
  onSave,
}: RecipeFormPageProps) {
  const decodedInitial = useMemo(
    () => decodeRecipeNotes(editingRecipe?.notes),
    [editingRecipe?.notes]
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

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
  const [notes, setNotes] = useState<string>(decodedInitial.notes);

  // Active categories list (from Categories tab + any category present on baseSupplies)
  const availableCategories = useMemo(() => {
    const map = new Map<string, CategoryOption>();
    categories.forEach((c) => {
      if (c.categoryName && !c.categoryName.toLowerCase().includes("finished good")) {
        map.set(c.categoryName, c);
      }
    });
    baseSupplies.forEach((s) => {
      if (
        s.categoryName &&
        !s.categoryName.toLowerCase().includes("finished good") &&
        !map.has(s.categoryName)
      ) {
        map.set(s.categoryName, {
          categoryId: s.categoryId,
          categoryName: s.categoryName,
        });
      }
    });
    return Array.from(map.values());
  }, [categories, baseSupplies]);

  // Determine initial checked categories & rows
  const initialSetup = useMemo(() => {
    if (editingRecipe && editingRecipe.ingredients.length > 0) {
      const rows: CategoryIngredientRow[] = [];
      const checkedSet = new Set<string>();

      editingRecipe.ingredients.forEach((ing, idx) => {
        const supply = baseSupplies.find((s) => s.itemId === ing.itemId);
        const catName =
          supply?.categoryName ||
          availableCategories[0]?.categoryName ||
          "Ingredients";
        checkedSet.add(catName);
        rows.push({
          id: idx + 1,
          categoryName: catName,
          itemId: ing.itemId,
          uomId: ing.uomId || supply?.uomId || 0,
          quantity: String(ing.standardQuantity),
        });
      });

      return {
        checkedCategories: Array.from(checkedSet),
        rows,
      };
    }

    const defaultCat =
      availableCategories.find((c) => c.categoryName.toLowerCase() === "ingredients")?.categoryName ??
      availableCategories[0]?.categoryName ??
      "Ingredients";

    return {
      checkedCategories: defaultCat ? [defaultCat] : [],
      rows: defaultCat
        ? [{ id: 1, categoryName: defaultCat, itemId: 0, uomId: 0, quantity: "" }]
        : [],
    };
  }, [editingRecipe, baseSupplies, availableCategories]);

  const [checkedCategories, setCheckedCategories] = useState<string[]>(
    initialSetup.checkedCategories
  );
  const [rows, setRows] = useState<CategoryIngredientRow[]>(initialSetup.rows);

  // Production Stages checklist state
  const initialStagesList = useMemo(() => {
    const savedStages = editingRecipe?.stages?.length
      ? editingRecipe.stages
      : decodedInitial.stages;
    const combined = new Set<string>([...DEFAULT_PRODUCTION_STAGES, ...savedStages]);
    return Array.from(combined);
  }, [editingRecipe?.stages, decodedInitial.stages]);

  const [availableStages, setAvailableStages] = useState<string[]>(initialStagesList);
  const [checkedStages, setCheckedStages] = useState<string[]>(
    editingRecipe?.stages?.length ? editingRecipe.stages : decodedInitial.stages
  );
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");

  // Validation errors
  const [recipeNameError, setRecipeNameError] = useState("");
  const [batchSizeError, setBatchSizeError] = useState("");
  const [notesError, setNotesError] = useState("");
  const [stagesError, setStagesError] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  // Distinct product names
  const distinctProductNames = useMemo(() => {
    const names = new Set<string>();
    finishedProducts.forEach((p) => {
      if (p.itemName && p.itemName.trim()) {
        names.add(p.itemName.trim());
      }
    });
    return Array.from(names);
  }, [finishedProducts]);

  // Variants for selected product
  const availableVariants = useMemo(() => {
    if (!selectedProductName) return [];
    return finishedProducts.filter(
      (p) => p.itemName.trim() === selectedProductName.trim()
    );
  }, [finishedProducts, selectedProductName]);

  const handleProductChange = (prodName: string) => {
    setSelectedProductName(prodName);
    const variants = finishedProducts.filter(
      (p) => p.itemName.trim() === prodName.trim()
    );
    if (variants.length > 0) {
      setProductId(variants[0].productId);
    } else {
      setProductId(0);
    }
  };

  // Toggle a Category checkbox on the right panel
  const handleToggleCategory = (categoryName: string) => {
    setCheckedCategories((prev) => {
      const exists = prev.includes(categoryName);
      if (exists) {
        return prev.filter((c) => c !== categoryName);
      }
      return [...prev, categoryName];
    });

    // If checking a category that has no rows yet, initialize 1 empty row for it
    setRows((prev) => {
      const hasRow = prev.some((r) => r.categoryName === categoryName);
      if (!hasRow) {
        return [
          ...prev,
          {
            id: Date.now() + Math.floor(Math.random() * 1000),
            categoryName,
            itemId: 0,
            uomId: 0,
            quantity: "",
          },
        ];
      }
      return prev;
    });
  };

  // Toggle a Production Stage checkbox on the right panel
  const handleToggleStage = (stageName: string) => {
    setCheckedStages((prev) => {
      const exists = prev.includes(stageName);
      const next = exists
        ? prev.filter((s) => s !== stageName)
        : availableStages.filter((s) => s === stageName || prev.includes(s));
      if (next.length > 0) setStagesError("");
      return next;
    });
  };

  // Add custom Production Stage
  const handleConfirmAddStage = () => {
    const trimmed = newStageName.trim().replace(/[|\]]/g, "");
    if (!trimmed) {
      setAddingStage(false);
      setNewStageName("");
      return;
    }
    const existing = availableStages.find(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );
    const targetName = existing || trimmed;
    if (!existing) {
      setAvailableStages((prev) => [...prev, targetName]);
    }
    setCheckedStages((prev) =>
      prev.includes(targetName) ? prev : [...prev, targetName]
    );
    setStagesError("");
    setNewStageName("");
    setAddingStage(false);
  };

  // Active rows belonging ONLY to checked categories
  const activeRows = useMemo(
    () => rows.filter((r) => checkedCategories.includes(r.categoryName)),
    [rows, checkedCategories]
  );

  const wordCount = useMemo(() => countWords(notes), [notes]);

  const handleRequestSave = () => {
    let isValid = true;

    if (!recipeName.trim()) {
      setRecipeNameError("Recipe Name is required.");
      isValid = false;
    }

    const parsedBatchSize = Number(batchSize);
    if (!batchSize.trim() || isNaN(parsedBatchSize) || parsedBatchSize <= 0) {
      setBatchSizeError("Please enter a valid yield per batch (greater than 0).");
      isValid = false;
    }

    if (!productId || productId <= 0) {
      isValid = false;
    }

    if (wordCount > 100) {
      setNotesError("Notes cannot exceed 100 words.");
      isValid = false;
    }

    if (checkedStages.length === 0) {
      setStagesError("Please check at least one production stage.");
      isValid = false;
    }

    if (checkedCategories.length === 0 || activeRows.length === 0) {
      setSaveError("Check at least one category and add at least one item.");
      isValid = false;
    }

    const nextRowErrors: Record<number, string> = {};
    activeRows.forEach((r) => {
      if (!r.itemId || r.itemId <= 0) {
        nextRowErrors[r.id] = "Please select an item.";
        isValid = false;
      } else if (!r.quantity.trim() || Number(r.quantity) <= 0) {
        nextRowErrors[r.id] = "Quantity must be greater than 0.";
        isValid = false;
      }
    });
    setRowErrors(nextRowErrors);

    if (!isValid) return;

    setSaveError("");
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
        ingredients: activeRows.map((r) => ({
          itemId: r.itemId,
          uomId: r.uomId,
          standardQuantity: Number(r.quantity),
        })),
        notes: notes.trim(),
        stages: checkedStages,
        isActive: recipeActive,
      });
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedIds = useMemo(
    () => activeRows.filter((r) => r.itemId > 0).map((r) => r.itemId),
    [activeRows]
  );

  return (
    <div className="space-y-5 animate-page-in">
      {/* Top Back Link & Header */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setConfirmDiscardOpen(true)}
          className="inline-flex items-center gap-1 type-body-secondary text-ink-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Recipes</span>
        </button>
        <div>
          <h1 className="type-page-title text-ink">
            {editingRecipe ? "Edit recipe" : "New recipe"}
          </h1>
          <p className="mt-1 type-body text-ink-muted">
            List what one batch uses. Production deducts these amounts from stock.
          </p>
        </div>
      </div>

      {saveError && (
        <div
          role="alert"
          className="rounded-control border border-destructive bg-status-red-bg px-4 py-3 type-body text-status-red-fg"
        >
          {saveError}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRequestSave();
        }}
        className="space-y-6"
      >
        <fieldset disabled={saving} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN (Product + Checked Category Sections + Notes) */}
          <div className="lg:col-span-8 space-y-5">
            {/* 1. Product Card */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-4">
              <h2 className="type-card-title text-ink">Product</h2>

              {/* Recipe Name */}
              <div>
                <label
                  htmlFor="recipe-name-input"
                  className="mb-1.5 block type-label text-ink"
                >
                  Recipe Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="recipe-name-input"
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
                  className="h-10 w-full rounded-control border border-input bg-surface px-3.5 type-body text-ink shadow-none focus:ring-1 focus:ring-ring"
                />
                {recipeNameError && (
                  <p className="mt-1.5 type-caption text-destructive">
                    {recipeNameError}
                  </p>
                )}
              </div>

              {/* Product * & Variant * */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="recipe-product-select"
                    className="mb-1.5 block type-label text-ink"
                  >
                    Product <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="recipe-product-select"
                    value={selectedProductName}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="h-10 w-full rounded-control border border-input bg-surface px-3.5 type-body text-ink focus:ring-1 focus:ring-ring focus:outline-none"
                  >
                    {distinctProductNames.length === 0 ? (
                      <option value="">No products found</option>
                    ) : (
                      distinctProductNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="recipe-variant-select"
                    className="mb-1.5 block type-label text-ink"
                  >
                    Variant <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="recipe-variant-select"
                    value={productId}
                    onChange={(e) => setProductId(Number(e.target.value))}
                    className="h-10 w-full rounded-control border border-input bg-surface px-3.5 type-body text-ink focus:ring-1 focus:ring-ring focus:outline-none"
                  >
                    {availableVariants.length === 0 ? (
                      <option value={0}>No variant configured</option>
                    ) : (
                      availableVariants.map((v) => (
                        <option key={v.productId} value={v.productId}>
                          {v.variant
                            ? parseVariantComponents(v.variant).variantName
                            : "Standard"}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Yield per batch * (+ Status when editing) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="recipe-yield-input"
                    className="mb-1.5 block type-label text-ink"
                  >
                    Yield per batch <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      id="recipe-yield-input"
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
                      placeholder="40"
                      className="h-10 w-full rounded-control border border-input bg-surface pl-3.5 pr-12 type-body text-ink shadow-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 type-body text-ink-muted">
                      pcs
                    </span>
                  </div>
                  {batchSizeError && (
                    <p className="mt-1.5 type-caption text-destructive">
                      {batchSizeError}
                    </p>
                  )}
                </div>

                {editingRecipe && (
                  <div>
                    <label
                      htmlFor="recipe-status-select"
                      className="mb-1.5 block type-label text-ink"
                    >
                      Status
                    </label>
                    <select
                      id="recipe-status-select"
                      value={recipeActive ? "true" : "false"}
                      onChange={(e) => setRecipeActive(e.target.value === "true")}
                      className="h-10 w-full rounded-control border border-input bg-surface px-3.5 type-body text-ink focus:ring-1 focus:ring-ring focus:outline-none"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Dynamic Category Section Cards (only for checked categories) */}
            {checkedCategories.length === 0 ? (
              <div className="rounded-card border border-dashed border-border bg-surface p-8 text-center type-body text-ink-muted">
                Check one or more active categories on the right panel to add items to this recipe.
              </div>
            ) : (
              checkedCategories.map((catName) => {
                const catRows = rows.filter((r) => r.categoryName === catName);
                const catSupplies = baseSupplies.filter(
                  (s) =>
                    s.isActive !== false &&
                    s.categoryName.toLowerCase() === catName.toLowerCase()
                );
                const isIngredientsCat = catName.toLowerCase() === "ingredients";
                const itemHeaderLabel = isIngredientsCat ? "Ingredient" : "Item";
                const addBtnLabel = isIngredientsCat
                  ? "Add ingredient"
                  : `Add ${catName.toLowerCase()}`;

                return (
                  <div
                    key={catName}
                    className="rounded-card border border-border bg-surface p-5 space-y-4"
                  >
                    <div>
                      <h2 className="type-card-title text-ink">{catName}</h2>
                      <p className="mt-0.5 type-caption text-ink-muted">
                        Amounts for one batch of {batchSize.trim() || "0"} pcs.
                      </p>
                    </div>

                    {/* Items Grid (Figma layout without Cost and without redundant Category box) */}
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-7 type-table-header text-ink-muted">
                          {itemHeaderLabel}
                        </div>
                        <div className="col-span-2 type-table-header text-ink-muted">
                          Qty
                        </div>
                        <div className="col-span-2 type-table-header text-ink-muted">
                          Unit
                        </div>
                        <div className="col-span-1" />
                      </div>

                      {catRows.map((row) => {
                        const selectedSupply = baseSupplies.find(
                          (s) => s.itemId === row.itemId
                        );
                        const uomDisplay = selectedSupply?.uomName || "—";
                        const rowErr = rowErrors[row.id];

                        // Supplies for this category not selected in other rows
                        const selectableSupplies = catSupplies.filter(
                          (s) =>
                            s.itemId === row.itemId || !selectedIds.includes(s.itemId)
                        );

                        return (
                          <div key={row.id} className="space-y-1">
                            <div className="grid grid-cols-12 gap-3 items-center">
                              {/* Item Dropdown */}
                              <div className="col-span-7">
                                <select
                                  aria-label={`${catName} item`}
                                  value={row.itemId || ""}
                                  onChange={(e) => {
                                    const newId = Number(e.target.value);
                                    const supply = baseSupplies.find(
                                      (s) => s.itemId === newId
                                    );
                                    setRows((prev) =>
                                      prev.map((r) =>
                                        r.id === row.id
                                          ? {
                                              ...r,
                                              itemId: newId,
                                              uomId: supply?.uomId || 0,
                                            }
                                          : r
                                      )
                                    );
                                    if (newId > 0) {
                                      setRowErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[row.id];
                                        return next;
                                      });
                                    }
                                  }}
                                  className="h-9 w-full rounded-control border border-input bg-surface px-3 type-body text-ink focus:ring-1 focus:ring-ring focus:outline-none"
                                >
                                  <option value="" disabled>
                                    Select {itemHeaderLabel.toLowerCase()}
                                  </option>
                                  {selectableSupplies.map((supply) => (
                                    <option key={supply.itemId} value={supply.itemId}>
                                      {supply.itemName}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Qty Input */}
                              <div className="col-span-2">
                                <Input
                                  aria-label={`${catName} quantity`}
                                  type="number"
                                  min={0.001}
                                  step="any"
                                  placeholder="0"
                                  value={row.quantity}
                                  onKeyDown={(e) => {
                                    if (["-", "+", "e", "E"].includes(e.key)) {
                                      e.preventDefault();
                                    }
                                  }}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRows((prev) =>
                                      prev.map((r) =>
                                        r.id === row.id ? { ...r, quantity: val } : r
                                      )
                                    );
                                    if (val.trim() && Number(val) > 0) {
                                      setRowErrors((prev) => {
                                        const next = { ...prev };
                                        delete next[row.id];
                                        return next;
                                      });
                                    }
                                  }}
                                  className="h-9 w-full rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring"
                                />
                              </div>

                              {/* Read-only plain Unit text (matches Figma) */}
                              <div className="col-span-2 type-body text-ink-muted truncate">
                                {uomDisplay}
                              </div>

                              {/* Remove Row Button */}
                              <div className="col-span-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (catRows.length <= 1) {
                                      // Reset the single row if only 1 left in this category
                                      setRows((prev) =>
                                        prev.map((r) =>
                                          r.id === row.id
                                            ? { ...r, itemId: 0, uomId: 0, quantity: "" }
                                            : r
                                        )
                                      );
                                    } else {
                                      setRows((prev) =>
                                        prev.filter((r) => r.id !== row.id)
                                      );
                                    }
                                    setRowErrors((prev) => {
                                      const next = { ...prev };
                                      delete next[row.id];
                                      return next;
                                    });
                                  }}
                                  className="p-1.5 rounded-control text-ink-muted hover:text-destructive hover:bg-subtle transition-colors cursor-pointer"
                                  title="Remove item"
                                  aria-label="Remove item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {rowErr && (
                              <p className="type-caption text-destructive">{rowErr}</p>
                            )}
                          </div>
                        );
                      })}

                      {/* + Add row button */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setRows((prev) => [
                              ...prev,
                              {
                                id: Date.now() + Math.floor(Math.random() * 1000),
                                categoryName: catName,
                                itemId: 0,
                                uomId: 0,
                                quantity: "",
                              },
                            ])
                          }
                          className="inline-flex items-center gap-1.5 type-body font-medium text-primary hover:underline cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{addBtnLabel}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* 3. Notes Card */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="type-card-title text-ink">Notes</h2>
                <span
                  className={`type-caption tabular-nums ${
                    wordCount > 100 ? "text-destructive font-medium" : "text-ink-muted"
                  }`}
                >
                  {wordCount} / 100 words
                </span>
              </div>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => {
                  const val = e.target.value;
                  const words = val.trim() ? val.trim().split(/\s+/) : [];
                  if (words.length <= 100 || val.length < notes.length) {
                    setNotes(val);
                    setNotesError("");
                  } else {
                    setNotesError("Notes cannot exceed 100 words.");
                  }
                }}
                placeholder="1. Peel, boil and grate the ube.&#10;2. Melt butter, add condensed and evaporated milk.&#10;3. Add ube and sugar; stir on low heat until thick."
                className="w-full rounded-control border border-input bg-surface p-3 type-body text-ink focus:ring-1 focus:ring-ring focus:outline-none resize-y"
              />
              {notesError && (
                <p className="type-caption text-destructive">{notesError}</p>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (Categories Checklist + Production Stages Checklist) */}
          <div className="lg:col-span-4 space-y-5">
            {/* 1. Categories Checklist Card */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-4">
              <div>
                <h2 className="type-card-title text-ink">Categories</h2>
                <p className="mt-1 type-caption text-ink-muted">
                  Check active categories to show their section on the left and add items.
                </p>
              </div>

              <div className="space-y-2.5">
                {availableCategories.length === 0 ? (
                  <p className="type-caption text-ink-muted">
                    No active categories found.
                  </p>
                ) : (
                  availableCategories.map((cat) => {
                    const isChecked = checkedCategories.includes(cat.categoryName);
                    return (
                      <label
                        key={cat.categoryId || cat.categoryName}
                        className="flex items-center gap-2.5 cursor-pointer select-none group"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCategory(cat.categoryName)}
                          className="sr-only"
                        />
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                            isChecked
                              ? "border-primary bg-primary text-on-brand"
                              : "border-input bg-surface group-hover:border-primary"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </span>
                        <span className="type-body text-ink">{cat.categoryName}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* 2. Production Stages Checklist Card */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-4">
              <div>
                <h2 className="type-card-title text-ink">Production Stages</h2>
                <p className="mt-1 type-caption text-ink-muted">
                  Checked stages will appear in Production Tracking for batches using this recipe.
                </p>
              </div>

              <div className="space-y-2.5">
                {availableStages.map((stageName) => {
                  const isChecked = checkedStages.includes(stageName);
                  return (
                    <label
                      key={stageName}
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleStage(stageName)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                          isChecked
                            ? "border-primary bg-primary text-on-brand"
                            : "border-input bg-surface group-hover:border-primary"
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </span>
                      <span className="type-body text-ink">{stageName}</span>
                    </label>
                  );
                })}
              </div>

              {stagesError && (
                <p className="type-caption text-destructive">{stagesError}</p>
              )}

              {/* + Add Stage control */}
              <div className="pt-1">
                {addingStage ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      maxLength={40}
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleConfirmAddStage();
                        } else if (e.key === "Escape") {
                          setAddingStage(false);
                          setNewStageName("");
                        }
                      }}
                      placeholder="Stage name..."
                      autoFocus
                      className="h-8 flex-1 rounded-control border border-input bg-surface px-2.5 type-body-secondary text-ink shadow-none"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleConfirmAddStage}
                      className="h-8 px-3 rounded-control bg-primary text-on-brand hover:bg-primary-hover type-label-button-sm shadow-none cursor-pointer"
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingStage(true)}
                    className="inline-flex items-center gap-1.5 type-body font-medium text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Stage</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </fieldset>

        {/* Bottom Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-divider pt-4">
          <p className="type-caption text-ink-muted">
            Saved recipes appear when starting a production batch.
          </p>
          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setConfirmDiscardOpen(true)}
              className="h-9 px-4 rounded-control border border-border bg-surface type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-control bg-primary type-label-button text-on-brand hover:bg-primary-hover shadow-none cursor-pointer"
            >
              {saving ? "Saving..." : "Save recipe"}
            </Button>
          </div>
        </div>
      </form>

      <ActionConfirmModal
        open={confirmDiscardOpen}
        title="Discard Unsaved Changes?"
        subtitle={recipeName.trim() ? `Recipe: ${recipeName.trim()}` : undefined}
        description="Are you sure you want to go back? Any unsaved recipe details will be discarded."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        onCancel={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          onCancel();
        }}
      />

      <ActionConfirmModal
        open={confirmSaveOpen}
        title={editingRecipe ? "Save Recipe Changes" : "Create Recipe"}
        subtitle={`Recipe: ${recipeName.trim() || "—"} • ${activeRows.length} item(s) • ${checkedStages.length} stage(s)`}
        description={
          editingRecipe
            ? `Are you sure you want to save changes to recipe "${recipeName.trim()}"?`
            : `Are you sure you want to create the recipe "${recipeName.trim()}"?`
        }
        confirmLabel="Save recipe"
        submitting={saving}
        onCancel={() => setConfirmSaveOpen(false)}
        onConfirm={handleSave}
      />
    </div>
  );
}
