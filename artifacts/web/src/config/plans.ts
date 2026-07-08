export type PlanName = "free" | "starter" | "pro" | "agency";

export interface PlanLimits {
  channels: number;
  dailyUploads: number;
  queueSize: number;
  proxies: number;
  sources: number;
  analyticsDays: number;
  storageMb: number;
  features: {
    customProxy: boolean;
    autoRefill: boolean;
    scheduledUpload: boolean;
    aiSeo: boolean;
    prioritySupport: boolean;
    bulkUpload: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
  };
}

export const PLAN_HIERARCHY: Record<PlanName, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  agency: 3,
};

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: {
    channels: 3,
    dailyUploads: 50,
    queueSize: 20,
    proxies: 0,
    sources: 3,
    analyticsDays: 7,
    storageMb: 100,
    features: {
      customProxy: false,
      autoRefill: false,
      scheduledUpload: false,
      aiSeo: false,
      prioritySupport: false,
      bulkUpload: false,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  starter: {
    channels: 5,
    dailyUploads: 200,
    queueSize: 50,
    proxies: 5,
    sources: 10,
    analyticsDays: 14,
    storageMb: 500,
    features: {
      customProxy: true,
      autoRefill: true,
      scheduledUpload: true,
      aiSeo: false,
      prioritySupport: false,
      bulkUpload: false,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  pro: {
    channels: 15,
    dailyUploads: 500,
    queueSize: 100,
    proxies: 20,
    sources: 30,
    analyticsDays: 30,
    storageMb: 2048,
    features: {
      customProxy: true,
      autoRefill: true,
      scheduledUpload: true,
      aiSeo: true,
      prioritySupport: true,
      bulkUpload: true,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  agency: {
    channels: 50,
    dailyUploads: 999999,
    queueSize: 500,
    proxies: 999999,
    sources: 999999,
    analyticsDays: 90,
    storageMb: 999999,
    features: {
      customProxy: true,
      autoRefill: true,
      scheduledUpload: true,
      aiSeo: true,
      prioritySupport: true,
      bulkUpload: true,
      apiAccess: true,
      whiteLabel: true,
    },
  },
};

export function canAccessFeature(plan: PlanName, feature: keyof PlanLimits["features"]): boolean {
  return PLAN_LIMITS[plan]?.features[feature] ?? false;
}

export function getLimit(plan: PlanName, key: keyof Omit<PlanLimits, "features">): number {
  return PLAN_LIMITS[plan]?.[key] ?? 0;
}

export function isPlanAtLeast(currentPlan: PlanName, requiredPlan: PlanName): boolean {
  return (PLAN_HIERARCHY[currentPlan] ?? 0) >= (PLAN_HIERARCHY[requiredPlan] ?? 0);
}
