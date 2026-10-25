import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { STRTable } from "@/components/stock-transfer/STRTable";
import { LocationsTab } from "@/components/stock-transfer/LocationsTab";
import DistributionTable from "@/components/distribution/StockTransferTable";
import type { StockTransferRequest } from "@/components/stock-transfer/types";

it("renders persisted request rows in the server HTML", () => {
  const row = { requestId: 1, requestNumber: "STR-99", toLocationName: "Manila branch", status: "Approved",
    requiredDate: "2026-10-25T00:00:00Z", items: [{ productName: "Ube jam", variant: "Small", requestedQuantity: 12 }] } as StockTransferRequest;
  const html = renderToStaticMarkup(<STRTable requests={[row]} loading={false} onView={vi.fn()} />);
  for (const value of ["STR-99", "Manila branch", "Ube jam", "Approved", "12"]) expect(html).toContain(value);
  expect(html).not.toContain("Loading stock transfers");
});
it("renders locations immediately without a browser fetch", () => {
  const html = renderToStaticMarkup(<LocationsTab locations={[{ locationId: 7, locationName: "Cebu persisted",
    locationType: "Branch", status: "Active", address: "Cebu City", isSystemLocation: false }]} loading={false} onRefresh={vi.fn()} />);
  expect(html).toContain("Cebu persisted");
  expect(html).toContain("Cebu City");
  expect(html).not.toContain("Loading distribution");
});
it("renders persisted transfer identifiers and Received states", () => {
  const html = renderToStaticMarkup(<DistributionTable transfers={[{ id: "STF-2026-99", transferId: 9, product: "Jam",
    from: "Commissary", to: "Manila", quantity: 4, date: "25/10/2026", status: "Received" }]}
    onDispatch={vi.fn()} onReceive={vi.fn()} onCancel={vi.fn()} />);
  expect(html).toContain("STF-2026-99");
  expect(html).toContain("Received");
});
it("uses skeletons for pending table refreshes", () => {
  expect(renderToStaticMarkup(<STRTable requests={[]} loading onView={vi.fn()} />)).toContain('aria-label="Loading Stock Transfer"');
});
it("renders empty request state on the server", () => {
  expect(renderToStaticMarkup(<STRTable requests={[]} loading={false} onView={vi.fn()} />)).toContain("No stock transfers found");
});
