import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { requestNotifications } from "@/lib/notifications/client";
import { listMyNotifications, countMyUnreadNotifications, markMyNotificationRead, markAllMyNotificationsRead } from "@/app/actions/notifications";
vi.mock("@/app/actions/notifications", () => ({ listMyNotifications: vi.fn(), countMyUnreadNotifications: vi.fn(), markMyNotificationRead: vi.fn(), markAllMyNotificationsRead: vi.fn() }));
const record = { id: "n-1", type: "production", title: "Batch ready", body: "Review batch", link: null, sendingApp: "IMS", targetApp: "IMS", userId: "staff-1", createdAt: "2026-10-24T08:00:00Z", readAt: null };
beforeEach(() => {
 vi.mocked(listMyNotifications).mockResolvedValue([record]);
 vi.mocked(countMyUnreadNotifications).mockResolvedValue(1);
});
afterEach(() => vi.resetAllMocks());
it("loads server-scoped notifications and maps gateway body to description", async () => {
 const data = await requestNotifications();
 expect(data.unreadCount).toBe(1);
 expect(data.notifications[0].description).toBe("Review batch");
 expect(listMyNotifications).toHaveBeenCalledWith();
 expect(countMyUnreadNotifications).toHaveBeenCalledWith();
});
it("waits for marking one read before refreshing the count", async () => {
 vi.mocked(markMyNotificationRead).mockImplementation(async () => {
   expect(countMyUnreadNotifications).not.toHaveBeenCalled();
   vi.mocked(countMyUnreadNotifications).mockResolvedValue(0);
 });
 expect((await requestNotifications({ type: "read", id: "n-1" })).unreadCount).toBe(0);
 expect(markMyNotificationRead).toHaveBeenCalledWith("n-1");
});
it("marks all read and refreshes the list", async () => {
 vi.mocked(listMyNotifications).mockResolvedValue([]);
 vi.mocked(countMyUnreadNotifications).mockResolvedValue(0);
 await expect(requestNotifications({ type: "read-all" })).resolves.toEqual({ notifications: [], unreadCount: 0 });
 expect(markAllMyNotificationsRead).toHaveBeenCalledWith();
});
it("does not report success when a read mutation fails", async () => {
 vi.mocked(markMyNotificationRead).mockRejectedValue(new Error("denied"));
 await expect(requestNotifications({ type: "read", id: "n-1" })).rejects.toThrow("denied");
 expect(listMyNotifications).not.toHaveBeenCalled();
});
it("propagates gateway failures for retry", async () => {
 vi.mocked(listMyNotifications).mockRejectedValue(new Error("unavailable"));
 await expect(requestNotifications()).rejects.toThrow("unavailable");
});
it.each([-1, NaN, 1.5])("rejects invalid counts: %s", async (count) => {
 vi.mocked(countMyUnreadNotifications).mockResolvedValue(count);
 await expect(requestNotifications()).rejects.toThrow("Invalid notifications response");
});
it("rejects malformed records", async () => {
 vi.mocked(listMyNotifications).mockResolvedValue([{ ...record, createdAt: "invalid" }]);
 await expect(requestNotifications()).rejects.toThrow("Invalid notifications response");
});
