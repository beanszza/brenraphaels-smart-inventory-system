"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ModalWrapper from "./ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
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
    hasExpiry: boolean;
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
  const [hasExpiry, setHasExpiry] = useState(editingCategory ? editingCategory.hasExpiry !== false : true);
  const [nameError, setNameError] = useState("");
  const [nameWarning, setNameWarning] = useState("");
  const [descError, setDescError] = useState("");
  const [descWarning, setDescWarning] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

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
    if (/(raw|tool|finished)/i.test(trimmed)) {
      setNameError("Category Name cannot contain reserved words ('Raw', 'Tool', or 'Finished').");
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

  const handleRequestSave = () => {
    const isNameValid = validateName(categoryName);
    const isDescValid = validateDescription(description);
    if (!isNameValid || !isDescValid) return;
    setConfirmSaveOpen(true);
  };

  const handleSave = async () => {
    setConfirmSaveOpen(false);
    try {
      setIsSaving(true);
      setSaveError("");
      await onSave({
        categoryName: categoryName.trim(),
        description: description.trim(),
        isActive,
        hasExpiry,
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
      subtitle={
        editingCategory
          ? "Update classification details and expiry tracking rules for this category."
          : "Add a category to organize materials, ingredients, or supplies in inventory."
      }
      onClose={onClose}
      size="max-w-[540px]"
      maxWidthPx={540}
    >
      <div className="space-y-4.5">
        {saveError && (
          <div className="rounded-control border border-status-red-border bg-status-red-bg p-3 type-body text-status-red animate-in fade-in-50">
            {saveError}
          </div>
        )}
        {/* Category Name */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1 type-label font-medium text-ink">
              <span>Category Name</span>
              <span className="text-status-red">*</span>
            </label>
            <span className={`type-caption tabular-nums ${categoryName.length >= CATEGORY_NAME_MAX ? "font-medium text-status-amber" : "text-ink-muted"}`}>
              {categoryName.length}/{CATEGORY_NAME_MAX}
            </span>
          </div>
          <Input
            type="text"
            value={categoryName}
            onChange={handleNameChange}
            aria-invalid={!!nameError}
            placeholder="e.g. Packaging Materials"
            style={nameError ? { borderColor: "var(--color-status-red-border)" } : undefined}
            className={`h-10 w-full rounded-control border ${
              nameError
                ? "!border-status-red-border focus-visible:!ring-destructive"
                : "border-border hover:border-ink-muted/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
            } bg-surface text-ink px-3.5 py-2 type-body placeholder:text-ink-muted/60 transition-colors shadow-none`}
          />
          {nameError ? (
            <p className="type-caption font-medium text-status-red animate-in fade-in-50">{nameError}</p>
          ) : nameWarning ? (
            <p className="type-caption font-medium text-status-amber animate-in fade-in-50">{nameWarning}</p>
          ) : (
            <p className="type-caption text-ink-muted">
              Must be 2–50 characters, letters and symbols only (no numbers or reserved words).
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 type-label font-medium text-ink">
              <span>Description</span>
              <span className="type-caption font-normal text-ink-muted">(optional)</span>
            </label>
            <span className={`type-caption tabular-nums ${description.length >= CATEGORY_DESC_MAX ? "font-medium text-status-amber" : "text-ink-muted"}`}>
              {description.length}/{CATEGORY_DESC_MAX}
            </span>
          </div>
          <textarea
            rows={3}
            value={description}
            onChange={handleDescriptionChange}
            aria-invalid={!!descError}
            placeholder="Optional description of what items belong in this category..."
            className={`w-full rounded-control border ${
              descError
                ? "!border-status-red-border focus-visible:!ring-destructive"
                : "border-border hover:border-ink-muted/50 focus:border-primary focus:ring-1 focus:ring-primary/20"
            } bg-surface text-ink p-3 type-body placeholder:text-ink-muted/60 outline-none transition-colors resize-none`}
          />
          {descError ? (
            <p className="type-caption font-medium text-status-red animate-in fade-in-50">{descError}</p>
          ) : descWarning ? (
            <p className="type-caption font-medium text-status-amber animate-in fade-in-50">{descWarning}</p>
          ) : null}
        </div>

        {/* Expiry Tracking Option Card */}
        <div className="rounded-card border border-border bg-subtle/60 p-4 transition-colors hover:bg-subtle">
          <div className="flex items-start gap-3.5">
            <input
              type="checkbox"
              id="category-has-expiry"
              checked={hasExpiry}
              onChange={(e) => setHasExpiry(e.target.checked)}
              className="sr-only"
              tabIndex={-1}
            />
            <button
              type="button"
              role="switch"
              aria-checked={hasExpiry}
              aria-labelledby="category-has-expiry-label"
              onClick={() => setHasExpiry(!hasExpiry)}
              className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                hasExpiry ? "bg-primary" : "bg-ink-muted/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface shadow-xs ring-0 transition duration-200 ease-in-out ${
                  hasExpiry ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <div
              className="space-y-0.5 cursor-pointer select-none"
              onClick={() => setHasExpiry(!hasExpiry)}
            >
              <span
                id="category-has-expiry-label"
                className="block type-label font-medium text-ink cursor-pointer"
              >
                This category has an expiry date
              </span>
              <p className="type-caption text-ink-muted leading-relaxed">
                Changes only affect new Goods Receipts. Existing receipts and lots keep their recorded expiry.
              </p>
            </div>
          </div>
        </div>

        {/* Status (Edit only) */}
        {editingCategory && (
          <div className="space-y-1.5">
            <label className="block type-label font-medium text-ink">Status</label>
            <select
              value={isActive ? "true" : "false"}
              onChange={(e) => setIsActive(e.target.value === "true")}
              className="h-10 w-full rounded-control border border-border bg-surface text-ink px-3 py-2 type-body focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <p className="type-caption text-ink-muted">
              Inactive categories are hidden from Inventory and new Supply creation.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 pb-1 border-t border-divider mt-6">
          <ModalCloseButton
            type="button"
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-control border border-border bg-surface px-4 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-9 shadow-none"
          >
            Cancel
          </ModalCloseButton>
          <Button
            type="button"
            disabled={hasErrors || isSaving}
            onClick={handleRequestSave}
            className="rounded-control bg-primary text-primary-foreground px-5 py-2 type-label-button hover:bg-primary-hover transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed h-9"
          >
            {isSaving ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
          </Button>
        </div>
      </div>

      <ActionConfirmModal
        open={confirmSaveOpen}
        title={editingCategory ? "Save Category Changes" : "Create New Category"}
        subtitle={`Category: ${categoryName.trim() || "—"}`}
        description={
          editingCategory
            ? `Are you sure you want to save changes to category "${categoryName.trim()}"?`
            : `Are you sure you want to create the category "${categoryName.trim()}"?`
        }
        confirmLabel={editingCategory ? "Save Changes" : "Create Category"}
        submitting={isSaving}
        onCancel={() => setConfirmSaveOpen(false)}
        onConfirm={handleSave}
      />
    </ModalWrapper>
  );
}
