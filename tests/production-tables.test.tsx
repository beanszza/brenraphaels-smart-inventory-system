import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import ProductionRequestsTab from "@/components/production/ProductionRequestsTab";
import MaterialIssuanceTab from "@/components/production/MaterialIssuanceTab";
import ProductionQaTab from "@/components/production/ProductionQaTab";
import ProductionStockInTab from "@/components/production/ProductionStockInTab";
import ProductionTrackingTab from "@/components/production/ProductionTrackingTab";
import ConfigurationTab from "@/components/production/ConfigurationTab";
import LossTab from "@/components/production/LossTab";
import type { ProductionRequestEntity, MaterialIssuanceDTO } from "@/components/production/types";

const read = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/production/requests", () => ({ listProductionRequests: read }));
vi.mock("@/app/actions/production/issuances", () => ({ listIssuances: read }));
vi.mock("@/app/actions/production/batches", () => ({ listBatches: read, createBatch: vi.fn() }));
vi.mock("@/app/actions/production/quality", () => ({ listProductionQa: read, reviewProductionQa: vi.fn() }));
vi.mock("@/app/actions/production/products", () => ({ listFinishedProducts: read, createFinishedProduct: vi.fn() }));
vi.mock("@/app/actions/production/product-detail", () => ({ updateFinishedProduct: vi.fn(), deleteFinishedProduct: vi.fn() }));
vi.mock("@/app/actions/production/lookups", () => ({ listItems: read }));
vi.mock("@/app/actions/production/batch-add-to-inventory", () => ({ commitBatchInventory: vi.fn() }));
vi.mock("@/components/production/ProductionRequestModal", () => ({ default: () => null, formatTimeTo12Hour: vi.fn() }));
vi.mock("@/components/production/MaterialIssuanceModal", () => ({ default: () => null }));
vi.mock("@/components/production/ProductionBatchDetailView", () => ({ default: () => null }));
vi.mock("@/components/production/ProductionImage", () => ({ ProductionImage: () => null }));
vi.mock("@/lib/production/image-client", () => ({ uploadProductionImage: vi.fn() }));

it("renders Requests rows during server rendering without a browser read", () => {
  const row = { prodReqId: 1, reqNumber: "PR-2026-99", productName: "Ube Jam", status: "Approved", quantity: 25,
    priority: "High", recipeName: "Jam Recipe" } as ProductionRequestEntity;
  const html = renderToStaticMarkup(<ProductionRequestsTab initialRows={[row]} currentUser="staff" />);
  expect(html).toContain("PR-2026-99");
  expect(html).toContain("Ube Jam");
  expect(html).not.toContain("Loading Production");
  expect(read).not.toHaveBeenCalled();
});

it("renders Material Issuance rows during server rendering", () => {
  const row = { issuanceId: 1, issuanceNumber: "MI-99", reqNumber: "PR-99", productName: "Ube Jam",
    recipeName: "Jam Recipe", requestQuantity: 25, status: "Pending" } as MaterialIssuanceDTO;
  const html = renderToStaticMarkup(<MaterialIssuanceTab initialRows={[row]} />);
  expect(html).toContain("MI-99");
  expect(html).not.toContain("Loading Production");
  expect(read).not.toHaveBeenCalled();
});

it.each([
  ["tracking", <ProductionTrackingTab key="tracking" initialRows={[]} currentUser="staff" />],
  ["qa", <ProductionQaTab key="qa" initialRows={[]} currentUser="staff" />],
  ["stockin", <ProductionStockInTab key="stockin" initialRows={[]} initialItems={[]} currentUser="staff" />],
  ["configuration", <ConfigurationTab key="configuration" initialRows={[]} />],
  ["loss", <LossTab key="loss" initialRows={[]} />],
])("renders the %s empty state on the server, without a loading flash", (_name, element) => {
  const html = renderToStaticMarkup(element);
  expect(html).toContain("No ");
  expect(html).not.toContain("Loading Production");
  expect(read).not.toHaveBeenCalled();
});
