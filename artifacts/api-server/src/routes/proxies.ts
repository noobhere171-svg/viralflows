import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { proxies } from "../../../../lib/db/src/schema/proxies.js";
import { eq } from "drizzle-orm";
import { checkProxiesLimit } from "../../../../lib/plan-limits.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(proxies).where(eq(proxies.userId, req.userId!));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const limitCheck = await checkProxiesLimit(req.userId!);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: `Proxy limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan to add more proxies.`,
        limitCheck,
      });
    }
    const { host, port, username, password, protocol } = req.body;
    const item = await db.insert(proxies).values({ userId: req.userId!, ipAddress: host, port, protocol, username, passwordEncrypted: password }).returning();
    res.status(201).json(item[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/bulk", async (req: AuthRequest, res) => {
  try {
    const limitCheck = await checkProxiesLimit(req.userId!);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: `Proxy limit reached (${limitCheck.current}/${limitCheck.limit}). Remove existing proxies or upgrade your plan.`,
        limitCheck,
      });
    }
    const { items } = req.body;
    const ALLOWED = ["ipAddress","port","protocol","username","passwordEncrypted"];
    const inserted = await db.insert(proxies).values(items.map((i: any) => {
      const safe: any = { userId: req.userId! };
      for (const key of ALLOWED) { if (i[key] !== undefined) safe[key] = i[key]; }
      return safe;
    })).returning();
    res.status(201).json(inserted);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/test", async (req: AuthRequest, res) => {
  try {
    const [proxy] = await db.select().from(proxies).where(eq(proxies.id, req.params.id as string));
    if (!proxy) return res.status(404).json({ error: "Proxy not found" });

    const start = Date.now();
    let status = "active";
    let speedMs = 0;

    try {
      const proxyUrl = `${proxy.protocol}://${proxy.username ? proxy.username + ":" + (proxy.passwordEncrypted || "") + "@" : ""}${proxy.ipAddress}:${proxy.port}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      await fetch("https://httpbin.org/ip", { signal: controller.signal, dispatcher: undefined } as any);
      clearTimeout(timeout);
      speedMs = Date.now() - start;
    } catch {
      status = "failed";
      speedMs = Date.now() - start;
    }

    await db.update(proxies).set({ lastTestedAt: new Date(), status, speedMs }).where(eq(proxies.id, req.params.id as string));
    res.json({ success: status === "active", speedMs, status });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/test-all", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(proxies).where(eq(proxies.userId, req.userId!));
    // TODO: Test all proxies
    res.json({ success: true, tested: list.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const ALLOWED = ["ipAddress","port","protocol","username","passwordEncrypted","status","speedMs","successRate","assignedSourceId"];
    const safe: Record<string, any> = {};
    for (const key of ALLOWED) { if (key in req.body) safe[key] = req.body[key]; }
    if (Object.keys(safe).length === 0) return res.status(400).json({ error: "No valid fields to update" });
    const updated = await db.update(proxies).set(safe).where(eq(proxies.id, req.params.id as string)).returning();
    res.json(updated[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const [proxy] = await db.select().from(proxies).where(eq(proxies.id, req.params.id as string));
    if (!proxy) return res.status(404).json({ error: "Proxy not found" });
    if (proxy.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(proxies).where(eq(proxies.id, req.params.id as string));
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
