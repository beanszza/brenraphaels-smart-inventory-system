"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ModalWrapper from "./ModalWrapper";
import { Supplier } from "./types";
import { Textarea } from "@/components/ui/textarea";

interface SupplierModalProps {
  open: boolean;
  editingSupplier: Supplier | null;
  onClose: () => void;
  onSave: (data: {
    companyName: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    website?: string;
    isActive: boolean;
    suppliedItemIds: number[];
  }) => Promise<void>;
}

export default function SupplierModal(props: SupplierModalProps) {
  return props.open ? <SupplierModalForm key={props.editingSupplier?.supplierId ?? "new"} {...props} /> : null;
}

function SupplierModalForm({
  open,
  editingSupplier,
  onClose,
  onSave,
}: SupplierModalProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [companyName, setCompanyName] = useState(editingSupplier?.companyName ?? "");
  const [contactPerson, setContactPerson] = useState(editingSupplier?.contactPerson ?? "");
  const [email, setEmail] = useState(editingSupplier?.email ?? "");
  const [phone, setPhone] = useState(() => (editingSupplier?.phone ?? "").replace(/^\+?63|^0/, "").replace(/\D/g, ""));
  const [address, setAddress] = useState(editingSupplier?.address ?? "");
  const [website, setWebsite] = useState(editingSupplier?.website ?? "");
  const [supplierActive, setSupplierActive] = useState(editingSupplier?.isActive ?? true);

  const [companyNameError, setCompanyNameError] = useState("");
  const [contactPersonError, setContactPersonError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [websiteError, setWebsiteError] = useState("");

  const validateCompanyName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) { setCompanyNameError("Supplier Name is required."); return false; }
    if (trimmed.length < 2) { setCompanyNameError("Supplier Name must be at least 2 characters."); return false; }
    if (trimmed.length > 50) { setCompanyNameError("Supplier Name cannot exceed 50 characters."); return false; }
    setCompanyNameError(""); return true;
  };

  const validateContactPerson = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) { setContactPersonError("Contact Person is required."); return false; }
    if (/\d/.test(val)) { setContactPersonError("Contact Person cannot contain numbers."); return false; }
    if (!/^[a-zA-Z\s\.\-',]+$/.test(val)) { setContactPersonError("Contact Person can only contain letters and spaces."); return false; }
    if (trimmed.length < 2) { setContactPersonError("Contact Person must be at least 2 characters."); return false; }
    if (trimmed.length > 50) { setContactPersonError("Contact Person cannot exceed 50 characters."); return false; }
    setContactPersonError(""); return true;
  };

  const validateEmail = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) { setEmailError("Email address is required."); return false; }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) { setEmailError("Please enter a valid email address (e.g. supplier@gmail.com)."); return false; }
    if (trimmed.length > 50) { setEmailError("Email cannot exceed 50 characters."); return false; }
    setEmailError(""); return true;
  };

  const validatePhone = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (!digits) { setPhoneError("Phone number is required."); return false; }
    const isMobile = /^9\d{9}$/.test(digits);
    const isLandline = /^[2-8]\d{6,7}$/.test(digits);
    if (!isMobile && !isLandline) { setPhoneError("Please enter a valid 10-digit mobile number (e.g. 917 123 4567)."); return false; }
    setPhoneError(""); return true;
  };

  const validateAddress = (value: string) => {
    if (!value.trim()) { setAddressError("Address is required."); return false; }
    if (value.length > 100) { setAddressError("Address cannot exceed 100 characters."); return false; }
    setAddressError(""); return true;
  };

  const validateWebsite = (val: string) => {
    const trimmed = val.trim();
    if (trimmed) {
      const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\\/\w \.-]*)*\/?$/i;
      if (!urlRegex.test(trimmed)) { setWebsiteError("Please enter a valid website URL (e.g. www.supplier.com)."); return false; }
      if (trimmed.length > 50) { setWebsiteError("Website cannot exceed 50 characters."); return false; }
    }
    setWebsiteError(""); return true;
  };



  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 50);
    setCompanyName(val); validateCompanyName(val);
  };

  const handleContactPersonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[0-9]/g, "").slice(0, 50);
    setContactPerson(val); validateContactPerson(val);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 50);
    setEmail(val); validateEmail(val);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.trim();
    if (raw.startsWith("+63")) raw = raw.slice(3);
    else if (raw.startsWith("63") && raw.length > 10) raw = raw.slice(2);
    if (raw.startsWith("0")) raw = raw.slice(1);
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    setPhone(digits); validatePhone(digits);
  };

  const handleWebsiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 50);
    setWebsite(val); validateWebsite(val);
  };

  const handleSave = async () => {
    if (saving) return;
    const v1 = validateCompanyName(companyName);
    const v2 = validateContactPerson(contactPerson);
    const v3 = validateEmail(email);
    const v4 = validatePhone(phone);
    const v5 = validateAddress(address);
    const v6 = validateWebsite(website);
    if (!v1 || !v2 || !v3 || !v4 || !v5 || !v6) return;

    const formattedPhone = phone.trim() ? `+63${phone.replace(/\D/g, "")}` : "";
    setSaving(true);
    setSaveError("");
    try {
      await onSave({
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: formattedPhone,
      address: address.trim(),
      website: website.trim() || undefined,
      isActive: supplierActive,
      suppliedItemIds: [],
    });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const hasErrors =
    !!companyNameError || !!contactPersonError || !!emailError ||
    !!phoneError || !!addressError || !!websiteError ||
    !companyName.trim() || !contactPerson.trim() || !email.trim() ||
    !phone.trim() || !address.trim();

  const fieldClass = (err: string) =>
    `w-full rounded-xl border ${err ? "!border-destructive focus-visible:!ring-destructive" : "border-border"} bg-card text-foreground px-4 py-2.5 text-sm transition-colors`;

  const fieldStyle = (err: string) =>
    err ? { borderColor: "var(--destructive)" } : undefined;

  return (
    <ModalWrapper
      open={open}
      title={editingSupplier ? "Edit Supplier" : "Add New Supplier"}
      onClose={() => { if (!saving) onClose(); }}
      size="max-w-xl"
    >
      <form onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
      {saveError && <p role="alert" className="mb-3 text-sm text-destructive">{saveError}</p>}
      {saving && <p role="status" className="mb-3 text-sm text-muted-foreground">Saving...</p>}
      <fieldset disabled={saving} className="space-y-4">
        {/* Supplier Name */}
        <div>
          <label htmlFor="supplier-name" className="mb-1.5 block text-xs font-semibold text-foreground">
            Supplier Name <span className="text-destructive">*</span>
          </label>
          <Input type="text" maxLength={50} id="supplier-name" value={companyName} onChange={handleCompanyNameChange}
            aria-invalid={!!companyNameError} style={fieldStyle(companyNameError)}
            placeholder="e.g. Acme Supplies Ltd." className={fieldClass(companyNameError)} />
          {companyNameError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{companyNameError}</p>}
        </div>

        {/* Contact Person */}
        <div>
          <label htmlFor="supplier-contact" className="mb-1.5 block text-xs font-semibold text-foreground">
            Contact Person (Last Name, First Name) <span className="text-destructive">*</span>
          </label>
          <Input type="text" maxLength={50} id="supplier-contact" value={contactPerson} onChange={handleContactPersonChange}
            aria-invalid={!!contactPersonError} style={fieldStyle(contactPersonError)}
            placeholder="e.g. Doe, John" className={fieldClass(contactPersonError)} />
          {contactPersonError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{contactPersonError}</p>}
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="supplier-email" className="mb-1.5 block text-xs font-semibold text-foreground">
              Email <span className="text-destructive">*</span>
            </label>
            <Input type="email" maxLength={50} id="supplier-email" value={email} onChange={handleEmailChange}
              aria-invalid={!!emailError} style={fieldStyle(emailError)}
              placeholder="e.g. contact@supplier.com" className={fieldClass(emailError)} />
            {emailError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{emailError}</p>}
          </div>
          <div>
            <label htmlFor="supplier-phone" className="mb-1.5 block text-xs font-semibold text-foreground">
              Phone No. <span className="text-destructive">*</span>
            </label>
            <div style={fieldStyle(phoneError)} className={`flex rounded-xl border ${phoneError ? "!border-destructive" : "border-border"} bg-card overflow-hidden transition-colors`}>
              <div className="flex items-center justify-center bg-muted/60 px-3.5 border-r border-border text-xs font-semibold text-muted-foreground select-none">
                +63
              </div>
              <Input type="tel" maxLength={10} id="supplier-phone" value={phone} onChange={handlePhoneChange}
                placeholder="917 123 4567"
                className="w-full rounded-none border-0 bg-transparent text-foreground px-3.5 py-2.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
            </div>
            {phoneError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{phoneError}</p>}
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="supplier-address" className="mb-1.5 block text-xs font-semibold text-foreground">
            Address <span className="text-destructive">*</span>
          </label>
          <Textarea id="supplier-address" maxLength={100} value={address}
            onChange={(event) => { setAddress(event.target.value); validateAddress(event.target.value); }}
            aria-invalid={!!addressError} placeholder="Street, barangay, city and province"
            className={fieldClass(addressError)} />
          {addressError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{addressError}</p>}
        </div>

        {/* Website */}
        <div>
          <label htmlFor="supplier-website" className="mb-1.5 block text-xs font-semibold text-foreground">Website (Optional)</label>
          <Input type="text" maxLength={50} id="supplier-website" value={website} onChange={handleWebsiteChange}
            aria-invalid={!!websiteError} style={fieldStyle(websiteError)}
            placeholder="e.g. www.acme.com" className={fieldClass(websiteError)} />
          {websiteError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{websiteError}</p>}
        </div>

        {/* Status (edit only) */}
        {editingSupplier && (
          <div>
            <label htmlFor="supplier-status" className="mb-1.5 block text-xs font-semibold text-foreground">Status</label>
            <select
              value={supplierActive ? "true" : "false"}
              onChange={(e) => setSupplierActive(e.target.value === "true")}
              className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2">
          <Button type="button" variant="outline" onClick={onClose}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
            Cancel
          </Button>
          <Button type="submit" disabled={hasErrors}
            className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {editingSupplier ? "Save Changes" : "Create Supplier"}
          </Button>
        </div>
      </fieldset>
      </form>
    </ModalWrapper>
  );
}
