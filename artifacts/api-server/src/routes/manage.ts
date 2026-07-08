import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { eq } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(videoQueue)
      .where(eq(videoQueue.userId, req.userId!))
      .then((rows: any[]) => rows.filter((v: any) => v.status === "uploaded"));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const ALLOWED = ["title","description","tags","category","visibility","priority","scheduledAt","status","targetChannelId"];
    const safe: Record<string, any> = {};
    for (const key of ALLOWED) { if (key in req.body) safe[key] = req.body[key]; }
    if (Object.keys(safe).length === 0) return res.status(400).json({ error: "No valid fields to update" });
    const updated = await db.update(videoQueue).set(safe).where(eq(videoQueue.id, req.params.id as string)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id/visibility", async (req: AuthRequest, res) => {
  try {
    const { visibility } = req.body;
    const updated = await db.update(videoQueue).set({ visibility }).where(eq(videoQueue.id, req.params.id as string)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    await db.delete(videoQueue).where(eq(videoQueue.id, req.params.id as string));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
