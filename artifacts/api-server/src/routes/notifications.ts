import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { notifications } from "../../../../lib/db/src/schema/notifications.js";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

router.get("/unread-count", async (req: AuthRequest, res) => {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(eq(notifications.userId, req.userId!));
    const unreadResult = await db.execute<{ count: number }>(
      sql`SELECT COUNT(*)::int as count FROM notifications WHERE user_id = ${req.userId!} AND is_read = false`
    );
    const unreadCount = (unreadResult as any)?.[0]?.count ?? 0;
    res.json({ total: result?.count ?? 0, unread: unreadCount });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(notifications)
      .where(eq(notifications.userId, req.userId!))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const updated = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, req.params.id as string)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/read-all", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(notifications).where(eq(notifications.userId, req.userId!));
    for (const n of list) {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, n.id));
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    await db.delete(notifications).where(eq(notifications.id, req.params.id as string));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
