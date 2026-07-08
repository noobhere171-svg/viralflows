import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, CreditCard, Shield, ArrowLeft, Image } from "lucide-react";

const adminNav = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/plans", icon: CreditCard, label: "Plans" },
  { to: "/admin/payments", icon: Image, label: "Payments" },
  { to: "/admin/proxies", icon: Shield, label: "Proxies" },
];

export default function AdminLayout() {
  const location = useLocation();
  const sidebarItem = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors";
  const sidebarItemActive = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-violet-500 bg-violet-500/10 font-medium";

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex">
      <div className="w-[240px] bg-[#111111] border-r border-[#2a2a2a] flex flex-col fixed h-screen">
        <div className="p-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-violet-400" />
            <span className="font-semibold text-white text-sm">Admin Panel</span>
          </div>
          <NavLink to="/dashboard" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400">
            <ArrowLeft size={12} /> Back to App
          </NavLink>
        </div>
        <div className="flex-1 px-3 py-3">
          {adminNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => isActive ? sidebarItemActive : sidebarItem}>
              <item.icon size={18} />{item.label}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="flex-1 ml-[240px] p-6">
        <Outlet />
      </div>
    </div>
  );
}
