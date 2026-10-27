"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ModalWrapper from "./ModalWrapper";
import { Supplier } from "./types";
import AddressSelector from "@/components/shared/AddressSelector";

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

  // Parse contact person into parts if editing
  const parseInitialContact = () => {
    const raw = (editingSupplier?.contactPerson || "").trim();
    if (!raw) return { first: "", middle: "", last: "" };
    if (raw.includes(",")) {
      const [lastPart, ...firstParts] = raw.split(",");
      const rest = firstParts.join(",").trim().split(/\s+/);
      return {
        last: lastPart.trim(),
        first: rest[0] || "",
        middle: rest.slice(1).join(" "),
      };
    }
    const parts = raw.split(/\s+/);
    if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
    if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] };
    return {
      first: parts[0],
      middle: parts.slice(1, -1).join(" "),
      last: parts[parts.length - 1],
    };
  };

  const initialContact = parseInitialContact();
  const [firstName, setFirstName] = useState(initialContact.first);
  const [middleName, setMiddleName] = useState(initialContact.middle);
  const [lastName, setLastName] = useState(initialContact.last);

  const [email, setEmail] = useState(editingSupplier?.email ?? "");
  const [phone, setPhone] = useState(() =>
    (editingSupplier?.phone ?? "").replace(/^\+?63|^0/, "").replace(/\D/g, "")
  );

  // Parse address parts if editing
  const parseInitialAddress = () => {
    const raw = (editingSupplier?.address || "").trim();
    if (!raw) return { street: "", brgy: "", city: "", prov: "" };
    const parts = raw.split(",").map((p) => p.trim());
    return {
      street: parts[0] || "",
      brgy: parts[1] || "",
      city: parts[2] || "",
      prov: parts.slice(3).join(", ") || "",
    };
  };

  const initialAddress = parseInitialAddress();
  const [streetNumber, setStreetNumber] = useState(initialAddress.street);
  const [barangay, setBarangay] = useState(initialAddress.brgy);
  const [city, setCity] = useState(initialAddress.city);
  const [province, setProvince] = useState(initialAddress.prov);

  const [website, setWebsite] = useState(editingSupplier?.website ?? "");
  const [supplierActive, setSupplierActive] = useState(editingSupplier?.isActive ?? true);

  // Errors
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
    if (!trimmed) {
      setCompanyNameError("Supplier Name is required.");
      return false;
    }
    if (trimmed.length < 2) {
      setCompanyNameError("Supplier Name must be at least 2 characters.");
      return false;
    }
    if (trimmed.length > 50) {
      setCompanyNameError("Supplier Name cannot exceed 50 characters.");
      return false;
    }
    setCompanyNameError("");
    return true;
  };

  const validateFirstName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setFirstNameError("First Name is required.");
      return false;
    }
    if (/\d/.test(val)) {
      setFirstNameError("First Name cannot contain numbers.");
      return false;
    }
    if (!/^[a-zA-Z\s\.\-']+$/.test(val)) {
      setFirstNameError("First Name can only contain letters and spaces.");
      return false;
    }
    if (trimmed.length < 2) {
      setFirstNameError("First Name must be at least 2 characters.");
      return false;
    }
    if (trimmed.length > 25) {
      setFirstNameError("First Name cannot exceed 25 characters.");
      return false;
    }
    setFirstNameError("");
    return true;
  };

  const validateMiddleName = (val: string) => {
    const trimmed = val.trim();
    if (trimmed) {
      if (/\d/.test(val)) {
        setMiddleNameError("Middle Name cannot contain numbers.");
        return false;
      }
      if (!/^[a-zA-Z\s\.\-']+$/.test(val)) {
        setMiddleNameError("Middle Name can only contain letters and spaces.");
        return false;
      }
      if (trimmed.length > 25) {
        setMiddleNameError("Middle Name cannot exceed 25 characters.");
        return false;
      }
    }
    setMiddleNameError("");
    return true;
  };

  const validateLastName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setLastNameError("Last Name is required.");
      return false;
    }
    if (/\d/.test(val)) {
      setLastNameError("Last Name cannot contain numbers.");
      return false;
    }
    if (!/^[a-zA-Z\s\.\-']+$/.test(val)) {
      setLastNameError("Last Name can only contain letters and spaces.");
      return false;
    }
    if (trimmed.length < 2) {
      setLastNameError("Last Name must be at least 2 characters.");
      return false;
    }
    if (trimmed.length > 25) {
      setLastNameError("Last Name cannot exceed 25 characters.");
      return false;
    }
    setLastNameError("");
    return true;
  };

  const validateEmail = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setEmailError("Email address is required.");
      return false;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError("Please enter a valid email address (e.g. supplier@gmail.com).");
      return false;
    }
    if (trimmed.length > 50) {
      setEmailError("Email cannot exceed 50 characters.");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePhone = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (!digits) {
      setPhoneError("Phone number is required.");
      return false;
    }
    const isMobile = /^9\d{9}$/.test(digits);
    const isLandline = /^[2-8]\d{6,7}$/.test(digits);
    if (!isMobile && !isLandline) {
      setPhoneError("Please enter a valid 10-digit mobile number (e.g. 917 123 4567).");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const validateAddress = (st: string, brgy: string, ct: string, pr: string) => {
    if (!st.trim() || !brgy.trim() || !ct.trim() || !pr.trim()) {
      setAddressError("All address fields (Street, Barangay, City, Province) are required.");
      return false;
    }
    const full = `${st.trim()}, ${brgy.trim()}, ${ct.trim()}, ${pr.trim()}`;
    if (full.length < 5) {
      setAddressError("Please enter a complete address (at least 5 characters).");
      return false;
    }
    if (full.length > 100) {
      setAddressError("Address cannot exceed 100 characters.");
      return false;
    }
    setAddressError("");
    return true;
  };

  const validateWebsite = (val: string) => {
    const trimmed = val.trim();
    if (trimmed) {
      const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\\/\w \.-]*)*\/?$/i;
      if (!urlRegex.test(trimmed)) {
        setWebsiteError("Please enter a valid website URL (e.g. www.supplier.com).");
        return false;
      }
      if (trimmed.length > 50) {
        setWebsiteError("Website cannot exceed 50 characters.");
        return false;
      }
    }
    setWebsiteError("");
    return true;
  };

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9\s.,&'-]/g, "").slice(0, 50);
    setCompanyName(val);
    validateCompanyName(val);
  };

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z\s.-]/g, "").slice(0, 25);
    setFirstName(val);
    validateFirstName(val);
  };

  const handleMiddleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z\s.-]/g, "").slice(0, 25);
    setMiddleName(val);
    validateMiddleName(val);
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z\s.-]/g, "").slice(0, 25);
    setLastName(val);
    validateLastName(val);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 50);
    setEmail(val);
    validateEmail(val);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, "");
    if (digits.startsWith("63")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    setPhone(digits);
    validatePhone(digits);
  };

  const handleWebsiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 50);
    setWebsite(val);
    validateWebsite(val);
  };

  const handleSave = async () => {
    const vCompany = validateCompanyName(companyName);
    const vFirst = validateFirstName(firstName);
    const vMiddle = validateMiddleName(middleName);
    const vLast = validateLastName(lastName);
    const vEmail = validateEmail(email);
    const vPhone = validatePhone(phone);
    const vAddr = validateAddress(streetNumber, barangay, city, province);
    const vWeb = validateWebsite(website);

    if (!vCompany || !vFirst || !vMiddle || !vLast || !vEmail || !vPhone || !vAddr || !vWeb) {
      return;
    }

    const fullContact = middleName.trim()
      ? `${lastName.trim()}, ${firstName.trim()} ${middleName.trim()}`
      : `${lastName.trim()}, ${firstName.trim()}`;
    const fullAddress = `${streetNumber.trim()}, ${barangay.trim()}, ${city.trim()}, ${province.trim()}`;

    setSaving(true);
    setSaveError("");
    try {
      await onSave({
        companyName: companyName.trim(),
        contactPerson: fullContact,
        email: email.trim(),
        phone: `+63${phone}`,
        address: fullAddress,
        website: website.trim() || undefined,
        isActive: supplierActive,
        suppliedItemIds: [],
      });
    } catch (err: any) {
      setSaveError(err.message || "Failed to save supplier.");
    } finally {
      setSaving(false);
    }
  };

  const hasErrors =
    !companyName.trim() ||
    !firstName.trim() ||
    !lastName.trim() ||
    !email.trim() ||
    !phone.trim() ||
    !streetNumber.trim() ||
    !barangay.trim() ||
    !city.trim() ||
    !province.trim() ||
    !!companyNameError ||
    !!firstNameError ||
    !!middleNameError ||
    !!lastNameError ||
    !!emailError ||
    !!phoneError ||
    !!addressError ||
    !!websiteError;

  const fieldClass = (err: string) =>
    `w-full h-10 rounded-xl border ${
      err ? "!border-destructive focus-visible:!ring-destructive" : "border-border"
    } bg-card text-foreground px-3.5 text-sm transition-colors focus:ring-1 focus:ring-ring focus:outline-none`;

  const fieldStyle = (err: string) =>
    err ? { borderColor: "var(--destructive)" } : undefined;

  return (
    <ModalWrapper
      open={open}
      title={editingSupplier ? "Edit Supplier" : "Create Supplier"}
      onClose={() => {
        if (!saving) onClose();
      }}
      size="max-w-3xl"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        {saveError && (
          <p role="alert" className="mb-3 text-sm text-destructive font-medium animate-in fade-in-50">
            {saveError}
          </p>
        )}
        <fieldset disabled={saving} className="space-y-4">
          {/* Supplier Name */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Supplier Name <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              maxLength={50}
              value={companyName}
              onChange={handleCompanyNameChange}
              aria-invalid={!!companyNameError}
              style={fieldStyle(companyNameError)}
              placeholder="e.g. Acme Corporation"
              className={fieldClass(companyNameError)}
            />
            {companyNameError && (
              <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">
                {companyNameError}
              </p>
            )}
          </div>

          {/* Contact Person */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Contact Person
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

              {/* Middle Name */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">
                  Middle Name <span className="text-muted-foreground text-[10px]">(Optional)</span>
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
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Email <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                maxLength={50}
                value={email}
                onChange={handleEmailChange}
                aria-invalid={!!emailError}
                style={fieldStyle(emailError)}
                placeholder="e.g. contact@supplier.com"
                className={fieldClass(emailError)}
              />
              {emailError && (
                <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">
                  {emailError}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Phone No. <span className="text-destructive">*</span>
              </label>
              <div
                style={fieldStyle(phoneError)}
                className={`flex h-10 rounded-xl border ${
                  phoneError ? "!border-destructive" : "border-border"
                } bg-card overflow-hidden transition-colors focus-within:ring-1 focus-within:ring-ring`}
              >
                <div className="flex h-full items-center justify-center bg-muted/60 px-3.5 border-r border-border text-xs font-semibold text-muted-foreground select-none">
                  +63
                </div>
                <Input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="917 123 4567"
                  className="h-full w-full rounded-none border-0 bg-transparent text-foreground px-3.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              {phoneError && (
                <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">
                  {phoneError}
                </p>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Address <span className="text-destructive">*</span>
            </label>
            <AddressSelector
              streetNumber={streetNumber}
              setStreetNumber={setStreetNumber}
              barangay={barangay}
              setBarangay={setBarangay}
              city={city}
              setCity={setCity}
              province={province}
              setProvince={setProvince}
              addressError={addressError}
            />
            {addressError && (
              <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">
                {addressError}
              </p>
            )}
          </div>

          {/* Website & Status */}
          <div className={`grid grid-cols-1 ${editingSupplier ? "sm:grid-cols-2" : ""} gap-4`}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Website <span className="text-muted-foreground font-normal text-[11px]">(Optional)</span>
              </label>
              <Input
                type="text"
                maxLength={50}
                value={website}
                onChange={handleWebsiteChange}
                aria-invalid={!!websiteError}
                style={fieldStyle(websiteError)}
                placeholder="e.g. www.acme.com"
                className={fieldClass(websiteError)}
              />
              {websiteError && (
                <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">
                  {websiteError}
                </p>
              )}
            </div>

            {editingSupplier && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Status</label>
                <select
                  value={supplierActive ? "true" : "false"}
                  onChange={(e) => setSupplierActive(e.target.value === "true")}
                  className="w-full h-10 rounded-xl border border-border bg-card text-foreground px-3.5 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={hasErrors || saving}
              className="rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:bg-foreground/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : editingSupplier ? "Save Changes" : "Create Supplier"}
            </Button>
          </div>
        </fieldset>
      </form>
    </ModalWrapper>
  );
}
