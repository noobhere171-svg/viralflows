import { useState, useEffect } from "react";
import { Users, Youtube, ListVideo, Share2, Shield, Clock, Wifi, WifiOff, Image, RefreshCw } from "lucide-react";
import api from "../../lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingExpired, setCheckingExpired] = useState(false);

  useEffect(() => {
    api.get("/admin/stats").then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const checkExpired = async () => {
    setCheckingExpired(true);
    try {
      const res = await api.post("/admin/check-expired");
      alert(`${res.expired} user(s) expired and downgraded to free.`);
      api.get("/admin/stats").then(setStats);
    } catch (err: any) { alert(err.message); }
    setCheckingExpired(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-violet-500 font-bold text-xl">Loading...</div></div>;
  if (!stats) return <div className="text-red-400 p-8">Failed to load stats</div>;

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-violet-400" },
    { label: "Total Channels", value: stats.totalChannels, icon: Youtube, color: "text-red-400" },
    { label: "Total Sources", value: stats.totalSources, icon: Share2, color: "text-orange-400" },
    { label: "Queue Items", value: stats.totalQueue, icon: ListVideo, color: "text-blue-400" },
    { label: "Pending Requests", value: stats.pendingRequests, icon: Clock, color: "text-yellow-400" },
    { label: "Pending Payments", value: stats.pendingPayments || 0, icon: Image, color: "text-pink-400" },
    { label: "Admins", value: stats.totalAdmins, icon: Shield, color: "text-green-400" },
    { label: "Active Proxies", value: stats.activeProxies, icon: Wifi, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <button onClick={checkExpired} disabled={checkingExpired}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-600/20 text-yellow-400 rounded-lg text-sm hover:bg-yellow-600/30 disabled:opacity-50">
          <RefreshCw size={14} className={checkingExpired ? "animate-spin" : ""} /> Check Expired Plans
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <c.icon size={18} className={c.color} />
              <span className="text-sm text-zinc-400">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-white font-semibold mb-3">Users by Plan</h3>
        <div className="space-y-2">
          {stats.usersByPlan?.map((p: any) => (
            <div key={p.plan} className="flex items-center justify-between">
              <span className="text-zinc-300 capitalize">{p.plan}</span>
              <span className="text-white font-medium">{p.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
