import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

const featureLabels: Record<string, string> = {
  channels: "YouTube Channels", sources: "TikTok Sources", queueSize: "Queue Size",
  dailyUploads: "Daily Uploads", proxies: "Admin Proxies", customProxies: "Custom Proxies",
  autoRefill: "Auto-Refill", scheduledUpload: "Scheduled Upload", analyticsDays: "Analytics Days",
  aiSeo: "AI SEO", support: "Support Level", storageMb: "Storage (MB)",
};

export default function PricingPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/billing/plans").then(setPlans).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-indigo-500 font-bold text-xl">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-[#0f0f0f] py-16 px-4">
      <div className="max-w-5xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">Choose Your Plan</h1>
        <p className="text-zinc-400 text-lg">Scale your TikTok to YouTube automation</p>
      </div>
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const features = (typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features) || {};
          const isPopular = plan.name === "pro";
          return (
            <div key={plan.id} className={`bg-[#1a1a1a] border rounded-xl p-6 flex flex-col ${isPopular ? "border-indigo-500 ring-1 ring-indigo-500/30" : "border-[#2a2a2a]"}`}>
              {isPopular && <div className="text-xs text-indigo-400 font-semibold mb-2 uppercase">Most Popular</div>}
              <h3 className="text-white font-semibold text-xl mb-1">{plan.displayName}</h3>
              <div className="text-4xl font-bold text-white mb-6">
                {plan.price === 0 ? "Free" : `${plan.currency === "USD" ? "$" : ""}${plan.price.toLocaleString()}${plan.currency !== "USD" ? " PKR" : ""}`}
                {plan.price > 0 && <span className="text-sm text-zinc-400 font-normal">/{plan.billingPeriod}</span>}
              </div>
              <div className="space-y-3 flex-1 text-sm">
                {Object.entries(features).map(([key, val]) => (
                  <div key={key} className="flex items-start gap-2">
                    <Check size={16} className="text-green-400 mt-0.5 shrink-0" />
                    <span className="text-zinc-300">{featureLabels[key] || key}: <span className="text-white font-medium">{typeof val === "boolean" ? (val ? "Yes" : "No") : val === 999999 ? "Unlimited" : val === 999 ? "Full" : String(val)}</span></span>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate("/register")} className={`w-full mt-6 py-3 rounded-lg text-sm font-semibold ${isPopular ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-[#0f0f0f] border border-[#2a2a2a] text-white hover:bg-white/5"}`}>
                Get Started
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
