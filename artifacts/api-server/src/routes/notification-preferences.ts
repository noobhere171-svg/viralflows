import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { notificationPreferences } from "../../../../lib/db/src/schema/notification-preferences.js";
import { eq } from "drizzle-orm";
import { ensureNotificationPrefs } from "../../../../lib/notifications.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    await ensureNotificationPrefs(req.userId!);
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, req.userId!));
    res.json(prefs || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/", async (req: AuthRequest, res) => {
  try {
    await ensureNotificationPrefs(req.userId!);
    const { uploadComplete, uploadFailed, authExpiring, quotaWarning, newSource, weeklyReport } = req.body;

    const [updated] = await db
      .update(notificationPreferences)
      .set({
        ...(uploadComplete !== undefined && { uploadComplete }),
        ...(uploadFailed !== undefined && { uploadFailed }),
        ...(authExpiring !== undefined && { authExpiring }),
        ...(quotaWarning !== undefined && { quotaWarning }),
        ...(newSource !== undefined && { newSource }),
        ...(weeklyReport !== undefined && { weeklyReport }),
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, req.userId!))
      .returning();

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
