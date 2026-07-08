import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    let user;

    if (req.clerkId) {
      const [found] = await db.select().from(users).where(eq(users.clerkId, req.clerkId));
      user = found;
    } else if (req.userId) {
      const [found] = await db.select().from(users).where(eq(users.id, req.userId));
      user = found;
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/logout", requireAuth, (_req: AuthRequest, res) => {
  res.json({ success: true });
});

export default router;
