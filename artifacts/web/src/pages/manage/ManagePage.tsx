import { useNavigate } from "react-router-dom";
import { Key, Globe, Upload, AlertTriangle, RefreshCw } from "lucide-react";

export default function ManagePage() {
  const navigate = useNavigate();
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Manage</h1>
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Key, label: "GCP Projects", count: 0, desc: "Manage GCP project credentials for YouTube API quota", route: "/workspaces" },
          { icon: Globe, label: "OAuth Tokens", count: 0, desc: "Authorized YouTube accounts and token refresh status", route: "/workspaces" },
          { icon: Upload, label: "Upload Queue", count: 0, desc: "Monitor and manage active uploads across all channels", route: "/video-queue" },
          { icon: AlertTriangle, label: "Alerts", count: 0, desc: "Quota warnings, auth failures, and system notifications", route: "/notifications" },
          { icon: RefreshCw, label: "Sync Status", count: 0, desc: "Source sync status and last sync timestamps", route: "/sources" },
        ].map((item) => (
          <button key={item.label} onClick={() => navigate(item.route)} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 text-left hover:border-violet-500/30 transition-colors">
            <item.icon size={20} className="text-violet-400 mb-3" />
            <h3 className="text-white font-medium text-sm mb-1">{item.label}</h3>
            <p className="text-xs text-zinc-500 mb-2">{item.desc}</p>
            <span className="text-sm font-bold text-white">{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
