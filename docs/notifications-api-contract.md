# Ticket #16 notification integration

The bell uses the server actions delivered by #15 in `app/actions/notifications.ts`:

| Action | Purpose |
| --- | --- |
| `listMyNotifications()` | Latest 20 notifications for the validated Staff member |
| `countMyUnreadNotifications()` | Total unread count, including items outside the displayed list |
| `markMyNotificationRead(id)` | Mark an owned notification read |
| `markAllMyNotificationsRead()` | Mark all notifications read |

The browser supplies no Staff identity or app name. Server actions validate the session and gateway requests scope notifications to the Portal user ID and `IMS`. Known Staff never grants access.

`lib/notifications/client.ts` maps the gateway record's `body` into the UI's `description`. After a successful mutation it reloads the list and count; failures retain the last confirmed snapshot and show a retryable error. Requests are serialized in the bell to avoid stale refreshes overwriting read results. The latest 20 items appear in a scrollable panel; Mark all read also covers older items.

Refresh runs at mount, when opening, on window focus, and every 60 seconds. Identity changes remount the bell. Selecting an unread item marks it read without navigation. Notification links are not opened, so the destination's independent access check remains unchanged.

Loading and empty states use the existing Skeleton component. The linked Figma file denied access, so the existing bell's design tokens, dimensions, typography and notification styling were retained. Visual comparison with Figma remains pending access.
