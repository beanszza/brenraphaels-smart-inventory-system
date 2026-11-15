import { expect, it } from "vitest";
import { IMS_ACTIONS, safeAuditMetadata, toLegacyAuditAction } from "@/lib/audit-actions";
it("maps every IMS action to an accepted legacy action", () => {
  for (const action of IMS_ACTIONS) expect(["record.created", "record.updated", "record.deleted", "record.viewed"]).toContain(toLegacyAuditAction(action));
  expect(toLegacyAuditAction("ims.signed_in")).toBe("record.viewed");
  expect(toLegacyAuditAction("stock_in.put_away")).toBe("record.created");
});
it("strips forbidden keys recursively, including objects in arrays", () => {
  expect(safeAuditMetadata({ ok: [{ name: "Test", Password: "x", nested: { authorization: "x", value: 1 } }], creditCard: "x", secret: "x", "pa\u0000ssword": "x" })).toEqual({ ok: [{ name: "Test", nested: { value: 1 } }] });
});
it("bounds UTF-8 size and handles malformed unicode and circular metadata", () => {
  expect(safeAuditMetadata({ text: "?".repeat(4096) })).toEqual({});
  expect(safeAuditMetadata({ text: "a\u0000\ud800b" })).toEqual({ text: "ab" });
  const value: Record<string, unknown> = {}; value.self = value;
  expect(safeAuditMetadata(value)).toEqual({ self: null });
});
