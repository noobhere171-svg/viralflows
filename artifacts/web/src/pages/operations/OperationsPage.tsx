import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, CheckCircle, AlertCircle, Loader2, Activity, RefreshCw, AlertTriangle, Youtube, ListVideo, BarChart3, Globe, Mail, ExternalLink, Trash2 } from "lucide-react";
import api from "../../lib/api";
import { useConfirm } from "../../components/ConfirmDialog";
import { getStatusColor, formatRelativeTime } from "../../lib/utils";
import type { Operation, Channel, Workspace } from "../../types";

export default function OperationsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [channelSearch, setChannelSearch] = useState("");

  const { data: operations = [] } = useQuery<Operation[]>({
    queryKey: ["operations"],
    queryFn: () => api.get("/operations"),
    refetchInterval: 5000,
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

  const { data: queue = [] } = useQuery<any[]>({
    queryKey: ["queue"],
    queryFn: () => api.get("/queue"),
  });

  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: () => api.get("/workspaces"),
  });

  const { data: authIssues } = useQuery<{ count: number; channels: any[] }>({
    queryKey: ["auth-issues"],
    queryFn: () => api.get("/channels/auth/issues"),
    refetchInterval: 30000,
  });

  const deleteOpMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/operations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["operations"] }),
  });

  const { data: sourceIssues } = useQuery<{ count: number; sources: any[] }>({
    queryKey: ["source-issues"],
    queryFn: () => api.get("/sources/health/issues"),
    refetchInterval: 30000,
  });

  const { data: planData } = useQuery<any>({
    queryKey: ["billing-plan"],
    queryFn: () => api.get("/billing/plan"),
    refetchInterval: 60000,
  });

  const { data: gcpCreds = [] } = useQuery<any[]>({
    queryKey: ["gcp-credentials"],
    queryFn: async () => {
      const ws = await api.get("/workspaces") as any[];
      const allCreds: any[] = [];
      for (const w of ws.slice(0, 5)) {
        try {
          const creds = await api.get(`/workspaces/${w.id}/gcp-credentials`);
          allCreds.push(...creds);
        } catch {}
      }
      return allCreds;
    },
  });

  const { data: userProxies = [] } = useQuery<any[]>({
    queryKey: ["proxies"],
    queryFn: () => api.get("/proxies"),
  });

  const totalChannels = channels.length;
  const activeChannels = channels.filter(c => c.authStatus === "authorized").length;
  const warningsCount = channels.filter(c => c.authStatus === "pending").length;
  const errorsCount = channels.filter(c => c.authStatus === "off" || c.authStatus === "failed").length;
  const uploadsToday = channels.reduce((s, c) => s + (c.uploadsToday || 0), 0);
  const gcpCount = gcpCreds.length;
  const proxyCount = userProxies.length;
  const planFeatures = planData?.features || {};
  const planName = planData?.plan || "free";

  const filteredChannels = channels.filter(ch => {
    if (!channelSearch) return true;
    const q = channelSearch.toLowerCase();
    return ch.channelName?.toLowerCase().includes(q) || ch.youtubeChannelId?.toLowerCase().includes(q);
  });

  const emptyQueueChannels = channels.filter(c => c.authStatus === "authorized").filter(c => {
    const q = queue.filter((v: any) => v.targetChannelId === c.id && (v.status === "pending" || v.status === "processing"));
    return q.length === 0;
  }).length;

  const workspaceMap = useMemo(() => new Map(workspaces.map((w: any) => [w.id, w])), [workspaces]);

  const groupedByWs = useMemo(() => {
    const groups = new Map<string, Channel[]>();
    const ungrouped: Channel[] = [];
    for (const ch of filteredChannels) {
      const ws = workspaceMap.get(ch.workspaceId || "");
      if (ws?.email) {
        const list = groups.get(ws.email) || [];
        list.push(ch);
        groups.set(ws.email, list);
      } else {
        ungrouped.push(ch);
      }
    }
    return { groups, ungrouped };
  }, [filteredChannels, workspaceMap]);

  const wsChannelCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ch of channels) {
      const ws = workspaceMap.get(ch.workspaceId || "");
      if (ws?.email) counts.set(ws.email, (counts.get(ws.email) || 0) + 1);
    }
    return counts;
  }, [channels, workspaceMap]);

  const renderChannelCard = (ch: Channel, q: any[]) => {
    const chQueue = q.filter((v: any) => v.targetChannelId === ch.id);
    const pendingQ = chQueue.filter((v: any) => v.status === "pending").length;
    const todayUp = ch.uploadsToday || 0;
    return (
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ch.authStatus === "authorized" ? "bg-green-500" : ch.authStatus === "pending" ? "bg-amber-500" : "bg-red-500"}`} />
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate">{ch.channelName || ch.youtubeChannelId || "Unnamed"}</p>
              <p className="text-xs text-zinc-600">
                {pendingQ > 0 ? `${pendingQ} queued — will upload on schedule` : "No videos in queue — auto-refill will add more soon"}
                <span className="text-zinc-700 ml-2">· {ch.createdAt ? formatRelativeTime(ch.createdAt) : "—"} ago</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-600 flex-shrink-0">
            <span>{todayUp}/2 today</span>
            <span>{pendingQ} queued</span>
            <span className={ch.authStatus === "authorized" ? "text-green-500" : "text-amber-400"}>{ch.authStatus === "authorized" ? "Active" : "Setup"}</span>
            <span className="text-green-600 text-[10px]">✓ Production</span>
          </div>
        </div>
      </div>
    );
  };

  const opStats = [
    { icon: CheckCircle, label: "Completed", value: operations.filter(o => o.status === "completed").length, color: "text-green-400" },
    { icon: Loader2, label: "In Progress", value: operations.filter(o => o.status === "running" || o.status === "processing" || o.status === "in_progress").length, color: "text-indigo-400" },
    { icon: Clock, label: "Pending", value: operations.filter(o => o.status === "pending" || o.status === "queued").length, color: "text-amber-400" },
    { icon: AlertCircle, label: "Failed", value: operations.filter(o => o.status === "failed").length, color: "text-red-400" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Overview Stats */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        {[
          { label: "Total", value: totalChannels, color: "text-zinc-400" },
          { label: "Active", value: activeChannels, color: "text-green-400" },
          { label: "Warnings", value: warningsCount, color: "text-amber-400" },
          { label: "Errors", value: errorsCount, color: "text-red-400" },
          { label: "Uploads today", value: `${uploadsToday}/6`, color: "text-indigo-400" },
          { label: "Plan", value: planName === "pro" ? "Pro" : "Free", color: "text-zinc-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-center">
            <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-zinc-600 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Source Health Issues Banner */}
      {sourceIssues && sourceIssues.count > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-400 font-medium">Source issues detected</p>
              <p className="text-xs text-zinc-500 mt-1">{sourceIssues.count} source{sourceIssues.count > 1 ? "s" : ""} need attention. Account may be private, banned, or out of videos.</p>
              <div className="mt-2 space-y-1">
                {sourceIssues.sources.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className={`${s.status === "error" ? "text-red-300" : "text-amber-300"} font-medium truncate max-w-[160px]`}>{s.accountHandle || s.accountUrl || s.id.slice(0, 8)}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400">{s.status === "error" ? "Banned/Private" : "No videos"}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400 truncate max-w-[160px]">{s.channelName || "—"}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500 truncate max-w-[160px]">{s.workspaceEmail || "—"}</span>
                    <a href={`/sources`} className="text-red-400 hover:text-red-300 ml-auto flex items-center gap-0.5 flex-shrink-0">
                      Fix source
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth Issues Banner */}
      {authIssues && authIssues.count > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-400 font-medium">YouTube authorization failed</p>
              <p className="text-xs text-zinc-500 mt-1">{authIssues.count} channel{authIssues.count > 1 ? "s" : ""} need re-authorization. GCP credential may have expired or been revoked.</p>
              <div className="mt-2 space-y-1">
                {authIssues.channels.map((ch: any) => (
                  <div key={ch.id} className="flex items-center gap-2 text-xs">
                    <span className="text-red-300 font-medium truncate max-w-[160px]">{ch.channelName || ch.youtubeChannelId || "Unnamed"}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400 truncate max-w-[180px]">{ch.workspaceEmail || "—"}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500">{ch.gcpCredentialName || "—"}</span>
                    <a href={`/channels`} className="text-red-400 hover:text-red-300 ml-auto flex items-center gap-0.5 flex-shrink-0">
                      Re-auth <ExternalLink size={10} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Required + Channel Health */}
      {emptyQueueChannels > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-400 font-medium">Action required</p>
              <p className="text-xs text-zinc-500 mt-1">
                Queue empty — {emptyQueueChannels} channel{emptyQueueChannels > 1 ? "s" : ""}.
                Auto-refill will add videos shortly. Or manually refill from the Queue page.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Channel Health */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity size={14} className="text-indigo-400" /> Channel health
          </h3>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ["channels"] })} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <input className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none" placeholder="Search channels..." value={channelSearch} onChange={(e) => setChannelSearch(e.target.value)} />
          <span className="text-xs text-zinc-500 whitespace-nowrap">{channels.length} channels</span>
        </div>
        <div className="space-y-4">
          {filteredChannels.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">No channels found.</p>
          ) : (
            <>
              {Array.from(groupedByWs.groups.entries()).map(([email, chs]) => (
                <div key={email}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Mail size={14} className="text-zinc-500" />
                    <span className="text-sm text-zinc-400 font-medium">{email}</span>
                    <span className="text-xs text-zinc-600">· {chs.length} channel{chs.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-2">
                    {chs.map(ch => renderChannelCard(ch, queue))}
                  </div>
                </div>
              ))}
              {groupedByWs.ungrouped.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Mail size={14} className="text-zinc-600" />
                    <span className="text-sm text-zinc-600 font-medium">No Gmail</span>
                    <span className="text-xs text-zinc-600">· {groupedByWs.ungrouped.length} channel{groupedByWs.ungrouped.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-2">
                    {groupedByWs.ungrouped.map(ch => renderChannelCard(ch, queue))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Plan Usage */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Plan usage</h3>
          <div className="text-lg font-bold text-zinc-500 mb-3 capitalize">{planName}</div>
          <div className="space-y-2">
            {[
              { label: "GCP Projects", value: gcpCount, limit: planFeatures.gcpProjects ?? "-" },
              { label: "Daily Searches", value: planData?.videosUsedThisMonth || 0, limit: planFeatures.dailySearches ?? "-" },
              { label: "Proxies", value: proxyCount, limit: planFeatures.proxies ?? "-" },
            ].map((item) => {
              const limitNum = typeof item.limit === "number" ? item.limit : -1;
              const showLimit = limitNum === -1 ? "Unlimited" : String(limitNum);
              const exceeded = limitNum !== -1 && item.value > limitNum;
              const pct = limitNum !== -1 && limitNum > 0 ? Math.min((item.value / limitNum) * 100, 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-zinc-500">{item.label}</span>
                    <span className={exceeded ? "text-red-400" : "text-zinc-400"}>{item.value} / {showLimit}</span>
                  </div>
                  {limitNum !== -1 && limitNum > 0 && (
                    <div className="w-full bg-[#0f0f0f] rounded-full h-1">
                      <div className={`h-1 rounded-full ${exceeded ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">System status</h3>
          <div className="space-y-3">
            {[
              { label: "Upload scheduler", status: "Running", color: "text-green-500" },
              { label: "Token auto-refresh", status: "Every 30 min", color: "text-zinc-400" },
              { label: "Auto-refill", status: "Enabled", color: "text-green-500" },
              { label: "Auto-refreshes every", status: "60s", color: "text-zinc-400" },
            ].map((sys) => (
              <div key={sys.label} className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{sys.label}</span>
                <span className={`text-xs font-medium ${sys.color}`}>{sys.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Quick actions</h3>
          <div className="space-y-2">
            {[
              { label: "Manage channels →", href: "/channels" },
              { label: "Video queue →", href: "/video-queue" },
              { label: "Edit schedules →", href: "/schedule" },
              { label: "Workspaces & GCP →", href: "/workspaces" },
            ].map((action) => (
              <a key={action.label} href={action.href} className="block text-xs text-zinc-400 hover:text-indigo-400 py-1.5 transition-colors">{action.label}</a>
            ))}
          </div>
        </div>
      </div>

      {/* Operations Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {opStats.map((s) => (
          <div key={s.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={16} className={s.color} />
              <span className="text-sm text-zinc-400">{s.label}</span>
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Operations Table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              {["Job Type", "Status", "Progress", "Started", "Completed", "Error", ""].map((h) => (
                <th key={h} className="text-left text-xs text-zinc-600 font-medium px-4 py-3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {operations.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-zinc-500 py-12 text-sm">No operations yet.</td></tr>
            ) : operations.map((op) => (
              <tr key={op.id} className="border-b border-[#2a2a2a] hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-sm text-white capitalize">{op.jobType.replace(/_/g, " ")}</td>
                <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded border ${getStatusColor(op.status)}`}>{op.status}</span></td>
                <td className="px-4 py-3">
                  <div className="w-24 bg-[#0f0f0f] rounded-full h-1.5">
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${op.progress ?? 0}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-500">{op.startedAt ? formatRelativeTime(op.startedAt) : "-"}</td>
                <td className="px-4 py-3 text-sm text-zinc-500">{op.completedAt ? formatRelativeTime(op.completedAt) : "-"}</td>
                <td className="px-4 py-3 text-sm text-red-400 max-w-[200px] truncate">{op.errorMessage || "-"}</td>
                <td className="px-4 py-3">
                  <button onClick={async () => { const ok = await confirm({ title: "Delete Operation", message: "Delete this operation?", variant: "danger" }); if (ok) deleteOpMutation.mutate(op.id); }} className="text-zinc-600 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
