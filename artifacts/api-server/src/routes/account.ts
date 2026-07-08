import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { eq } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

router.patch("/profile", async (req: AuthRequest, res) => {
  try {
    const { name, avatarUrl } = req.body;
    const updated = await db.update(users).set({ name, avatarUrl }).where(eq(users.clerkId, req.clerkId!)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/password", async (req: AuthRequest, res) => {
  res.json({ success: true, message: "Password managed by Clerk" });
});

router.get("/export", async (req: AuthRequest, res) => {
  try {
    const user = await db.select().from(users).where(eq(users.clerkId, req.clerkId!));
    res.json({ user: user[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/", async (req: AuthRequest, res) => {
  try {
    await db.delete(users).where(eq(users.clerkId, req.clerkId!));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
