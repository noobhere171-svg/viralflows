import db from "./db/src/index.js";
import { users, plans, gcpCredentials, proxies, globalProxies } from "./db/src/schema/index.js";
import { eq, sql, count } from "drizzle-orm";

export type LimitCheck = {
  allowed: boolean;
  current: number;
  limit: number;
};

export async function getUserPlanFeatures(userId: string): Promise<Record<string, any>> {
  const [user] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId));
  if (!user) return {};
  const [plan] = await db.select().from(plans).where(eq(plans.name, user.plan));
  return (plan?.features as Record<string, any>) || {};
}

export async function checkCountLimit(
  userId: string,
  featureKey: string,
  getCurrentCount: () => Promise<number>,
): Promise<LimitCheck> {
  const features = await getUserPlanFeatures(userId);
  const limit = features?.[featureKey];
  if (limit === undefined || limit === null || limit === -1) {
    return { allowed: true, current: 0, limit: -1 };
  }
  const current = await getCurrentCount();
  return { allowed: current < limit, current, limit };
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
