import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Zap, Star, Crown, Building2, Rocket } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const defaultIcons: Record<string, any> = {
  free: Zap,
  starter: Star,
  pro: Crown,
  agency: Building2,
};

const defaultColors: Record<string, { border: string; bg: string; text: string }> = {
  free: { border: "border-zinc-600", bg: "bg-zinc-500/10", text: "text-zinc-400" },
  starter: { border: "border-blue-500", bg: "bg-blue-500/10", text: "text-blue-400" },
  pro: { border: "border-violet-500", bg: "bg-violet-500/10", text: "text-violet-400" },
  agency: { border: "border-orange-500", bg: "bg-orange-500/10", text: "text-orange-400" },
};

const fallbackColors = [
  { border: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  { border: "border-pink-500", bg: "bg-pink-500/10", text: "text-pink-400" },
  { border: "border-cyan-500", bg: "bg-cyan-500/10", text: "text-cyan-400" },
  { border: "border-amber-500", bg: "bg-amber-500/10", text: "text-amber-400" },
];

function getPlanStyle(name: string, index: number) {
  if (defaultColors[name]) return defaultColors[name];
  return fallbackColors[index % fallbackColors.length];
}

function getPlanIcon(name: string) {
  return defaultIcons[name] || Rocket;
}

export default function SelectPlanPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("vf_token");
    if (!token) { navigate("/login", { replace: true }); return; }

    fetch(`${API_BASE}/billing/plans`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { setPlans(data); setLoading(false); })
      .catch(() => { setPlans([]); setLoading(false); });
  }, [navigate]);

  const handleSelect = async (planName: string) => {
    setSelecting(planName);
    setError("");
    try {
      const token = localStorage.getItem("vf_token");
      const res = await fetch(`${API_BASE}/billing/select-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to select plan"); setSelecting(null); return; }

      const user = JSON.parse(localStorage.getItem("vf_user") || "{}");
      user.plan = planName;
      localStorage.setItem("vf_user", JSON.stringify(user));

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Failed to select plan");
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-violet-500" />
      </div>
    );
  }

  const sorted = [...plans].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const cheapest = sorted.filter((p) => p.price > 0).sort((a, b) => a.price - b.price)[0];

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-orange-500 flex items-center justify-center font-bold text-white">VF</div>
            <span className="text-xl font-semibold text-white">ViralFlows</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Choose Your Plan</h1>
          <p className="text-zinc-400">Start free, upgrade anytime. No credit card required.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-6 max-w-md mx-auto">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <div className={`grid gap-5 ${sorted.length <= 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"}`}>
          {sorted.map((plan: any, idx: number) => {
            const features = (typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features) || {};
            const labels = (typeof plan.featureLabels === "string" ? JSON.parse(plan.featureLabels) : plan.featureLabels) || {};
            const Icon = getPlanIcon(plan.name);
            const style = getPlanStyle(plan.name, idx);
            const isRecommended = cheapest ? plan.id === cheapest.id : plan.price > 0;
            const isFree = plan.price === 0;

            return (
              <div key={plan.id} className={`relative rounded-xl border-2 p-6 flex flex-col transition-all hover:scale-[1.02] ${isRecommended && !isFree ? `${style.border} bg-violet-500/5` : "border-[#2a2a2a] bg-[#1a1a1a]"}`}>
                {isRecommended && !isFree && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    RECOMMENDED
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${style.bg}`}>
                    <Icon size={20} className={style.text} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{plan.displayName || plan.name}</h3>
                  </div>
                </div>

                <div className="mb-4">
                  {isFree ? (
                    <div className="text-3xl font-bold text-white">Free</div>
                  ) : (
                    <div className="text-3xl font-bold text-white">
                      {plan.price?.toLocaleString()}
                      <span className="text-sm text-zinc-400 font-normal ml-1">PKR/{plan.billingPeriod || "yearly"}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 flex-1 mb-6">
                  {Object.entries(features).slice(0, 8).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <Check size={14} className="text-green-400 shrink-0" />
                      <span className="text-zinc-300">
                        {labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase())}:{" "}
                        <span className="text-white font-medium">
                          {typeof val === "boolean" ? (val ? "Yes" : "No") : val === 999999 ? "Unlimited" : String(val)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleSelect(plan.name)}
                  disabled={selecting !== null}
                  className={`w-full py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    isFree
                      ? "bg-zinc-700 hover:bg-zinc-600 text-white"
                      : "bg-violet-600 hover:bg-violet-700 text-white"
                  } disabled:opacity-50`}
                >
                  {selecting === plan.name ? (
                    <><Loader2 size={16} className="animate-spin" /> Selecting...</>
                  ) : isFree ? (
                    "Get Started Free"
                  ) : (
                    "Select Plan"
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-zinc-500 text-sm mt-8">
          You can change your plan anytime from Billing settings.
        </p>
      </div>
    </div>
  );
}
