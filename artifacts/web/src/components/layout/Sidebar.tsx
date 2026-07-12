import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import {
  LayoutDashboard, Youtube, ListVideo, Share2, Compass, BarChart3,
  Calendar, FolderOpen, Activity, Globe, Shield, Settings,
  CreditCard, Users, Bell, HelpCircle, ChevronLeft, LogOut, ShieldCheck,
} from "lucide-react";
import api, { logout } from "../../lib/api";
import { useUIStore } from "../../stores/uiStore";

const mainNav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/channels", icon: Youtube, label: "Channels" },
  { to: "/video-queue", icon: ListVideo, label: "Video Queue" },
  { to: "/sources", icon: Share2, label: "Sources" },
  { to: "/discover", icon: Compass, label: "Discover" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/schedule", icon: Calendar, label: "Schedule" },
  { to: "/manage", icon: FolderOpen, label: "Manage" },
  { to: "/operations", icon: Activity, label: "Operations" },
  { to: "/workspaces", icon: Globe, label: "Workspaces & GCP" },
  { to: "/proxies", icon: Shield, label: "Proxies" },
];

const accountNav = [
  { to: "/account", icon: Settings, label: "Account" },
  { to: "/billing", icon: CreditCard, label: "Billing" },
  { to: "/referrals", icon: Users, label: "Referrals" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/support", icon: HelpCircle, label: "Support" },
];

export default function Sidebar() {
  const [userPlan, setUserPlan] = useState("free");
  const [userRole, setUserRole] = useState("user");
  const [userName, setUserName] = useState("User");
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  useEffect(() => {
    const stored = localStorage.getItem("vf_user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u.plan) setUserPlan(u.plan);
        if (u.role) setUserRole(u.role);
        if (u.name) setUserName(u.name);
      } catch {}
    }
    // Also fetch from API to stay current
    api.get("/auth/me").then((d) => {
      if (d.user?.plan) setUserPlan(d.user.plan);
      if (d.user?.role) setUserRole(d.user.role);
      if (d.user?.name) setUserName(d.user.name);
    }).catch(() => {});
  }, []);

  const sidebarItem = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer";
  const sidebarItemActive = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-indigo-500 bg-indigo-500/10 font-medium";

  if (!sidebarOpen) return null;

  return (
    <div className="fixed left-0 top-0 z-40 h-screen w-[240px] bg-[#0f1b33] border-r border-[#334155] flex flex-col">
      <div className="flex items-center gap-3 px-4 h-[60px] border-b border-[#334155]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white text-sm">VF</div>
        <span className="font-semibold text-white text-sm">ViralFlows</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider px-3 mb-2">Main</div>
        {mainNav.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? sidebarItemActive : sidebarItem}>
            <item.icon size={18} />{item.label}
          </NavLink>
        ))}

        <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider px-3 mb-2 mt-4">Account</div>
        {accountNav.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? sidebarItemActive : sidebarItem}>
            <item.icon size={18} />{item.label}
          </NavLink>
        ))}

        {userRole === "admin" && (
          <>
            <div className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider px-3 mb-2 mt-4">Admin</div>
            <NavLink to="/admin" className={({ isActive }) => isActive ? sidebarItemActive : sidebarItem}>
              <ShieldCheck size={18} />Admin Panel
            </NavLink>
          </>
        )}
      </div>

      <div className="border-t border-[#2a2a2a] p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
            {userName?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <span className="text-[11px] text-amber-500 font-medium capitalize">{userPlan} Plan</span>
          </div>
          <button onClick={logout} className="text-zinc-500 hover:text-white transition-colors" title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
