import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { plans } from "../../../../lib/db/src/schema/plans.js";
import { planRequests } from "../../../../lib/db/src/schema/plan-requests.js";
import { paymentScreenshots } from "../../../../lib/db/src/schema/payment-screenshots.js";
import { eq, and, desc } from "drizzle-orm";

const uploadDir = path.join(process.cwd(), "uploads", "screenshots");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype === "application/pdf";
    if (ext && mime) cb(null, true);
    else cb(new Error("Only images and PDFs allowed"));
  },
});

const router = Router();
router.use(requireAuth);

router.get("/plan", async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
    if (!user) return res.status(404).json({ error: "User not found" });

    const [plan] = await db.select().from(plans).where(eq(plans.name, user.plan || "free"));
    const features = plan?.features || {};

    res.json({
      plan: user.plan || "free",
      planDetails: plan || null,
      features,
      planExpiresAt: user.planExpiresAt,
      videosUsedThisMonth: user.videosUsedThisMonth || 0,
      videosLimit: user.videosLimit || 3,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/plans", async (_req: AuthRequest, res) => {
  try {
    const list = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.sortOrder);
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/select-plan", async (req: AuthRequest, res) => {
  try {
    const { plan: planName } = req.body;
    if (!planName) return res.status(400).json({ error: "plan required" });

    const [plan] = await db.select().from(plans).where(eq(plans.name, planName));
    if (!plan) return res.status(400).json({ error: "Invalid plan" });

    const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
    if (!user) return res.status(404).json({ error: "User not found" });

    const features = (typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features) || {};

    await db.update(users).set({
      plan: planName,
      videosLimit: features?.dailyUploads || 50,
    }).where(eq(users.id, req.userId!));

    res.json({ success: true, plan: planName });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/upload-screenshot", upload.single("screenshot"), (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const url = `/uploads/screenshots/${req.file.filename}`;
  res.json({ url });
});

router.post("/request-upgrade", async (req: AuthRequest, res) => {
  try {
    const { requestedPlan, paymentMethod, screenshotUrl, amount, transactionId } = req.body;
    if (!requestedPlan) return res.status(400).json({ error: "requestedPlan required" });

    const [plan] = await db.select().from(plans).where(eq(plans.name, requestedPlan));
    if (!plan) return res.status(400).json({ error: "Invalid plan" });

    const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
    if (user?.plan === requestedPlan) return res.status(400).json({ error: "Already on this plan" });

    if (screenshotUrl && paymentMethod) {
      const [ps] = await db.insert(paymentScreenshots).values({
        userId: req.userId!,
        requestedPlan,
        paymentMethod,
        screenshotUrl: screenshotUrl || null,
        amount: amount || plan.price || 0,
        transactionId: transactionId || null,
        status: "pending",
      }).returning();

      const [pr] = await db.insert(planRequests).values({
        userId: req.userId!,
        requestedPlan,
      }).returning();

      return res.status(201).json({ success: true, payment: ps, request: pr });
    }

    const [existing] = await db.select().from(planRequests).where(
      and(eq(planRequests.userId, req.userId!), eq(planRequests.status, "pending"))
    );
    if (existing) return res.status(400).json({ error: "You already have a pending request" });

    const [created] = await db.insert(planRequests).values({
      userId: req.userId!,
      requestedPlan,
    }).returning();

    res.status(201).json({ success: true, request: created });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/my-request", async (req: AuthRequest, res) => {
  try {
    const [request] = await db.select().from(planRequests)
      .where(and(eq(planRequests.userId, req.userId!), eq(planRequests.status, "pending")))
      .orderBy(desc(planRequests.createdAt));
    res.json({ request: request || null });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/my-payments", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(paymentScreenshots)
      .where(eq(paymentScreenshots.userId, req.userId!))
      .orderBy(desc(paymentScreenshots.createdAt));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
