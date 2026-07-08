import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export interface PlanData {
  plan: string;
  planDetails: any;
  features: Record<string, any>;
  planExpiresAt: string | null;
  videosUsedThisMonth: number;
  videosLimit: number;
}

const DEFAULT_PLAN: PlanData = {
  plan: "free",
  planDetails: null,
  features: {},
  planExpiresAt: null,
  videosUsedThisMonth: 0,
  videosLimit: 50,
};

export function usePlan() {
  const [planData, setPlanData] = useState<PlanData>(() => {
    try {
      const user = JSON.parse(localStorage.getItem("vf_user") || "{}");
      return { ...DEFAULT_PLAN, plan: user.plan || "free" };
    } catch {
      return DEFAULT_PLAN;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    try {
      const token = localStorage.getItem("vf_token");
      if (!token) { setLoading(false); return; }
      const res = await fetch(`${API_BASE}/billing/plan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlanData(data);
        const user = JSON.parse(localStorage.getItem("vf_user") || "{}");
        user.plan = data.plan;
        localStorage.setItem("vf_user", JSON.stringify(user));
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const refresh = useCallback(() => { setLoading(true); fetchPlan(); }, [fetchPlan]);

  const f = planData.features || {};
  const plan = planData.plan as string;

  return {
    plan,
    planDetails: planData.planDetails,
    features: f,
    planExpiresAt: planData.planExpiresAt,
    videosUsed: planData.videosUsedThisMonth,
    videosLimit: planData.videosLimit,
    loading,
    refresh,
    can: (feature: string): boolean => {
      const val = f[feature];
      if (typeof val === "boolean") return val;
      if (typeof val === "number") return val > 0;
      return false;
    },
    limit: (key: string): number => {
      const val = f[key];
      if (typeof val === "number") return val;
      if (typeof val === "boolean") return val ? 1 : 0;
      return 0;
    },
    isPaid: plan !== "free",
    isFree: plan === "free",
  };
}
