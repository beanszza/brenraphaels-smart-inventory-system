// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateSTRModal } from "@/components/stock-transfer/CreateSTRModal";
import { getTodayDateString } from "@/lib/date-limits";

const mocks = vi.hoisted(() => ({
  getNextRequestNumber: vi.fn(),
  createRequest: vi.fn(),
  suggestLots: vi.fn(),
  listFinishedProducts: vi.fn(),
  listLocations: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: vi.fn(),
  },
}));

vi.mock("@/app/actions/stock-transfer/requests", () => ({
  getNextRequestNumber: mocks.getNextRequestNumber,
  createRequest: mocks.createRequest,
}));

vi.mock("@/app/actions/stock-transfer/lot-suggestions", () => ({
  suggestLots: mocks.suggestLots,
}));

vi.mock("@/app/actions/stock-transfer/products", () => ({
  listFinishedProducts: mocks.listFinishedProducts,
}));

vi.mock("@/app/actions/stock-transfer/locations", () => ({
  listLocations: mocks.listLocations,
}));

if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

describe("CreateSTRModal confirmation modal inside Radix Dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNextRequestNumber.mockResolvedValue({ success: true, data: "STR-2026-0099" });
    mocks.listFinishedProducts.mockResolvedValue({
      success: true,
      data: [
        {
          productId: 101,
          itemId: 10,
          itemName: "Ube Jam",
          variant: "Regular 250g",
          sku: "UBE-250",
          sellingPrice: 250,
        },
      ],
    });
    mocks.listLocations.mockResolvedValue({
      success: true,
      data: [
        {
          locationId: 1,
          locationName: "Commissary Factory",
          locationType: "Commissary",
          isSystemLocation: true,
        },
        {
          locationId: 2,
          locationName: "SM Baguio Branch",
          locationType: "Branch",
          isSystemLocation: false,
        },
      ],
    });
    mocks.suggestLots.mockResolvedValue({
      success: true,
      data: {
        totalAvailable: 50,
        suggestedLots: [
          {
            lotId: 501,
            lotCode: "FG-LOT-001",
            quantityRemaining: 50,
            allocatedQuantity: 5,
            expiryDate: "2027-01-15",
          },
        ],
      },
    });
    mocks.createRequest.mockResolvedValue({ success: true, data: { requestId: 99 } });
  });

  afterEach(() => {
    cleanup();
    document.body.style.pointerEvents = "";
  });

  it("keeps Cancel and Confirm & Submit buttons interactive when ModalWrapper disables body pointer-events", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(<CreateSTRModal open onClose={onClose} onSuccess={onSuccess} />);

    // Wait for prerequisites to load
    await waitFor(() => {
      expect(screen.getByText("STR-2026-0099")).toBeTruthy();
    });

    // Radix Dialog.Root inside ModalWrapper sets pointer-events: none on document.body
    expect(document.body.style.pointerEvents).toBe("none");

    // 1. Select Destination Branch
    await user.click(screen.getByText("Select Destination Branch").closest("button")!);
    await user.click(await screen.findByRole("option", { name: "SM Baguio Branch (Branch)" }));

    // 2. Set Required Date
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    fireEvent.change(dateInput, { target: { value: getTodayDateString() } });

    // 3. Select Reason / Purpose
    await user.click(screen.getByText("Select Reason").closest("button")!);
    await user.click(await screen.findByRole("option", { name: "Branch Replenishment" }));

    // 4. Select Finished Product
    await user.click(screen.getByText("Select Finished Product").closest("button")!);
    await user.click(await screen.findByRole("option", { name: "Ube Jam (Regular 250g)" }));

    await waitFor(() => {
      expect(screen.getByText("(In Stock)")).toBeTruthy();
    });

    // 5. Enter Quantity
    const qtyInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(qtyInput).toBeTruthy();
    fireEvent.change(qtyInput, { target: { value: "5" } });

    // 6. Click Submit Request to open confirmation modal
    const submitBtn = screen.getByRole("button", { name: "Submit Request" });
    await waitFor(() => {
      expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
    });
    await user.click(submitBtn);

    // Confirmation modal should appear with pointer-events-auto on its dialog content
    const confirmBtn = await screen.findByRole("button", { name: "Confirm & Submit" });
    const confirmDialog = confirmBtn.closest('[role="dialog"]') as HTMLElement | null;
    expect(confirmDialog).toBeTruthy();
    expect(confirmDialog?.className).toContain("pointer-events-auto");

    // Click Cancel on the confirmation modal -> confirmation closes, CreateSTRModal stays open
    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
    const confirmCancelBtn = cancelButtons.find((btn) => confirmDialog?.contains(btn));
    expect(confirmCancelBtn).toBeTruthy();
    await user.click(confirmCancelBtn!);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Confirm & Submit" })).toBeNull();
    });
    expect(screen.getByText("Create Stock Transfer Request")).toBeTruthy();

    // Reopen confirmation modal and click Confirm & Submit
    await user.click(screen.getByRole("button", { name: "Submit Request" }));
    const confirmBtnAgain = await screen.findByRole("button", { name: "Confirm & Submit" });
    await user.click(confirmBtnAgain);

    await waitFor(() => {
      expect(mocks.createRequest).toHaveBeenCalledTimes(1);
    });
    expect(mocks.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestNumber: "STR-2026-0099",
        toLocationId: 2,
        reason: "Branch Replenishment",
      })
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
