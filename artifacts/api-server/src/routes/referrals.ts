import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { referrals } from "../../../../lib/db/src/schema/referrals.js";
import { eq } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(referrals).where(eq(referrals.referrerUserId, req.userId!));
    res.json({ referrals: list, link: `${process.env.FRONTEND_URL}/ref/${req.userId}` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
