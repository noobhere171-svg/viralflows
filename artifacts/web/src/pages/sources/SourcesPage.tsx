import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, RefreshCw, X, Edit3 } from "lucide-react";
import api from "../../lib/api";
import type { Source, Channel } from "../../types";

const STATUS_STYLES: Record<string, string> = {
  active: "text-green-500 border-green-500/20 bg-green-500/5",
  empty: "text-amber-400 border-amber-400/20 bg-amber-400/5",
  error: "text-red-400 border-red-400/20 bg-red-400/5",
  pending: "text-zinc-500 border-zinc-500/20 bg-zinc-500/5",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  empty: "No videos",
  error: "Error",
  pending: "Pending",
};

export default function SourcesPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editHandle, setEditHandle] = useState("");
  const [form, setForm] = useState({ platform: "tiktok", accountHandle: "", accountUrl: "", linkedChannelId: "" });

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ["sources"],
    queryFn: () => api.get("/sources"),
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

  const { data: workspaces = [] } = useQuery<any[]>({
    queryKey: ["workspaces"],
    queryFn: () => api.get("/workspaces"),
  });

  const channelMap = new Map(channels.map(c => [c.id, c]));
  const workspaceMap = new Map(workspaces.map((w: any) => [w.id, w]));

  const getWorkspaceEmail = (channelId?: string) => {
    if (!channelId) return "-";
    const ch = channelMap.get(channelId);
    if (!ch?.workspaceId) return "-";
    const ws = workspaceMap.get(ch.workspaceId);
    return ws?.email || ws?.name || ch.workspaceId.slice(0, 8);
  };

  const addMutation = useMutation({
    mutationFn: () => api.post("/sources", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sources"] }); setShowAdd(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sources/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sources/${id}/sync`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, handle }: { id: string; handle: string }) => api.patch(`/sources/${id}`, { accountHandle: handle, accountUrl: handle }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sources"] }); setEditId(null); },
  });

  const startEdit = (src: Source) => {
    setEditId(src.id);
    setEditHandle(src.accountHandle || src.accountUrl || "");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Sources</h1>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <Plus size={16} /> Add Source
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Source</h2>
              <button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <select className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
              <input placeholder="TikTok Video URL or @username" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500" value={form.accountHandle} onChange={(e) => setForm({ ...form, accountHandle: e.target.value })} />
              <select className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" value={form.linkedChannelId} onChange={(e) => setForm({ ...form, linkedChannelId: e.target.value })}>
                <option value="">Select YouTube Channel (optional)</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.channelName || ch.youtubeChannelId || ch.id.slice(0, 8)}</option>
                ))}
              </select>
              <button onClick={() => addMutation.mutate()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">Add Source</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Handle Modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditId(null)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Edit Source Account</h2>
              <button onClick={() => setEditId(null)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <label className="text-xs text-zinc-500 block">TikTok Username or URL</label>
              <input className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500" value={editHandle} onChange={(e) => setEditHandle(e.target.value)} placeholder="@new_username" />
              <div className="flex gap-2">
                <button onClick={() => editMutation.mutate({ id: editId, handle: editHandle })} disabled={!editHandle.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">Save</button>
                <button onClick={() => setEditId(null)} className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-400 py-2 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              {["Platform", "Account", "Gmail", "Linked Channel", "Last Synced", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((src) => (
              <tr key={src.id} className="border-b border-[#2a2a2a] hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <span className="text-sm">{src.platform === "tiktok" ? "TikTok" : src.platform === "instagram" ? "Instagram" : "Facebook"}</span>
                </td>
                <td className="px-4 py-3 text-sm text-white">{src.accountHandle || src.accountUrl || "-"}</td>
                <td className="px-4 py-3 text-sm text-zinc-400">{getWorkspaceEmail(src.linkedChannelId)}</td>
                <td className="px-4 py-3 text-sm text-zinc-400">{channelMap.get(src.linkedChannelId || "")?.channelName || src.linkedChannelId?.slice(0, 8) || "-"}</td>
                <td className="px-4 py-3 text-sm text-zinc-500">{src.lastSyncedAt ? new Date(src.lastSyncedAt).toLocaleString() : "Never"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_STYLES[src.status] || STATUS_STYLES.pending}`}>
                    {STATUS_LABELS[src.status] || src.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(src)} className="text-zinc-400 hover:text-indigo-400" title="Edit account handle"><Edit3 size={14} /></button>
                    <button onClick={() => syncMutation.mutate(src.id)} className="text-zinc-400 hover:text-indigo-400" title="Sync"><RefreshCw size={14} /></button>
                    <button onClick={() => { if (window.confirm(`Delete source "${src.accountHandle || src.accountUrl}"?`)) deleteMutation.mutate(src.id); }} className="text-zinc-500 hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
