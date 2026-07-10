import db from "./db/src/index.js";
import { users, plans, gcpCredentials, proxies, globalProxies, featureDefinitions } from "./db/src/schema/index.js";
import { eq, sql, count } from "drizzle-orm";

export type LimitCheck = {
  allowed: boolean;
  current: number;
  limit: number;
};

export async function getUserPlanFeatures(userId: string): Promise<Record<string, any>> {
  const [user] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId));
  if (!user) return {};
  const [plan] = await db.select().from(plans).where(eq(plans.name, user.plan ?? "free"));
  return (plan?.features as Record<string, any>) || {};
}

export async function checkCountLimit(
  userId: string,
  featureKey: string,
  getCurrentCount: () => Promise<number>,
): Promise<LimitCheck> {
  const features = await getUserPlanFeatures(userId);
  const enforceKey = `_enforce_${featureKey}`;
  const enforce = features?.[enforceKey];
  if (enforce === false) {
    return { allowed: true, current: 0, limit: -1 };
  }
  let limit = features?.[featureKey];
  if (limit === undefined || limit === null || limit === -1) {
    const [fd] = await db.select().from(featureDefinitions).where(eq(featureDefinitions.key, featureKey));
    limit = fd?.defaultVal;
    if (limit === undefined || limit === null || limit === -1) {
      return { allowed: true, current: 0, limit: -1 };
    }
  }
  const current = await getCurrentCount();
  return { allowed: current < Number(limit), current, limit: Number(limit) };
}

export async function checkGcpProjectsLimit(userId: string): Promise<LimitCheck> {
  return checkCountLimit(userId, "gcpProjects", async () => {
    const result = await db.select({ count: count() }).from(gcpCredentials)
      .innerJoin(sql`workspaces`, sql`workspaces.id = ${gcpCredentials.workspaceId}`)
      .where(sql`workspaces.user_id = ${userId}`);
    return Number(result[0]?.count || 0);
  });
}

export async function checkProxiesLimit(userId: string): Promise<LimitCheck> {
  return checkCountLimit(userId, "proxies", async () => {
    const result = await db.select({ count: count() }).from(proxies)
      .where(eq(proxies.userId, userId));
    return Number(result[0]?.count || 0);
  });
}

export async function incrementSearchCount(userId: string): Promise<void> {
  await db.update(users)
    .set({
      searchCount: sql`COALESCE(${users.searchCount}, 0) + 1`,
    })
    .where(eq(users.id, userId));
}

export async function getSearchCount(userId: string): Promise<number> {
  const [user] = await db.select({ searchCount: users.searchCount }).from(users).where(eq(users.id, userId));
  return user?.searchCount ?? 0;
}
