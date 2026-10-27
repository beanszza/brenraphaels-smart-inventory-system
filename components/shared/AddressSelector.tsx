"use client";

import React, { useMemo } from "react";
import phil from "phil-reg-prov-mun-brgy";
import { Input } from "@/components/ui/input";

interface AddressSelectorProps {
  streetNumber: string;
  setStreetNumber: (val: string) => void;
  barangay: string;
  setBarangay: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  province: string;
  setProvince: (val: string) => void;
  addressError?: string;
}

export default function AddressSelector({
  streetNumber, setStreetNumber,
  barangay, setBarangay,
  city, setCity,
  province, setProvince,
  addressError
}: AddressSelectorProps) {
  
  // Sort provinces alphabetically
  const provinces = useMemo(() => {
    return [...phil.provinces].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const selectedProvinceCode = useMemo(() => {
    const p = provinces.find(p => p.name === province);
    return p ? p.prov_code : "";
  }, [province, provinces]);

  const cities = useMemo(() => {
    if (!selectedProvinceCode) return [];
    return [...phil.getCityMunByProvince(selectedProvinceCode)].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedProvinceCode]);

  const selectedCityCode = useMemo(() => {
    const c = cities.find(c => c.name === city);
    return c ? c.mun_code : "";
  }, [city, cities]);

  const barangays = useMemo(() => {
    if (!selectedCityCode) return [];
    return [...phil.getBarangayByMun(selectedCityCode)].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCityCode]);

  const fieldClass = (err?: string | boolean) =>
    `w-full h-10 rounded-xl border ${err ? "!border-destructive focus-visible:!ring-destructive" : "border-border"} bg-card text-foreground px-3.5 text-sm transition-colors focus:ring-1 focus:ring-ring focus:outline-none`;

  const fieldStyle = (err?: string | boolean) =>
    err ? { borderColor: "var(--destructive)" } : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 mb-1.5">
      <select 
        value={province} 
        onChange={(e) => {
          setProvince(e.target.value);
          setCity("");
          setBarangay("");
        }}
        className={fieldClass(addressError && !province.trim())}
        style={fieldStyle(addressError && !province.trim())}
      >
        <option value="" disabled>Select Province</option>
        {provinces.map((p, idx) => (
          <option key={`${p.prov_code}-${idx}`} value={p.name}>{p.name}</option>
        ))}
      </select>
      
      <select 
        value={city} 
        onChange={(e) => {
          setCity(e.target.value);
          setBarangay("");
        }}
        disabled={!province}
        className={fieldClass(addressError && !city.trim())}
        style={fieldStyle(addressError && !city.trim())}
      >
        <option value="" disabled>Select City/Municipality</option>
        {cities.map((c, idx) => (
          <option key={`${c.mun_code}-${idx}`} value={c.name}>{c.name}</option>
        ))}
      </select>

      <select 
        value={barangay} 
        onChange={(e) => setBarangay(e.target.value)}
        disabled={!city}
        className={fieldClass(addressError && !barangay.trim())}
        style={fieldStyle(addressError && !barangay.trim())}
      >
        <option value="" disabled>Select Barangay</option>
        {barangays.map((b, idx) => (
          <option key={`${b.name}-${idx}`} value={b.name}>{b.name}</option>
        ))}
      </select>

      <Input 
        type="text" 
        maxLength={50} 
        value={streetNumber} 
        onChange={(e) => setStreetNumber(e.target.value)}
        aria-invalid={!!addressError && !streetNumber.trim()} 
        style={fieldStyle(addressError && !streetNumber.trim())}
        placeholder="Street Number" 
        className={fieldClass(addressError && !streetNumber.trim())} 
      />
    </div>
  );
}
