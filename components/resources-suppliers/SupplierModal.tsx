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

function parseContact(raw: string) {
  const trimmed = (raw || "").trim();
  if (trimmed.includes(",")) {
    const [lastPart, ...firstParts] = trimmed.split(",");
    const lastName = lastPart.trim();
    const rest = firstParts.join(",").trim().split(/\s+/);
    const firstName = rest[0] || "";
    const middleName = rest.slice(1).join(" ");
    return { firstName, middleName, lastName };
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", middleName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(" "), lastName: parts[parts.length - 1] };
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

  const initialName = parseContact(editingSupplier?.contactPerson ?? "");
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [middleName, setMiddleName] = useState(initialName.middleName);
  const [lastName, setLastName] = useState(initialName.lastName);

  const [email, setEmail] = useState(editingSupplier?.email ?? "");
  const [phone, setPhone] = useState(() => (editingSupplier?.phone ?? "").replace(/^\+?63|^0/, "").replace(/\D/g, ""));
  const [address, setAddress] = useState(editingSupplier?.address ?? "");
  const [website, setWebsite] = useState(editingSupplier?.website ?? "");
  const [supplierActive, setSupplierActive] = useState(editingSupplier?.isActive ?? true);

  const [companyNameError, setCompanyNameError] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [middleNameError, setMiddleNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
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

  const validateFirstName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) { setFirstNameError("First Name is required."); return false; }
    if (/\d/.test(val)) { setFirstNameError("First Name cannot contain numbers."); return false; }
    if (!/^[a-zA-Z\s\.\-']+$/.test(val)) { setFirstNameError("First Name can only contain letters and spaces."); return false; }
    if (trimmed.length < 2) { setFirstNameError("First Name must be at least 2 characters."); return false; }
    if (trimmed.length > 25) { setFirstNameError("First Name cannot exceed 25 characters."); return false; }
    setFirstNameError(""); return true;
  };

  const validateMiddleName = (val: string) => {
    const trimmed = val.trim();
    if (trimmed) {
      if (/\d/.test(val)) { setMiddleNameError("Middle Name cannot contain numbers."); return false; }
      if (!/^[a-zA-Z\s\.\-']+$/.test(val)) { setMiddleNameError("Middle Name can only contain letters and spaces."); return false; }
      if (trimmed.length > 25) { setMiddleNameError("Middle Name cannot exceed 25 characters."); return false; }
    }
    setMiddleNameError(""); return true;
  };

  const validateLastName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) { setLastNameError("Last Name is required."); return false; }
    if (/\d/.test(val)) { setLastNameError("Last Name cannot contain numbers."); return false; }
    if (!/^[a-zA-Z\s\.\-']+$/.test(val)) { setLastNameError("Last Name can only contain letters and spaces."); return false; }
    if (trimmed.length < 2) { setLastNameError("Last Name must be at least 2 characters."); return false; }
    if (trimmed.length > 25) { setLastNameError("Last Name cannot exceed 25 characters."); return false; }
    setLastNameError(""); return true;
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

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[0-9]/g, "").slice(0, 25);
    setFirstName(val); validateFirstName(val);
  };

  const handleMiddleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[0-9]/g, "").slice(0, 25);
    setMiddleName(val); validateMiddleName(val);
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[0-9]/g, "").slice(0, 25);
    setLastName(val); validateLastName(val);
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
    const v2 = validateFirstName(firstName);
    const v3 = validateMiddleName(middleName);
    const v4 = validateLastName(lastName);
    const v5 = validateEmail(email);
    const v6 = validatePhone(phone);
    const v7 = validateAddress(address);
    const v8 = validateWebsite(website);
    if (!v1 || !v2 || !v3 || !v4 || !v5 || !v6 || !v7 || !v8) return;

    const formattedContact = lastName.trim() && firstName.trim()
      ? `${lastName.trim()}, ${firstName.trim()}${middleName.trim() ? ` ${middleName.trim()}` : ""}`
      : `${firstName.trim()} ${lastName.trim()}`.trim();

    const formattedPhone = phone.trim() ? `+63${phone.replace(/\D/g, "")}` : "";
    setSaving(true);
    setSaveError("");
    try {
      await onSave({
        companyName: companyName.trim(),
        contactPerson: formattedContact,
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
    !!companyNameError || !!firstNameError || !!middleNameError || !!lastNameError ||
    !!emailError || !!phoneError || !!addressError || !!websiteError ||
    !companyName.trim() || !firstName.trim() || !lastName.trim() ||
    !email.trim() || !phone.trim() || !address.trim();

  const fieldClass = (err: string) =>
    `w-full rounded-xl border ${err ? "!border-destructive focus-visible:!ring-destructive" : "border-border"} bg-card text-foreground px-4 py-2.5 text-sm transition-colors`;

  const fieldStyle = (err: string) =>
    err ? { borderColor: "var(--destructive)" } : undefined;

  const contactPersonDisplay = editingSupplier?.contactPerson || (lastName ? `${lastName}, ${firstName}` : firstName);

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
            <Input
              type="text"
              maxLength={50}
              id="supplier-name"
              value={companyName}
              onChange={handleCompanyNameChange}
              aria-invalid={!!companyNameError}
              style={fieldStyle(companyNameError)}
              placeholder="e.g. Acme Supplies Ltd."
              className={fieldClass(companyNameError)}
            />
            {companyNameError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{companyNameError}</p>}
          </div>

          {/* Contact Person (First, Middle, Last) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Contact Person <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* First Name */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  First Name <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  maxLength={25}
                  value={firstName}
                  onChange={handleFirstNameChange}
                  aria-invalid={!!firstNameError}
                  style={fieldStyle(firstNameError)}
                  placeholder="e.g. Juan"
                  className={fieldClass(firstNameError)}
                />
                {firstNameError && (
                  <p className="mt-1 text-[11px] font-medium text-destructive animate-in fade-in-50">
                    {firstNameError}
                  </p>
                )}
              </div>

              {/* Middle Name (Optional) */}
              <div>
                <label className="mb-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>Middle Name</span>
                  <span className="text-[10px] text-muted-foreground/70 font-normal">Optional</span>
                </label>
                <Input
                  type="text"
                  maxLength={25}
                  value={middleName}
                  onChange={handleMiddleNameChange}
                  aria-invalid={!!middleNameError}
                  style={fieldStyle(middleNameError)}
                  placeholder="e.g. Santos"
                  className={fieldClass(middleNameError)}
                />
                {middleNameError && (
                  <p className="mt-1 text-[11px] font-medium text-destructive animate-in fade-in-50">
                    {middleNameError}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  maxLength={25}
                  value={lastName}
                  onChange={handleLastNameChange}
                  aria-invalid={!!lastNameError}
                  style={fieldStyle(lastNameError)}
                  placeholder="e.g. Dela Cruz"
                  className={fieldClass(lastNameError)}
                />
                {lastNameError && (
                  <p className="mt-1 text-[11px] font-medium text-destructive animate-in fade-in-50">
                    {lastNameError}
                  </p>
                )}
              </div>
            </div>
            {/* Hidden input to maintain contract compatibility with test suite */}
            <input
              type="hidden"
              id="supplier-contact"
              name="contactPerson"
              value={contactPersonDisplay}
            />
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supplier-email" className="mb-1.5 block text-xs font-semibold text-foreground">
                Email <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                maxLength={50}
                id="supplier-email"
                value={email}
                onChange={handleEmailChange}
                aria-invalid={!!emailError}
                style={fieldStyle(emailError)}
                placeholder="e.g. contact@supplier.com"
                className={fieldClass(emailError)}
              />
              {emailError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{emailError}</p>}
            </div>
            <div>
              <label htmlFor="supplier-phone" className="mb-1.5 block text-xs font-semibold text-foreground">
                Phone No. <span className="text-destructive">*</span>
              </label>
              <div
                style={fieldStyle(phoneError)}
                className={`flex rounded-xl border ${phoneError ? "!border-destructive" : "border-border"} bg-card overflow-hidden transition-colors`}
              >
                <div className="flex items-center justify-center bg-muted/60 px-3.5 border-r border-border text-xs font-semibold text-muted-foreground select-none">
                  +63
                </div>
                <Input
                  type="tel"
                  maxLength={10}
                  id="supplier-phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="917 123 4567"
                  className="w-full rounded-none border-0 bg-transparent text-foreground px-3.5 py-2.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              {phoneError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{phoneError}</p>}
            </div>
          </div>

          {/* Address */}
          <div>
            <label htmlFor="supplier-address" className="mb-1.5 block text-xs font-semibold text-foreground">
              Address <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="supplier-address"
              maxLength={100}
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                validateAddress(event.target.value);
              }}
              aria-invalid={!!addressError}
              placeholder="Street, barangay, city and province"
              className={fieldClass(addressError)}
            />
            {addressError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{addressError}</p>}
          </div>

          {/* Website */}
          <div>
            <label htmlFor="supplier-website" className="mb-1.5 block text-xs font-semibold text-foreground">
              Website (Optional)
            </label>
            <Input
              type="text"
              maxLength={50}
              id="supplier-website"
              value={website}
              onChange={handleWebsiteChange}
              aria-invalid={!!websiteError}
              style={fieldStyle(websiteError)}
              placeholder="e.g. www.acme.com"
              className={fieldClass(websiteError)}
            />
            {websiteError && <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">{websiteError}</p>}
          </div>

          {/* Status (edit only) */}
          {editingSupplier && (
            <div>
              <label htmlFor="supplier-status" className="mb-1.5 block text-xs font-semibold text-foreground">
                Status
              </label>
              <select
                id="supplier-status"
                value={supplierActive ? "true" : "false"}
                onChange={(e) => setSupplierActive(e.target.value === "true")}
                className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors h-10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={hasErrors || saving}
              className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-10"
            >
              {saving ? "Saving..." : editingSupplier ? "Save Changes" : "Create Supplier"}
            </Button>
          </div>
        </fieldset>
      </form>
    </ModalWrapper>
  );
}
