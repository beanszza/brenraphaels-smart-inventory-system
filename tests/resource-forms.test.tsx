import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import SupplierModal from "@/components/resources-suppliers/SupplierModal";
import SupplyModal from "@/components/resources-suppliers/SupplyModal";

vi.mock("@/components/resources-suppliers/ModalWrapper", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

it("opens an existing supplier with its complete address and contact details intact", () => {
  const html = renderToStaticMarkup(<SupplierModal open editingSupplier={{
    supplierId: 1, companyName: "Sample Supplier", contactPerson: "Cruz, Ada",
    email: "ada@example.test", phone: "+639171234567", isActive: true,
    address: "Unit 4, Building A, Old Town, Manila",
  }} onClose={() => {}} onSave={async () => {}} />);
  expect(html).toContain("Unit 4, Building A, Old Town, Manila");
  expect(html).toContain('value="Cruz, Ada"');
  expect(html).toContain('value="9171234567"');
  expect(html).toContain('for="supplier-address"');
});

it("opens supply edits with the linked suppliers already selected", () => {
  const html = renderToStaticMarkup(<SupplyModal open editingItem={{
    itemId: 1, itemName: "Sugar", categoryId: 1, categoryName: "Ingredients", uomId: 1,
    uomName: "kg", minStockLevel: 2.5, maxStockLevel: 50, currentStock: 5,
    isActive: true, supplierIds: [7],
  }} suppliers={[{ supplierId: 7, companyName: "Sample Supplier" }]}
    categories={[{ categoryId: 1, categoryName: "Ingredients" }]}
    uoms={[{ uomId: 1, code: "KG", name: "Kilogram", abbreviation: "kg", uomType: "Weight", conversionFactor: 1 }]}
    onClose={() => {}} onSave={async () => {}} />);
  expect(html).toContain("1 supplier selected");
  expect(html).toContain("Sample Supplier");
  expect(html).toContain('value="2.5"');
});
