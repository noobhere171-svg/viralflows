import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { scheduledUploads } from "../../../../lib/db/src/schema/scheduled-uploads.js";
import { channels } from "../../../../lib/db/src/schema/channels.js";
import { eq, and } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(scheduledUploads).where(eq(scheduledUploads.userId, req.userId!));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/global", async (req: AuthRequest, res) => {
  try {
    const { maxVideosPerDay, timezone, uploadTimes, workspaceId } = req.body;
    let userChannels;
    if (workspaceId) {
      userChannels = await db.select().from(channels).where(and(eq(channels.userId, req.userId!), eq(channels.workspaceId, workspaceId)));
    } else {
      userChannels = await db.select().from(channels).where(eq(channels.userId, req.userId!));
    }
    if (userChannels.length === 0) return res.status(400).json({ error: "No channels found" });

    const times: string[] = Array.isArray(uploadTimes) && uploadTimes.length > 0 ? uploadTimes : ["12:00"];
    const firstTime = times[0];
    const [h, m] = firstTime.split(":").map(Number);
    const cronExpression = `${m} ${h} * * *`;

    const results = [];
    for (const ch of userChannels) {
      const existing = await db.select({ id: scheduledUploads.id }).from(scheduledUploads)
        .where(eq(scheduledUploads.channelId, ch.id)).limit(1);

      const data = {
        maxVideosPerDay: String(maxVideosPerDay || 3),
        uploadTimes: JSON.stringify(times),
        timezone: timezone || "UTC",
        cronExpression,
        active: true,
      };

      if (existing.length > 0) {
        const [updated] = await db.update(scheduledUploads).set(data)
          .where(eq(scheduledUploads.id, existing[0].id)).returning();
        results.push(updated);
      } else {
        const [created] = await db.insert(scheduledUploads).values({
          userId: req.userId!,
          channelId: ch.id,
          scheduledAt: new Date(),
          ...data,
        }).returning();
        results.push(created);
      }
    }

    res.status(201).json({ success: true, count: results.length, schedules: results });
  } catch (err: any) {
    console.error("[Schedule/global] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const updateData: any = {};
    if (req.body.maxVideosPerDay !== undefined) updateData.maxVideosPerDay = String(req.body.maxVideosPerDay);
    if (req.body.uploadTimes !== undefined) {
      const times = Array.isArray(req.body.uploadTimes) ? req.body.uploadTimes : JSON.parse(req.body.uploadTimes);
      updateData.uploadTimes = JSON.stringify(times);
    }
    if (req.body.timezone !== undefined) updateData.timezone = req.body.timezone;
    if (req.body.active !== undefined) updateData.active = req.body.active;

    const updated = await db.update(scheduledUploads).set(updateData)
      .where(eq(scheduledUploads.id, req.params.id as string)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const [sched] = await db.select().from(scheduledUploads).where(eq(scheduledUploads.id, req.params.id as string));
    if (!sched) return res.status(404).json({ error: "Schedule not found" });
    if (sched.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(scheduledUploads).where(eq(scheduledUploads.id, req.params.id as string));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
