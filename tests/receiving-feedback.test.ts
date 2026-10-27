import { beforeEach, expect, it, vi } from "vitest";
import { receiving } from "@/lib/receiving/client";
const fake = vi.hoisted(() => ({ create: vi.fn(), approve: vi.fn(), toast: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: fake.toast } }));
vi.mock("@/app/actions/receiving/receipts", () => ({ createReceipt: fake.create }));
vi.mock("@/app/actions/receiving/quality", () => ({}));
vi.mock("@/app/actions/receiving/stock-ins", () => ({ approveStockIn: fake.approve }));
vi.mock("@/app/actions/receiving/discrepancies", () => ({}));
vi.mock("@/app/actions/receiving/returns", () => ({}));
vi.mock("@/app/actions/receiving/losses", () => ({}));
vi.mock("@/app/actions/receiving/lookups", () => ({}));
beforeEach(() => vi.clearAllMocks());
it("submits form values to the action and announces a successful receipt", async () => {
  const input = { deliveryId: 1, receivedDate: "2026-10-24", items: [] };
  fake.create.mockResolvedValue({ success: true, message: "Receipt created.", data: { grnId: 4 } });
  expect(await receiving.createReceipt(input)).toMatchObject({ data: { success: true, data: { grnId: 4 } } });
  expect(fake.create).toHaveBeenCalledWith(input);
  expect(fake.toast).toHaveBeenCalledWith("Receipt created.");
});
it("keeps validation failures available to the form and never announces success", async () => {
  fake.approve.mockResolvedValue({ success: false, message: "Stock-in is no longer pending." });
  await expect(receiving.approveStockIn(1, {})).rejects.toMatchObject({
    response: { data: { message: "Stock-in is no longer pending." } },
  });
  expect(fake.toast).not.toHaveBeenCalled();
});
it("preserves service failures without announcing success", async () => {
  fake.approve.mockRejectedValue(new Error("Portal unavailable"));
  await expect(receiving.approveStockIn(1, {})).rejects.toThrow("Portal unavailable");
  expect(fake.toast).not.toHaveBeenCalled();
});
