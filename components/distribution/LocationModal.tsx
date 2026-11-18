"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { LocationItem } from "./types";
import AddressSelector from "@/components/shared/AddressSelector";

interface LocationModalProps {
  open: boolean;
  editingLocation: LocationItem | null;
  onClose: () => void;
  onSave: (data: { name: string; type: string; address: string; isActive: boolean }) => Promise<void>;
}

export default function LocationModal({
  open,
  editingLocation,
  onClose,
  onSave,
}: LocationModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Warehouse");
  const [streetNumber, setStreetNumber] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (editingLocation) {
      setName(editingLocation.name || "");
      setType(editingLocation.type || "Warehouse");
      if (editingLocation.address) {
        const parts = editingLocation.address.split(", ");
        setStreetNumber(parts[0] || "");
        setBarangay(parts[1] || "");
        setCity(parts[2] || "");
        setProvince(parts[3] || "");
      } else {
        setStreetNumber("");
        setBarangay("");
        setCity("");
        setProvince("");
      }
      setIsActive(editingLocation.status === "Active");
    } else {
      setName("");
      setType("Warehouse");
      setStreetNumber("");
      setBarangay("");
      setCity("");
      setProvince("");
      setIsActive(true);
    }
    setNameError("");
    setSaveError("");
  }, [editingLocation, open]);

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) {
      setNameError("Location name is required.");
      return;
    }
    const fullAddress = `${streetNumber.trim()}, ${barangay.trim()}, ${city.trim()}, ${province.trim()}`;
    setSaving(true);
    setSaveError("");
    try {
      await onSave({ name: name.trim(), type, address: fullAddress, isActive });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save location.");
    } finally { setSaving(false); }
  };

  return (
    <ModalWrapper open={open} title={editingLocation ? "Edit Location" : "Add New Location"} onClose={onClose} size="max-w-[560px]">
      <div className="space-y-4">
        {saveError && <p role="alert" className="type-body text-destructive">{saveError}</p>}
        <div>
          <label className="mb-1.5 block type-caption font-semibold text-text-primary">Location Name <span className="text-text-muted">*</span></label>
          <Input type="text" value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} placeholder="e.g. Main Distribution Hub" className="rounded-control border border-divider bg-surface text-text-primary type-input" />
          {nameError && <p className="mt-1 type-caption text-destructive">{nameError}</p>}
        </div>

        <div>
          <label className="mb-1.5 block type-caption font-semibold text-text-primary">Location Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-control border border-divider bg-surface px-3 py-2 type-input text-text-primary focus:ring-1 focus:ring-ring">
            <option value="Warehouse">Warehouse</option>
            <option value="Store Branch">Store Branch</option>
            <option value="Distribution Center">Distribution Center</option>
            <option value="Production Facility">Production Facility</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block type-caption font-semibold text-text-primary">Address</label>
          <AddressSelector
            streetNumber={streetNumber} setStreetNumber={setStreetNumber}
            barangay={barangay} setBarangay={setBarangay}
            city={city} setCity={setCity}
            province={province} setProvince={setProvince}
          />
        </div>

        {editingLocation && (
          <div>
            <label className="mb-1.5 block type-caption font-semibold text-text-primary">Status</label>
            <select value={isActive ? "true" : "false"} onChange={(e) => setIsActive(e.target.value === "true")} className="w-full rounded-control border border-divider bg-surface text-text-primary px-3 py-2 type-input">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-divider">
          <ModalCloseButton type="button" variant="outline" fallbackOnClose={onClose} disabled={saving} className="rounded-control border border-divider bg-surface px-5 py-2.5 type-button font-semibold text-text-primary hover:bg-surface-hover transition-colors">
            Cancel
          </ModalCloseButton>
          <Button type="button" onClick={handleSave} disabled={saving} className="rounded-control bg-primary text-primary-foreground px-5 py-2.5 type-button font-semibold hover:bg-primary-hover transition-colors shadow-sm">
            {editingLocation ? "Save Changes" : "Create Location"}
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
}
