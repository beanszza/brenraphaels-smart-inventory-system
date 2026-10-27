"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ModalWrapper from "./ModalWrapper";
import { CategoryItem } from "./types";

interface CategoryModalProps {
  open: boolean;
  editingCategory: CategoryItem | null;
  existingCategories?: CategoryItem[];
  onClose: () => void;
  onSave: (data: {
    categoryName: string;
    description: string;
    isActive: boolean;
  }) => Promise<void> | void;
}

export default function CategoryModal({
  open,
  editingCategory,
  existingCategories = [],
  onClose,
  onSave,
}: CategoryModalProps) {
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [nameError, setNameError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const validateName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setNameError("Category Name is required.");
      return false;
    }
    if (trimmed.length < 2) {
      setNameError("Category Name must be at least 2 characters.");
      return false;
    }
    if (trimmed.length > 50) {
      setNameError("Category Name cannot exceed 50 characters.");
      return false;
    }
    const isDuplicate = existingCategories.some(
      (cat) =>
        cat.categoryName.trim().toLowerCase() === trimmed.toLowerCase() &&
        cat.categoryId !== editingCategory?.categoryId
    );
    if (isDuplicate) {
      setNameError("Category name already exists.");
      return false;
    }
    setNameError("");
    return true;
  };

  useEffect(() => {
    if (open) {
      if (editingCategory) {
        setCategoryName(editingCategory.categoryName || "");
        setDescription(editingCategory.description || "");
        setIsActive(editingCategory.isActive !== false);
      } else {
        setCategoryName("");
        setDescription("");
        setIsActive(true);
      }
      setNameError("");
      setIsSaving(false);
    }
  }, [editingCategory, open]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 50);
    setCategoryName(val);
    validateName(val);
  };

  const handleSave = async () => {
    if (!validateName(categoryName)) return;
    try {
      setIsSaving(true);
      setSaveError("");
      await onSave({
        categoryName: categoryName.trim(),
        description: description.trim(),
        isActive,
      });
    } catch (err: any) {
      setSaveError(err instanceof Error ? err.message : "Unable to save category. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasErrors = !!nameError || !categoryName.trim();

  return (
    <ModalWrapper
      open={open}
      title={editingCategory ? "Edit Category" : "Add New Category"}
      onClose={onClose}
      size="max-w-md"
    >
      <div className="space-y-4">
        {saveError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {saveError}
          </div>
        )}
        {/* Category Name */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">
            Category Name <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            maxLength={50}
            value={categoryName}
            onChange={handleNameChange}
            aria-invalid={!!nameError}
            placeholder="e.g. Packaging Materials"
            style={nameError ? { borderColor: "var(--destructive)" } : undefined}
            className={`w-full rounded-xl border ${
              nameError ? "!border-destructive focus-visible:!ring-destructive" : "border-border"
            } bg-card text-foreground px-4 py-2.5 text-sm transition-colors`}
          />
          {nameError && (
            <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{nameError}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">
            Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 200))}
            placeholder="Optional description of this category..."
            className="w-full rounded-xl border border-border bg-card text-foreground p-3 text-sm focus:ring-1 focus:ring-ring outline-none"
          />
        </div>

        {/* Status (Edit only) */}
        {editingCategory && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">Status</label>
            <select
              value={isActive ? "true" : "false"}
              onChange={(e) => setIsActive(e.target.value === "true")}
              className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm focus:ring-1 focus:ring-ring"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Inactive categories are hidden from Inventory and new Supply creation.
            </p>
          </div>
        )}

        {/* Actions */}
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
            disabled={hasErrors || isSaving}
            onClick={handleSave}
            className="rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:bg-foreground/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
}
