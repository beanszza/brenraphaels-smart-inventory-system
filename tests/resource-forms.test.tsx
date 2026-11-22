import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import CategoryModal from "@/components/resources-suppliers/CategoryModal";
import RecipeModal from "@/components/resources-suppliers/RecipeModal";
import RecipeFormPage from "@/components/resources-suppliers/RecipeFormPage";
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

it("hides inactive categories from the SupplyModal Category dropdown", () => {
  const html = renderToStaticMarkup(
    <SupplyModal
      open
      editingItem={null}
      suppliers={[{ supplierId: 7, companyName: "Sample Supplier" }]}
      categories={[
        { categoryId: 1, categoryName: "Raw Materials", isActive: true },
        { categoryId: 2, categoryName: "Ingredients", isActive: false },
      ]}
      uoms={[{ uomId: 1, code: "KG", name: "Kilogram", abbreviation: "kg", uomType: "Weight", conversionFactor: 1 }]}
      onClose={() => {}}
      onSave={async () => {}}
    />
  );
  expect(html).toContain("Raw Materials");
  expect(html).not.toContain("Ingredients");
});

it("renders revised textfield character limits in Category, Supplier, and Supply modals", () => {
  const categoryHtml = renderToStaticMarkup(
    <CategoryModal open editingCategory={null} onClose={() => {}} onSave={() => {}} />
  );
  expect(categoryHtml).toContain("0/50");
  expect(categoryHtml).toContain("0/100");

  const supplierHtml = renderToStaticMarkup(
    <SupplierModal open editingSupplier={null} onClose={() => {}} onSave={async () => {}} />
  );
  expect(supplierHtml).toContain("0/100");
  expect(supplierHtml).toContain("0/50");
  expect(supplierHtml).not.toContain('maxLength="25"');
  expect(supplierHtml).not.toContain('id="supplier-name" maxLength="50"');

  const supplyHtml = renderToStaticMarkup(
    <SupplyModal
      open
      editingItem={null}
      suppliers={[{ supplierId: 7, companyName: "Sample Supplier" }]}
      categories={[{ categoryId: 1, categoryName: "Raw Materials", isActive: true }]}
      uoms={[{ uomId: 1, code: "KG", name: "Kilogram", abbreviation: "kg", uomType: "Weight", conversionFactor: 1 }]}
      onClose={() => {}}
      onSave={async () => {}}
    />
  );
  expect(supplyHtml).toContain("0/50");
  expect(supplyHtml).not.toContain('maxLength="50"');

  const recipeHtml = renderToStaticMarkup(
    <RecipeModal
      open
      editingRecipe={null}
      finishedProducts={[{ productId: 1, itemName: "Ube Halaya", variant: "Standard" }]}
      baseSupplies={[]}
      onClose={() => {}}
      onSave={async () => {}}
    />
  );
  expect(recipeHtml).toContain("Yield per batch");
  expect(recipeHtml).not.toContain("Batch Size");
});

it("renders full-page RecipeFormPage matching Figma redesign with Categories and Production Stages checklists", () => {
  const html = renderToStaticMarkup(
    <RecipeFormPage
      editingRecipe={null}
      finishedProducts={[{ productId: 1, itemName: "Ube Halaya Smooth", variant: "500 g tub" }]}
      baseSupplies={[
        {
          itemId: 10,
          itemName: "Purple yam (ube)",
          categoryId: 1,
          categoryName: "Ingredients",
          uomId: 1,
          uomName: "kg",
          minStockLevel: 5,
          maxStockLevel: 100,
          currentStock: 50,
          isActive: true,
        },
        {
          itemId: 11,
          itemName: "Plastic tubs 500 g",
          categoryId: 2,
          categoryName: "Packaging",
          uomId: 2,
          uomName: "pcs",
          minStockLevel: 10,
          maxStockLevel: 500,
          currentStock: 200,
          isActive: true,
        },
      ]}
      categories={[
        { categoryId: 1, categoryName: "Ingredients" },
        { categoryId: 2, categoryName: "Packaging" },
      ]}
      onCancel={() => {}}
      onSave={async () => {}}
    />
  );

  expect(html).toContain("New recipe");
  expect(html).toContain("Recipe Name");
  expect(html).toContain("Product");
  expect(html).toContain("Variant");
  expect(html).toContain("Yield per batch");
  expect(html).not.toContain("Cooking time");
  expect(html).not.toContain("Shelf life");
  expect(html).not.toContain("Storage");
  expect(html).toContain("Categories");
  expect(html).toContain("Production Stages");
  for (const stage of ["Steaming", "Peeling", "Grinding", "Mixing", "Cooking", "Cooling"]) {
    expect(html).toContain(stage);
  }
  expect(html).toContain("Add Stage");
  expect(html).toContain("Notes");
  expect(html).toContain("0 / 100 words");
});

it("shows confirmation modal before discarding changes when going back to recipes", () => {
  const html = renderToStaticMarkup(
    <RecipeFormPage
      editingRecipe={null}
      finishedProducts={[{ productId: 1, itemName: "Ube Halaya Smooth", variant: "500 g tub" }]}
      baseSupplies={[]}
      categories={[{ categoryId: 1, categoryName: "Ingredients" }]}
      onCancel={() => {}}
      onSave={async () => {}}
    />
  );

  expect(html).toContain("Recipes");
  expect(html).toContain("Cancel");
});
