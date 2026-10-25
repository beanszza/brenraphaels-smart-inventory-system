"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
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
    <ModalWrapper open={open} title={editingLocation ? "Edit Location" : "Add New Location"} onClose={onClose} size="max-w-xl">
      <div className="space-y-4">
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Location Name <span className="text-muted-foreground">*</span></label>
          <Input type="text" value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} placeholder="e.g. Main Distribution Hub" className="rounded-xl border border-border bg-card text-foreground text-sm" />
          {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Location Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-ring">
            <option value="Warehouse">Warehouse</option>
            <option value="Store Branch">Store Branch</option>
            <option value="Distribution Center">Distribution Center</option>
            <option value="Production Facility">Production Facility</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Address</label>
          <AddressSelector
            streetNumber={streetNumber} setStreetNumber={setStreetNumber}
            barangay={barangay} setBarangay={setBarangay}
            city={city} setCity={setCity}
            province={province} setProvince={setProvince}
          />
        </div>

        {editingLocation && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">Status</label>
            <select value={isActive ? "true" : "false"} onChange={(e) => setIsActive(e.target.value === "true")} className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors">
            {editingLocation ? "Save Changes" : "Create Location"}
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
}
