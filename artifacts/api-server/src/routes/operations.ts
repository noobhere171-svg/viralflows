import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { operations } from "../../../../lib/db/src/schema/operations.js";
import { eq } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(operations).where(eq(operations.userId, req.userId!));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/active", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(operations)
      .where(eq(operations.userId, req.userId!))
      .then((rows: any[]) => rows.filter((o: any) => o.status === "queued" || o.status === "running"));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/history", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(operations)
      .where(eq(operations.userId, req.userId!))
      .then((rows: any[]) => rows.filter((o: any) => o.status === "completed" || o.status === "failed"));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/recent", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(operations).where(eq(operations.userId, req.userId!));
    res.json(list.slice(0, 10));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const [op] = await db.select().from(operations).where(eq(operations.id, req.params.id as string));
    if (!op) return res.status(404).json({ error: "Operation not found" });
    if (op.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(operations).where(eq(operations.id, req.params.id as string));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/retry", async (req: AuthRequest, res) => {
  try {
    const updated = await db.update(operations).set({ status: "queued", errorMessage: null }).where(eq(operations.id, req.params.id as string)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
