"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { SupplyItem, Ingredient } from "./types";

interface RecipeIngredientItemProps {
  ingredient: Ingredient;
  index: number;
  canRemove: boolean;
  baseSupplies: SupplyItem[];
  excludedItemIds?: number[];
  error?: string;
  onRemove: (id: number) => void;
  onItemChange: (id: number, itemId: number, uomId: number) => void;
  onQuantityChange: (id: number, quantity: string) => void;
}

export default function RecipeIngredientItem({
  ingredient,
  canRemove,
  baseSupplies,
  excludedItemIds = [],
  error,
  onRemove,
  onItemChange,
  onQuantityChange,
}: RecipeIngredientItemProps) {
  const selectedSupply = baseSupplies.find((s) => s.itemId === ingredient.itemId);
  const categoryDisplay = selectedSupply?.categoryName || "-";
  const uomDisplay = selectedSupply?.uomName || "-";

  // Filter out items already selected in other rows to prevent duplicates
  const availableSupplies = baseSupplies.filter(
    (s) => s.itemId === ingredient.itemId || !excludedItemIds.includes(s.itemId)
  );

  // Group items by category to separate them cleanly in the item selector
  const suppliesByCategory = React.useMemo(() => {
    const groups: { [cat: string]: SupplyItem[] } = {};
    availableSupplies.forEach((supply) => {
      const cat = supply.categoryName || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(supply);
    });
    return groups;
  }, [availableSupplies]);

  return (
    <div className="rounded-card border border-divider p-3.5 bg-surface/60 transition-colors">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
        {/* Item Selector */}
        <div className="sm:col-span-4">
          <label className="mb-1.5 block type-label font-semibold text-text-primary">
            Item <span className="text-status-red">*</span>
          </label>
          <select
            value={ingredient.itemId || ""}
            onChange={(e) => {
              const newId = Number(e.target.value);
              const supply = baseSupplies.find((s) => s.itemId === newId);
              onItemChange(ingredient.id, newId, supply?.uomId || 0);
            }}
            className="w-full h-10 rounded-control border border-divider bg-surface px-3.5 type-body text-text-primary focus:ring-1 focus:ring-accent focus:outline-none transition-colors"
          >
            <option value="" disabled>
              Select item
            </option>
            {Object.entries(suppliesByCategory).map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((supply) => (
                  <option key={supply.itemId} value={supply.itemId}>
                    {supply.itemName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Category (Separated per Item) */}
        <div className="sm:col-span-3">
          <label className="mb-1.5 block type-label font-semibold text-text-primary">Category</label>
          <input
            type="text"
            readOnly
            disabled
            value={categoryDisplay}
            className="w-full h-10 rounded-control border border-divider bg-surface-muted px-3.5 type-body text-text-muted cursor-not-allowed select-none truncate"
          />
        </div>

        {/* Quantity Input */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block type-label font-semibold text-text-primary">
            Quantity <span className="text-status-red">*</span>
          </label>
          <Input
            type="number"
            min={0.001}
            step="any"
            placeholder="e.g. 5"
            value={ingredient.quantity}
            aria-invalid={!!error}
            style={error ? { borderColor: "var(--status-red)" } : undefined}
            onKeyDown={(e) => {
              if (["-", "+", "e", "E"].includes(e.key)) {
                e.preventDefault();
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              if (val.length <= 50) {
                onQuantityChange(ingredient.id, val);
              }
            }}
            className={`w-full h-10 rounded-control border ${
              error ? "!border-status-red focus-visible:!ring-status-red" : "border-divider"
            } bg-surface px-3.5 type-body text-text-primary transition-colors focus:ring-1 focus:ring-accent focus:outline-none`}
          />
        </div>

        {/* Read-Only Unit */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block type-label font-semibold text-text-primary">Unit</label>
          <input
            type="text"
            readOnly
            disabled
            value={uomDisplay}
            className="w-full h-10 rounded-control border border-divider bg-surface-muted px-3 type-body text-center text-text-muted cursor-not-allowed select-none"
          />
        </div>

        {/* Remove Button */}
        <div className="sm:col-span-1 flex justify-center">
          {canRemove ? (
            <button
              type="button"
              onClick={() => onRemove(ingredient.id)}
              className="flex h-10 w-10 items-center justify-center rounded-control border border-divider text-text-muted hover:text-status-red hover:border-status-red hover:bg-status-red/10 transition-colors cursor-pointer"
              title="Remove item"
              aria-label="Remove item"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <div className="w-10 h-10" />
          )}
        </div>
      </div>
      {error && (
        <p className="mt-1.5 type-caption font-medium text-status-red animate-in fade-in-50">{error}</p>
      )}
    </div>
  );
}
