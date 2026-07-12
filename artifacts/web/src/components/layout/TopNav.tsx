import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Check, X } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import api from "../../lib/api";
import type { Notification } from "../../types";

const NOTIFICATION_ICONS: Record<string, string> = {
  upload_complete: "\u2705",
  upload_failed: "\u274C",
  auth_expiring: "\u26A0\uFE0F",
  quota_warning: "\uD83D\uDD04",
  new_source: "\uD83D\uDD14",
  weekly_report: "\uD83D\uDCCA",
  gcp_blocked: "\uD83D\uDEAB",
  auth_error: "\uD83D\uDD10",
  source_error: "\u26A0\uFE0F",
  source_exhausted: "\uD83D\uDCA1",
  video_blocked: "\uD83D\uDEAB",
  copyright_claim: "\u00A9\uFE0F",
  welcome: "\uD83C\uDF89",
  info: "\u2139\uFE0F",
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function TopNav() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: countData } = useQuery<{ total: number; unread: number }>({
    queryKey: ["notification-unread-count"],
    queryFn: () => api.get("/notifications/unread-count"),
    refetchInterval: 15000,
  });

  const { data: recentNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications-recent"],
    queryFn: () => api.get("/notifications"),
    enabled: open,
    refetchInterval: open ? 10000 : false,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unread = countData?.unread ?? 0;

  return (
    <div className="h-[60px] border-b border-[#334155] flex items-center justify-between px-6 bg-[#0f172a]">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="text-zinc-400 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-[#0f1b33] border border-[#334155] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/50 w-64"
          />
        </div>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className="relative text-zinc-400 hover:text-white transition-colors p-1"
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-indigo-500 text-[10px] text-white font-bold px-1">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-sm">No notifications yet</div>
              ) : (
                recentNotifications.slice(0, 8).map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-[#2a2a2a]/50 hover:bg-white/[0.02] transition-colors ${!n.isRead ? "bg-violet-500/5" : ""}`}
                    onClick={() => {
                      if (!n.isRead) markReadMutation.mutate(n.id);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm mt-0.5">{NOTIFICATION_ICONS[n.type] || "\uD83D\uDD14"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${!n.isRead ? "text-white" : "text-zinc-400"}`}>
                          {n.message}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-1">{formatTimeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-[#2a2a2a]">
              <button
                onClick={() => {
                  setOpen(false);
                  navigate("/notifications");
                }}
                className="w-full text-center text-xs text-violet-400 hover:text-violet-300 font-medium"
              >
                View all notifications
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
