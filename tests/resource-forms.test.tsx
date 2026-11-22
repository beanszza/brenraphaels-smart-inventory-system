import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import CategoryModal from "@/components/resources-suppliers/CategoryModal";
import RecipeModal from "@/components/resources-suppliers/RecipeModal";
import RecipeFormPage from "@/components/resources-suppliers/RecipeFormPage";
import SupplierModal from "@/components/resources-suppliers/SupplierModal";
import SupplierTab from "@/components/resources-suppliers/SupplierTab";
import { downloadSuppliersPdf } from "@/components/resources-suppliers/downloadSuppliersPdf";

const mockSave = vi.fn();
class MockJsPdf {
  setFont = vi.fn();
  setFontSize = vi.fn();
  setTextColor = vi.fn();
  text = vi.fn();
  setDrawColor = vi.fn();
  setLineWidth = vi.fn();
  line = vi.fn();
  addPage = vi.fn();
  setPage = vi.fn();
  internal = {
    getNumberOfPages: vi.fn().mockReturnValue(1),
  };
  lastAutoTable = { finalY: 100 };
  save = mockSave;
}

vi.mock("jspdf", () => ({
  jsPDF: MockJsPdf,
  default: MockJsPdf,
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/context/StaffContext", () => ({
  useIsAdmin: () => true,
  useOptionalStaff: () => ({ staffId: "2026-ADMIN-001", name: "System Administrator", role: "Admin" }),
}));
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

it("renders Status badge and active/inactive options when editing a recipe", () => {
  const html = renderToStaticMarkup(
    <RecipeFormPage
      editingRecipe={{
        recipeId: 41,
        recipeCode: "BOM-2026-0041",
        recipeName: "Ube Jam Standard",
        productId: 1,
        finishedProduct: "Ube Halaya",
        outputQuantity: 50,
        notes: "Test notes",
        stages: ["Steaming", "Cooking"],
        isActive: false,
        displayName: "Ube Jam Standard — Batch of 50 pcs",
        yieldLabel: "Batch of 50 pcs",
        ingredients: [],
      }}
      finishedProducts={[{ productId: 1, itemName: "Ube Halaya Smooth", variant: "500 g tub" }]}
      baseSupplies={[]}
      categories={[{ categoryId: 1, categoryName: "Ingredients" }]}
      onCancel={() => {}}
      onSave={async () => {}}
    />
  );

  expect(html).toContain("Edit recipe");
  expect(html).toContain("Inactive");
  expect(html).toContain("Status");
});

it("renders Export PDF button in SupplierTab", () => {
  const html = renderToStaticMarkup(
    <SupplierTab
      suppliers={[
        {
          supplierId: 1,
          supplierCode: "SUP-001",
          companyName: "Metro Sugar Supplies Inc.",
          contactPerson: "Juan Dela Cruz",
          email: "sales@metrosugar.ph",
          phone: "+639171234567",
          address: "Quezon City, Metro Manila",
          isActive: true,
        },
      ]}
      searchQuery=""
      onSearchChange={() => {}}
      statusFilter="All"
      onStatusFilterChange={() => {}}
      currentPage={1}
      onPageChange={() => {}}
      isAuthorizedForReports={true}
      onAddNew={() => {}}
      onEdit={() => {}}
      onView={() => {}}
    />
  );

  expect(html).toContain("Export PDF");
  expect(html).toContain("Refresh");
  expect(html).toContain("Supplier Management");
  expect(html).toContain("Metro Sugar Supplies Inc.");
});

it("executes downloadSuppliersPdf without throwing errors", async () => {
  mockSave.mockClear();

  await expect(
    downloadSuppliersPdf(
      [
        {
          supplierId: 1,
          supplierCode: "SUP-001",
          companyName: "Metro Sugar Supplies Inc.",
          contactPerson: "Juan Dela Cruz",
          email: "sales@metrosugar.ph",
          phone: "+639171234567",
          address: "Quezon City, Metro Manila",
          isActive: true,
        },
      ],
      {
        statusFilter: "All",
        staffName: "System Administrator",
      }
    )
  ).resolves.not.toThrow();

  expect(mockSave).toHaveBeenCalled();
});

