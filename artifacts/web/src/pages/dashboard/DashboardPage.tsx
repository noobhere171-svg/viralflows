import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Youtube, ListVideo, Share2, Globe, BarChart3, Activity, ArrowRight, Check } from "lucide-react";
import api from "../../lib/api";
import { formatRelativeTime, getStatusColor } from "../../lib/utils";
import type { AnalyticsOverview, Operation } from "../../types";

const steps = [
  { num: 1, title: "Import Channels", route: "/channels", icon: Youtube },
  { num: 2, title: "Upload OAuth Files", route: "/workspaces", icon: Globe },
  { num: 3, title: "Auto-Assign GCP", route: "/workspaces", icon: Globe },
  { num: 4, title: "Authorize", route: "/workspaces", icon: Share2 },
  { num: 5, title: "Add Sources", route: "/sources", icon: Share2 },
  { num: 6, title: "Start Uploading", route: "/video-queue", icon: ListVideo },
];

const kpiCards = [
  { key: "totalChannels", label: "Total Channels", icon: Youtube },
  { key: "queueCount", label: "Videos in Queue", icon: ListVideo },
  { key: "videosUploaded", label: "Uploaded Today", icon: BarChart3 },
  { key: "totalViews", label: "Total Views", icon: BarChart3 },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(true);

  const { data: overview } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview"],
    queryFn: () => api.get("/analytics/overview"),
  });

  const { data: recentOps } = useQuery<Operation[]>({
    queryKey: ["operations-recent"],
    queryFn: () => api.get("/operations/recent"),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Welcome to ViralFlows</h1>

      {/* Onboarding Wizard */}
      {showOnboarding && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Getting Started</h2>
            <button onClick={() => setShowOnboarding(false)} className="text-sm text-zinc-500 hover:text-white transition-colors">Dismiss</button>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {steps.map((step, i) => (
              <button
                key={step.num}
                onClick={() => navigate(step.route)}
                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3 text-center hover:border-violet-500/30 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-2">
                  <step.icon size={16} className="text-violet-400" />
                </div>
                <div className="text-xs text-zinc-500 font-medium mb-1">Step {step.num}</div>
                <div className="text-xs text-zinc-300 group-hover:text-white transition-colors">{step.title}</div>
                <ArrowRight size={12} className="mx-auto mt-1 text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpiCards.map((kpi) => (
          <div key={kpi.key} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">{kpi.label}</span>
              <kpi.icon size={18} className="text-violet-500" />
            </div>
            <div className="text-2xl font-bold text-white">
              {(overview as any)?.[kpi.key] ?? "-"}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Recent Activity</h3>
          {recentOps?.length ? (
            <div className="space-y-3">
              {recentOps.map((op) => (
                <div key={op.id} className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0">
                  <div>
                    <p className="text-sm text-white capitalize">{op.jobType.replace(/_/g, " ")}</p>
                    <p className="text-xs text-zinc-500">{formatRelativeTime(op.createdAt)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getStatusColor(op.status)}`}>
                    {op.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No recent activity. Start by importing a channel.</p>
          )}
        </div>

        {/* System Status */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">System Status</h3>
          <div className="space-y-3">
            {[
              { label: "GCP Connection", status: "connected" },
              { label: "YouTube API", status: "ok" },
              { label: "TikTok Sources", status: overview?.totalChannels ? "active" : "inactive" },
              { label: "Queue Processing", status: "idle" },
            ].map((sys) => (
              <div key={sys.label} className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0">
                <span className="text-sm text-zinc-400">{sys.label}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${sys.status === "connected" || sys.status === "ok" ? "text-green-500" : sys.status === "active" ? "text-violet-400" : "text-zinc-500"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sys.status === "connected" || sys.status === "ok" ? "bg-green-500" : sys.status === "active" ? "bg-violet-400" : "bg-zinc-500"}`} />
                  {sys.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
