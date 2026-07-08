import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { supportTickets } from "../../../../lib/db/src/schema/support-tickets.js";
import { eq } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

router.post("/tickets", async (req: AuthRequest, res) => {
  try {
    const { subject, category, description } = req.body;
    const ticket = await db.insert(supportTickets).values({ userId: req.userId!, subject, category, description }).returning();
    res.status(201).json(ticket[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/tickets", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(supportTickets).where(eq(supportTickets.userId, req.userId!));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/tickets/:id", async (req: AuthRequest, res) => {
  try {
    const ticket = await db.select().from(supportTickets).where(eq(supportTickets.id, req.params.id as string));
    res.json(ticket[0] || null);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
