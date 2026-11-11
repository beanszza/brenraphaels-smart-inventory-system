"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ModalWrapper from "./ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
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

export default function CategoryModal(props: CategoryModalProps) {
  return props.open ? (
    <CategoryModalForm key={props.editingCategory?.categoryId ?? "new"} {...props} />
  ) : null;
}

const CATEGORY_NAME_MAX = 50;
const CATEGORY_DESC_MAX = 100;

function CategoryModalForm({
  open,
  editingCategory,
  existingCategories = [],
  onClose,
  onSave,
}: CategoryModalProps) {
  const [categoryName, setCategoryName] = useState(editingCategory?.categoryName ?? "");
  const [description, setDescription] = useState(editingCategory?.description ?? "");
  const [isActive, setIsActive] = useState(editingCategory ? editingCategory.isActive !== false : true);
  const [nameError, setNameError] = useState("");
  const [nameWarning, setNameWarning] = useState("");
  const [descError, setDescError] = useState("");
  const [descWarning, setDescWarning] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const validateName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setNameError("Category Name is required.");
      return false;
    }
    if (/\d/.test(val)) {
      setNameError("Category Name cannot contain numbers.");
      return false;
    }
    if (trimmed.length < 2) {
      setNameError("Category Name must be at least 2 characters.");
      return false;
    }
    if (trimmed.length > CATEGORY_NAME_MAX) {
      setNameError(`Category Name cannot exceed ${CATEGORY_NAME_MAX} characters.`);
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

  const validateDescription = (val: string) => {
    if (val.trim().length > CATEGORY_DESC_MAX) {
      setDescError(`Description cannot exceed ${CATEGORY_DESC_MAX} characters.`);
      return false;
    }
    setDescError("");
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const hasDigits = /\d/.test(raw);
    const noDigits = raw.replace(/[0-9]/g, "");
    const exceeded = noDigits.length > CATEGORY_NAME_MAX;
    const val = noDigits.slice(0, CATEGORY_NAME_MAX);

    setCategoryName(val);
    if (hasDigits) {
      setNameWarning("Category Name must not contain numbers.");
    } else if (exceeded) {
      setNameWarning(`Category Name is limited to ${CATEGORY_NAME_MAX} characters.`);
    } else if (val.length === CATEGORY_NAME_MAX) {
      setNameWarning(`Maximum limit of ${CATEGORY_NAME_MAX} characters reached.`);
    } else {
      setNameWarning("");
    }
    validateName(val);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value;
    const exceeded = raw.length > CATEGORY_DESC_MAX;
    const val = raw.slice(0, CATEGORY_DESC_MAX);

    setDescription(val);
    if (exceeded) {
      setDescWarning(`Description is limited to ${CATEGORY_DESC_MAX} characters.`);
    } else if (val.length === CATEGORY_DESC_MAX) {
      setDescWarning(`Maximum limit of ${CATEGORY_DESC_MAX} characters reached.`);
    } else {
      setDescWarning("");
    }
    validateDescription(val);
  };

  const handleSave = async () => {
    const isNameValid = validateName(categoryName);
    const isDescValid = validateDescription(description);
    if (!isNameValid || !isDescValid) return;
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

  const hasErrors = !!nameError || !!descError || !categoryName.trim();

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
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-xs font-semibold text-foreground">
              Category Name <span className="text-destructive">*</span>
            </label>
            <span className={`text-[11px] ${categoryName.length >= CATEGORY_NAME_MAX ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
              {categoryName.length}/{CATEGORY_NAME_MAX}
            </span>
          </div>
          <Input
            type="text"
            value={categoryName}
            onChange={handleNameChange}
            aria-invalid={!!nameError}
            placeholder="e.g. Packaging Materials"
            style={nameError ? { borderColor: "var(--destructive)" } : undefined}
            className={`w-full rounded-xl border ${
              nameError ? "!border-destructive focus-visible:!ring-destructive" : "border-border"
            } bg-card text-foreground px-4 py-2.5 text-sm transition-colors`}
          />
          {nameError ? (
            <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{nameError}</p>
          ) : nameWarning ? (
            <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 animate-in fade-in-50">{nameWarning}</p>
          ) : null}
        </div>

        {/* Description */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-xs font-semibold text-foreground">
              Description
            </label>
            <span className={`text-[11px] ${description.length >= CATEGORY_DESC_MAX ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
              {description.length}/{CATEGORY_DESC_MAX}
            </span>
          </div>
          <textarea
            rows={3}
            value={description}
            onChange={handleDescriptionChange}
            aria-invalid={!!descError}
            placeholder="Optional description of this category..."
            className={`w-full rounded-xl border ${
              descError ? "!border-destructive focus-visible:!ring-destructive" : "border-border"
            } bg-card text-foreground p-3 text-sm focus:ring-1 focus:ring-ring outline-none`}
          />
          {descError ? (
            <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{descError}</p>
          ) : descWarning ? (
            <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 animate-in fade-in-50">{descWarning}</p>
          ) : null}
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
          <ModalCloseButton
            type="button"
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            Cancel
          </ModalCloseButton>
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
