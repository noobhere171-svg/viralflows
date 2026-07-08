import { eq } from "drizzle-orm";
import db from "../../../../lib/db/src/index.js";
import { users } from "../../../../lib/db/src/schema/users.js";

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  agency: 3,
};

export function requirePlan(minimumPlan: string) {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

      const [user] = await db.select().from(users).where(eq(users.id, req.userId));
      if (!user) return res.status(404).json({ error: "User not found" });

      const userLevel = PLAN_HIERARCHY[user.plan || "free"] ?? 0;
      const requiredLevel = PLAN_HIERARCHY[minimumPlan] ?? 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          error: "Upgrade required",
          currentPlan: user.plan || "free",
          requiredPlan: minimumPlan,
          upgradeUrl: "/billing",
        });
      }

      req.userPlan = user.plan || "free";
      next();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}

export function getPlanHierarchy(plan: string): number {
  return PLAN_HIERARCHY[plan] ?? 0;
}
