import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import db from "../../../../lib/db/src/index.js";
import { proxies } from "../../../../lib/db/src/schema/proxies.js";
import { globalProxies } from "../../../../lib/db/src/schema/global-proxies.js";
import { users } from "../../../../lib/db/src/schema/users.js";
import { eq, and, or, sql } from "drizzle-orm";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { peekGlobalProxyForUser } from "../../../../lib/plan-limits.js";

const router = Router();
router.use(requireAuth);

// GET /proxies - list user's own proxies (existing users who added proxies before)
router.get("/", async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(proxies).where(eq(proxies.userId, req.userId!));
    res.json(list);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /proxies/assigned - returns the global proxy assigned by admin based on user's plan
router.get("/assigned", async (req: AuthRequest, res) => {
  try {
    const resolved = await peekGlobalProxyForUser(req.userId!);
    if (!resolved) {
      return res.json({ assigned: false });
    }
    const [proxy] = await db.select().from(globalProxies).where(eq(globalProxies.id, resolved.proxyId));
    if (!proxy) {
      return res.json({ assigned: false });
    }
    return res.json({
      assigned: true,
      proxy: {
        id: proxy.id,
        ipAddress: proxy.ipAddress,
        port: proxy.port,
        protocol: proxy.protocol,
        country: proxy.country,
        status: proxy.status,
        speedMs: proxy.speedMs,
        useForFetch: proxy.useForFetch,
        useForDownload: proxy.useForDownload,
        useForUpload: proxy.useForUpload,
      },
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /:id/test - test a user proxy (actually routes through the proxy)
router.post("/:id/test", async (req: AuthRequest, res) => {
  try {
    const [proxy] = await db.select().from(proxies).where(eq(proxies.id, req.params.id as string));
    if (!proxy) return res.status(404).json({ error: "Proxy not found" });
    if (proxy.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    const start = Date.now();
    let status = "active";
    let speedMs = 0;

    try {
      const proxyUrl = `${proxy.protocol}://${proxy.username ? proxy.username + ":" + (proxy.passwordEncrypted || "") + "@" : ""}${proxy.ipAddress}:${proxy.port}`;
      const agent = proxyUrl.startsWith("socks") ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      await fetch("https://httpbin.org/ip", { signal: controller.signal, agent } as any);
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

export default router;
