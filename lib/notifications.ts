import { eq } from "drizzle-orm";
import { db } from "./db/src/index.js";
import { notifications } from "./db/src/schema/notifications.js";
import { notificationPreferences } from "./db/src/schema/notification-preferences.js";

export type NotificationType =
  | "upload_complete"
  | "upload_failed"
  | "auth_expiring"
  | "quota_warning"
  | "new_source"
  | "weekly_report"
  | "gcp_blocked"
  | "auth_error"
  | "source_error"
  | "source_exhausted"
  | "video_blocked"
  | "copyright_claim"
  | "welcome"
  | "info";

const TYPE_TO_PREF_KEY: Record<string, string> = {
  upload_complete: "uploadComplete",
  upload_failed: "uploadFailed",
  auth_expiring: "authExpiring",
  quota_warning: "quotaWarning",
  new_source: "newSource",
  weekly_report: "weeklyReport",
};

export async function createNotification(
  userId: string,
  type: NotificationType,
  message: string,
  relatedEntity?: string
): Promise<void> {
  try {
    const prefKey = TYPE_TO_PREF_KEY[type];
    if (prefKey) {
      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (prefs && (prefs as any)[prefKey] === false) return;
    }

    await db.insert(notifications).values({
      userId,
      type,
      message,
      relatedEntity: relatedEntity || null,
    });
  } catch (err) {
    console.error(`[Notifications] Failed to create notification: ${err}`);
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [unreadResult] = await db.execute<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND is_read = false`
  );

  return (unreadResult as any)?.count ?? 0;
}

export async function ensureNotificationPrefs(userId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (!existing) {
    await db.insert(notificationPreferences).values({ userId });
  }
}
