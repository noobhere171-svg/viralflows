import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import api from "../../lib/api";

export default function FreePlanBanner() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    api.get("/billing/plan").then((d) => {
      setPlan(d.plan || "free");
      try {
        const stored = localStorage.getItem("vf_user");
        if (stored) {
          const u = JSON.parse(stored);
          u.plan = d.plan;
          localStorage.setItem("vf_user", JSON.stringify(u));
        }
      } catch {}
    }).catch(() => {
      try {
        const stored = localStorage.getItem("vf_user");
        if (stored) {
          const u = JSON.parse(stored);
          setPlan(u.plan || "free");
        } else setPlan("free");
      } catch { setPlan("free"); }
    });
  }, []);

  if (plan === null || plan === "free") {
    if (plan === null) return null;
    return (
      <div className="bg-gradient-to-r from-violet-600/20 to-orange-500/20 border border-violet-500/30 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} className="text-violet-400" />
          <div>
            <p className="text-sm font-medium text-white">You are on the <span className="text-violet-400">Free Plan</span></p>
            <p className="text-xs text-zinc-400">Upgrade your plan to unlock all features and grow your account</p>
          </div>
        </div>
        <button onClick={() => navigate("/billing")}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors shrink-0">
          Upgrade Plan
        </button>
      </div>
    );
  }

  return null;
}
