import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Trash2, Settings } from "lucide-react";
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

const PREF_OPTIONS = [
  { key: "uploadComplete", label: "Upload Complete", desc: "When a video finishes uploading to YouTube" },
  { key: "uploadFailed", label: "Upload Failed", desc: "When a video upload fails" },
  { key: "authExpiring", label: "Auth Expiring", desc: "When YouTube OAuth tokens are about to expire" },
  { key: "quotaWarning", label: "Quota Warning", desc: "When approaching YouTube API daily quota" },
  { key: "newSource", label: "New Source Available", desc: "When new videos are found from sources" },
  { key: "weeklyReport", label: "Weekly Report", desc: "Weekly analytics summary" },
];

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"notifications" | "preferences">("notifications");

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications"),
    refetchInterval: 10000,
  });

  const { data: prefs } = useQuery<any>({
    queryKey: ["notification-preferences"],
    queryFn: () => api.get("/notification-preferences"),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  });

  const savePrefsMutation = useMutation({
    mutationFn: (updatedPrefs: any) => api.put("/notification-preferences", updatedPrefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleTogglePref = (key: string) => {
    if (!prefs) return;
    const camelKey = key;
    savePrefsMutation.mutate({ [camelKey]: !prefs[camelKey] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <span className="bg-violet-500/20 text-violet-400 text-xs font-medium px-2 py-0.5 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("notifications")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "notifications"
                  ? "bg-violet-500/10 text-violet-400"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              <Bell size={12} />
              Notifications
            </button>
            <button
              onClick={() => setActiveTab("preferences")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "preferences"
                  ? "bg-violet-500/10 text-violet-400"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              <Settings size={12} />
              Preferences
            </button>
          </div>
          {activeTab === "notifications" && unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="text-xs text-violet-400 hover:text-violet-300 px-3 py-1.5"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {activeTab === "notifications" ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center text-zinc-500 text-sm">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No notifications yet</p>
              <p className="text-zinc-600 text-xs mt-1">You'll see upload results, errors, and alerts here</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3.5 flex items-start gap-3 hover:bg-white/[0.02] transition-colors ${
                    !n.isRead ? "bg-violet-500/5" : ""
                  }`}
                >
                  <span className="text-lg mt-0.5">{NOTIFICATION_ICONS[n.type] || "\uD83D\uDD14"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${!n.isRead ? "text-white" : "text-zinc-400"}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">{formatTimeAgo(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!n.isRead && (
                      <button
                        onClick={() => markReadMutation.mutate(n.id)}
                        className="text-zinc-600 hover:text-violet-400 p-1"
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (window.confirm("Delete this notification?")) deleteMutation.mutate(n.id);
                      }}
                      className="text-zinc-600 hover:text-red-400 p-1"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <div className="space-y-1">
            {PREF_OPTIONS.map((opt) => (
              <div key={opt.key} className="flex items-center justify-between py-3 border-b border-[#2a2a2a] last:border-0">
                <div>
                  <p className="text-sm text-white">{opt.label}</p>
                  <p className="text-xs text-zinc-500">{opt.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={prefs?.[opt.key] ?? true}
                    onChange={() => handleTogglePref(opt.key)}
                  />
                  <div className="w-9 h-5 bg-[#0f0f0f] peer-checked:bg-violet-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
            ))}
          </div>
          {savePrefsMutation.isSuccess && (
            <div className="mt-4 text-xs text-green-400 flex items-center gap-1">
              <Check size={12} /> Preferences saved
            </div>
          )}
        </div>
      )}
    </div>
  );
}
