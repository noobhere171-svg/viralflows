import { Router } from "express";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/auth.js";
import bcrypt from "bcryptjs";
import db from "../../../../lib/db/src/index.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { plans } from "../../../../lib/db/src/schema/plans.js";
import { planRequests } from "../../../../lib/db/src/schema/plan-requests.js";
import { globalProxies } from "../../../../lib/db/src/schema/global-proxies.js";
import { channels } from "../../../../lib/db/src/schema/channels.js";
import { sources } from "../../../../lib/db/src/schema/sources.js";
import { videoQueue } from "../../../../lib/db/src/schema/video-queue.js";
import { paymentScreenshots } from "../../../../lib/db/src/schema/payment-screenshots.js";
import { eq, and, or, desc, sql, count, ilike } from "drizzle-orm";

const router = Router();
router.use(requireAuth, requireAdmin);

// ─── Admin Dashboard Stats ───
router.get("/stats", async (_req: AuthRequest, res) => {
  try {
    const totalUsers = (await db.select({ count: count() }).from(users))[0]?.count || 0;
    const usersByPlan = await db.select({ plan: users.plan, count: count() }).from(users).groupBy(users.plan);
    const totalChannels = (await db.select({ count: count() }).from(channels))[0]?.count || 0;
    const totalSources = (await db.select({ count: count() }).from(sources))[0]?.count || 0;
    const totalQueue = (await db.select({ count: count() }).from(videoQueue))[0]?.count || 0;
    const pendingRequests = (await db.select({ count: count() }).from(planRequests).where(eq(planRequests.status, "pending")))[0]?.count || 0;
    const pendingPayments = (await db.select({ count: count() }).from(paymentScreenshots).where(eq(paymentScreenshots.status, "pending")))[0]?.count || 0;
    const totalProxies = (await db.select({ count: count() }).from(globalProxies))[0]?.count || 0;
    const activeProxies = (await db.select({ count: count() }).from(globalProxies).where(eq(globalProxies.status, "active")))[0]?.count || 0;
    const totalAdmins = (await db.select({ count: count() }).from(users).where(eq(users.role, "admin")))[0]?.count || 0;

    res.json({
      totalUsers,
      usersByPlan,
      totalChannels,
      totalSources,
      totalQueue,
      pendingRequests,
      pendingPayments,
      totalProxies,
      activeProxies,
      totalAdmins,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Users Management ───
router.get("/users", async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const planFilter = req.query.plan as string;
    const roleFilter = req.query.role as string;

    let conditions: any[] = [];
    if (search) conditions.push(or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`)));
    if (planFilter) conditions.push(eq(users.plan, planFilter));
    if (roleFilter) conditions.push(eq(users.role, roleFilter));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const total = (await db.select({ count: count() }).from(users).where(where))[0]?.count || 0;
    const list = await db.select({
      id: users.id, email: users.email, name: users.name, plan: users.plan, role: users.role,
      whatsappNumber: users.whatsappNumber, country: users.country,
      isLocked: users.isLocked,
      videosUsedThisMonth: users.videosUsedThisMonth, videosLimit: users.videosLimit,
      authProvider: users.authProvider, createdAt: users.createdAt,
    }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset);

    res.json({ total, page, limit, users: list });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/users/:id", async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select({
      id: users.id, email: users.email, name: users.name, plan: users.plan, role: users.role,
      whatsappNumber: users.whatsappNumber, country: users.country,
      videosUsedThisMonth: users.videosUsedThisMonth, videosLimit: users.videosLimit,
      authProvider: users.authProvider, createdAt: users.createdAt,
    }).from(users).where(eq(users.id, req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });

    const userChannels = (await db.select({ count: count() }).from(channels).where(eq(channels.userId, user.id)))[0]?.count || 0;
    const userSources = (await db.select({ count: count() }).from(sources).where(eq(sources.userId, user.id)))[0]?.count || 0;
    const userQueue = (await db.select({ count: count() }).from(videoQueue).where(eq(videoQueue.userId, user.id)))[0]?.count || 0;

    res.json({ ...user, userChannels, userSources, userQueue });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/users/:id", async (req: AuthRequest, res) => {
  try {
    const ALLOWED = ["plan", "role", "videosLimit", "name"];
    const safe: Record<string, any> = {};
    for (const key of ALLOWED) { if (key in req.body) safe[key] = req.body[key]; }
    if (Object.keys(safe).length === 0) return res.status(400).json({ error: "No valid fields" });

    // If changing plan, update videosLimit from plan features
    if (safe.plan) {
      const [plan] = await db.select().from(plans).where(eq(plans.name, safe.plan));
      if (plan) {
        const features = plan.features as any;
        safe.videosLimit = features?.dailyUploads || 3;
      }
    }

    const [updated] = await db.update(users).set(safe).where(eq(users.id, req.params.id)).returning();
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ id: updated.id, email: updated.email, plan: updated.plan, role: updated.role });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/users/:id", async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "admin") return res.status(400).json({ error: "Cannot delete admin" });

    // Cascade delete
    await db.delete(videoQueue).where(eq(videoQueue.userId, user.id));
    await db.delete(sources).where(eq(sources.userId, user.id));
    await db.delete(channels).where(eq(channels.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Plans Management ───
router.get("/plans", async (_req: AuthRequest, res) => {
  try {
    const list = await db.select().from(plans).orderBy(plans.sortOrder);
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/plans", async (req: AuthRequest, res) => {
  try {
    const { name, displayName, price, billingPeriod, features, sortOrder } = req.body;
    if (!name || !displayName) return res.status(400).json({ error: "name and displayName required" });
    const [created] = await db.insert(plans).values({
      name, displayName, price: price || 0, billingPeriod: billingPeriod || "yearly",
      features: features || {}, sortOrder: sortOrder || 0,
    }).returning();
    res.status(201).json(created);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/plans/:id", async (req: AuthRequest, res) => {
  try {
    const ALLOWED = ["displayName", "price", "billingPeriod", "billingDays", "features", "featureLabels", "isActive", "sortOrder", "paymentMethods", "bankDetails"];
    const safe: Record<string, any> = {};
    for (const key of ALLOWED) { if (key in req.body) safe[key] = req.body[key]; }
    if (Object.keys(safe).length === 0) return res.status(400).json({ error: "No valid fields" });
    const [updated] = await db.update(plans).set(safe).where(eq(plans.id, req.params.id)).returning();
    if (!updated) return res.status(404).json({ error: "Plan not found" });
    res.json(updated);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/plans/:id", async (req: AuthRequest, res) => {
  try {
    const [plan] = await db.select().from(plans).where(eq(plans.id, req.params.id));
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    if (plan.name === "free") return res.status(400).json({ error: "Cannot delete free plan" });
    await db.delete(plans).where(eq(plans.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Plan Requests ───
router.get("/plan-requests", async (req: AuthRequest, res) => {
  try {
    const status = (req.query.status as string) || "pending";
    const list = await db.select({
      id: planRequests.id, requestedPlan: planRequests.requestedPlan, status: planRequests.status,
      adminNote: planRequests.adminNote, createdAt: planRequests.createdAt,
      userId: planRequests.userId, userEmail: users.email, userName: users.name,
    }).from(planRequests).leftJoin(users, eq(planRequests.userId, users.id))
      .where(eq(planRequests.status, status)).orderBy(desc(planRequests.createdAt));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/plan-requests/:id/approve", async (req: AuthRequest, res) => {
  try {
    const [pr] = await db.select().from(planRequests).where(eq(planRequests.id, req.params.id));
    if (!pr) return res.status(404).json({ error: "Request not found" });

    // Get plan features for limits
    const [plan] = await db.select().from(plans).where(eq(plans.name, pr.requestedPlan));
    const features = plan?.features as any || {};

    await db.update(users).set({
      plan: pr.requestedPlan,
      videosLimit: features?.dailyUploads || 3,
    }).where(eq(users.id, pr.userId));

    await db.update(planRequests).set({
      status: "approved",
      adminNote: req.body.adminNote || null,
      updatedAt: new Date(),
    }).where(eq(planRequests.id, req.params.id));

    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/plan-requests/:id/reject", async (req: AuthRequest, res) => {
  try {
    const [pr] = await db.select().from(planRequests).where(eq(planRequests.id, req.params.id));
    if (!pr) return res.status(404).json({ error: "Request not found" });

    await db.update(planRequests).set({
      status: "rejected",
      adminNote: req.body.adminNote || null,
      updatedAt: new Date(),
    }).where(eq(planRequests.id, req.params.id));

    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Global Proxies ───
router.get("/proxies", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(globalProxies).orderBy(desc(globalProxies.createdAt));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/proxies", async (req: AuthRequest, res) => {
  try {
    const { ipAddress, port, protocol, username, passwordEncrypted, assignedToPlan, maxConcurrentUsers } = req.body;
    if (!ipAddress || !port) return res.status(400).json({ error: "ipAddress and port required" });
    const [created] = await db.insert(globalProxies).values({
      ipAddress, port, protocol: protocol || "http", username, passwordEncrypted,
      assignedToPlan: assignedToPlan || "all", maxConcurrentUsers: maxConcurrentUsers || 5,
    }).returning();
    res.status(201).json(created);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/proxies/bulk", async (req: AuthRequest, res) => {
  try {
    const { proxies, assignedToPlan } = req.body;
    if (!Array.isArray(proxies) || proxies.length === 0) return res.status(400).json({ error: "proxies array required" });
    let added = 0;
    for (const p of proxies) {
      try {
        await db.insert(globalProxies).values({
          ipAddress: p.ipAddress || p.ip, port: p.port, protocol: p.protocol || "http",
          username: p.username, passwordEncrypted: p.passwordEncrypted || p.password,
          assignedToPlan: assignedToPlan || "all", maxConcurrentUsers: p.maxConcurrentUsers || 5,
        });
        added++;
      } catch {}
    }
    res.status(201).json({ added, total: proxies.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/proxies/:id", async (req: AuthRequest, res) => {
  try {
    const ALLOWED = ["status", "assignedToPlan", "maxConcurrentUsers", "speedMs"];
    const safe: Record<string, any> = {};
    for (const key of ALLOWED) { if (key in req.body) safe[key] = req.body[key]; }
    if (Object.keys(safe).length === 0) return res.status(400).json({ error: "No valid fields" });
    const [updated] = await db.update(globalProxies).set(safe).where(eq(globalProxies.id, req.params.id)).returning();
    if (!updated) return res.status(404).json({ error: "Proxy not found" });
    res.json(updated);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/proxies/:id", async (req: AuthRequest, res) => {
  try {
    await db.delete(globalProxies).where(eq(globalProxies.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Lock/Unlock Users ───
router.post("/users/:id/lock", async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "admin") return res.status(400).json({ error: "Cannot lock admin" });
    await db.update(users).set({ isLocked: true, lockedAt: new Date() }).where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/users/:id/unlock", async (req: AuthRequest, res) => {
  try {
    await db.update(users).set({ isLocked: false, lockedAt: null }).where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Payment Screenshots ───
router.get("/payments", async (req: AuthRequest, res) => {
  try {
    const status = (req.query.status as string) || "pending";
    const list = await db.select({
      id: paymentScreenshots.id, requestedPlan: paymentScreenshots.requestedPlan,
      paymentMethod: paymentScreenshots.paymentMethod, screenshotUrl: paymentScreenshots.screenshotUrl,
      amount: paymentScreenshots.amount, transactionId: paymentScreenshots.transactionId,
      status: paymentScreenshots.status, adminNote: paymentScreenshots.adminNote,
      createdAt: paymentScreenshots.createdAt, userId: paymentScreenshots.userId,
      userEmail: users.email, userName: users.name,
    }).from(paymentScreenshots).leftJoin(users, eq(paymentScreenshots.userId, users.id))
      .where(eq(paymentScreenshots.status, status)).orderBy(desc(paymentScreenshots.createdAt));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/payments/:id/approve", async (req: AuthRequest, res) => {
  try {
    const [ps] = await db.select().from(paymentScreenshots).where(eq(paymentScreenshots.id, req.params.id));
    if (!ps) return res.status(404).json({ error: "Payment not found" });

    const [plan] = await db.select().from(plans).where(eq(plans.name, ps.requestedPlan));
    const features = plan?.features as any || {};

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (plan?.billingDays || 365));

    await db.update(users).set({
      plan: ps.requestedPlan,
      videosLimit: features?.dailyUploads || 3,
      planExpiresAt: expiresAt,
    }).where(eq(users.id, ps.userId));

    await db.update(paymentScreenshots).set({
      status: "approved", adminNote: req.body.adminNote || null, reviewedBy: req.userId,
      updatedAt: new Date(),
    }).where(eq(paymentScreenshots.id, req.params.id));

    await db.delete(planRequests).where(and(eq(planRequests.userId, ps.userId), eq(planRequests.status, "pending")));

    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/payments/:id/reject", async (req: AuthRequest, res) => {
  try {
    await db.update(paymentScreenshots).set({
      status: "rejected", adminNote: req.body.adminNote || null, reviewedBy: req.userId,
      updatedAt: new Date(),
    }).where(eq(paymentScreenshots.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Check Expired Plans ───
router.post("/check-expired", async (_req: AuthRequest, res) => {
  try {
    const now = new Date();
    const expired = await db.select().from(users)
      .where(and(sql`${users.planExpiresAt} IS NOT NULL`, sql`${users.planExpiresAt} < ${now}`, sql`${users.plan} != 'free'`));
    
    for (const user of expired) {
      await db.update(users).set({ plan: "free", videosLimit: 3, planExpiresAt: null }).where(eq(users.id, user.id));
    }
    res.json({ expired: expired.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Create Admin Account ───
router.post("/create-admin", async (req: AuthRequest, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (existing) return res.status(409).json({ error: "Email already exists" });

    const totalAdmins = (await db.select({ count: count() }).from(users).where(eq(users.role, "admin")))[0]?.count || 0;
    if (totalAdmins >= 5) return res.status(403).json({ error: "Maximum 5 admin accounts allowed" });

    const passwordHash = await bcrypt.hash(password, 10);
    const [admin] = await db.insert(users).values({
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
      role: "admin",
      plan: "agency",
      authProvider: "email",
      accountSetupComplete: true,
    }).returning();

    res.json({ admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
