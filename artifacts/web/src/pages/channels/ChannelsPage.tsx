import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, ExternalLink, ChevronDown, ChevronRight, Clock, X, Upload, Copy, Check, Settings } from "lucide-react";
import api from "../../lib/api";
import { getStatusColor, formatRelativeTime } from "../../lib/utils";
import type { Channel, Source, Workspace, Schedule } from "../../types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function safeJson(val: string | undefined | null): any {
  try { return JSON.parse(val || "[]"); } catch { return []; }
}

function formatTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function TodayUploads({ schedule }: { schedule?: Schedule }) {
  if (!schedule) return <span className="text-zinc-500">0/0</span>;
  const max = schedule.maxVideosPerDay || "3";
  return <span className="text-zinc-400">0/{max}</span>;
}

function AutoRefillModal({ 
  isOpen, 
  onClose, 
  workspaces, 
  sources, 
  channels,
  gmailFilter,
  setGmailFilter
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  workspaces: Workspace[]; 
  sources: Source[]; 
  channels: Channel[];
  gmailFilter: string;
  setGmailFilter: (v: string) => void;
}) {
  const queryClient = useQueryClient();
  const [autoRefillEnabled, setAutoRefillEnabled] = useState(false);
  const [sortBy, setSortBy] = useState<string>("all");
  const [minViews, setMinViews] = useState(500);
  const [maxAge, setMaxAge] = useState(10);
  const [cookiesExist, setCookiesExist] = useState(false);
  const [cookiesFile, setCookiesFile] = useState<File | null>(null);
  const [cookiesMsg, setCookiesMsg] = useState("");

  // Check cookies status when workspace changes
  useEffect(() => {
    if (gmailFilter && gmailFilter !== "all") {
      api.get(`/workspaces/${gmailFilter}/cookies`).then(r => {
        setCookiesExist(r.data.exists);
      }).catch(() => setCookiesExist(false));
    } else {
      setCookiesExist(false);
    }
  }, [gmailFilter]);

  const uploadCookies = useMutation({
    mutationFn: async () => {
      if (!cookiesFile || !gmailFilter || gmailFilter === "all") return;
      const text = await cookiesFile.text();
      const r = await api.put(`/workspaces/${gmailFilter}/cookies`, { cookies: text });
      return r.data;
    },
    onSuccess: (data) => {
      setCookiesExist(true);
      setCookiesMsg("Cookies uploaded successfully!");
      setCookiesFile(null);
      setTimeout(() => setCookiesMsg(""), 3000);
    },
    onError: (err: any) => {
      setCookiesMsg(err.response?.data?.error || "Upload failed");
    },
  });

  const deleteCookies = useMutation({
    mutationFn: async () => {
      if (!gmailFilter || gmailFilter === "all") return;
      await api.delete(`/workspaces/${gmailFilter}/cookies`);
    },
    onSuccess: () => {
      setCookiesExist(false);
      setCookiesMsg("Cookies deleted");
      setTimeout(() => setCookiesMsg(""), 3000);
    },
  });

  const wsSources = useMemo(() => {
    if (gmailFilter === "all") return sources;
    const wsChannelIds = new Set(channels.filter(c => c.workspaceId === gmailFilter).map(c => c.id));
    return sources.filter(s => s.linkedChannelId && wsChannelIds.has(s.linkedChannelId));
  }, [sources, gmailFilter, channels]);

  useEffect(() => {
    const f = wsSources[0] ? ((wsSources[0] as any).contentFilter || {}) : {};
    setAutoRefillEnabled(f.autoRefillEnabled ?? false);
    setSortBy(f.sortBy ?? "all");
    setMinViews(Math.max(f.minViews ?? 500, 500));
    setMaxAge(f.maxAge ?? 10);
  }, [wsSources]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.post("/channels/auto-refill/bulk", {
        enabled: autoRefillEnabled,
        sortBy,
        minViews,
        maxAge,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.refetchQueries({ queryKey: ["sources"] });
      onClose();
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Auto-Refill Settings</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">Apply To Workspace</label>
            <select value={gmailFilter} onChange={(e) => setGmailFilter(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white">
              <option value="all">All Workspaces</option>
              {workspaces.map((w: any) => (
                <option key={w.id} value={w.id}>{w.email || w.name || w.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>

          {gmailFilter !== "all" && (
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
              <div className="text-xs text-zinc-500 font-medium mb-2">TikTok Cookies (for yt-dlp)</div>
              <div className="text-[10px] text-zinc-500 mb-2">
                Export cookies from browser when logged into TikTok. Use a browser extension like "Get cookies.txt LOCALLY".
              </div>
              {cookiesExist ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-400">Cookies uploaded</span>
                  <button onClick={() => deleteCookies.mutate()} disabled={deleteCookies.isPending} className="text-xs text-red-400 hover:text-red-300">
                    {deleteCookies.isPending ? "Deleting..." : "Delete"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs cursor-pointer">
                    {cookiesFile ? cookiesFile.name : "Choose cookies.txt"}
                    <input type="file" accept=".txt" className="hidden" onChange={(e) => setCookiesFile(e.target.files?.[0] || null)} />
                  </label>
                  {cookiesFile && (
                    <button onClick={() => uploadCookies.mutate()} disabled={uploadCookies.isPending} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs">
                      {uploadCookies.isPending ? "Uploading..." : "Upload"}
                    </button>
                  )}
                </div>
              )}
              {cookiesMsg && <div className="text-xs text-indigo-400 mt-1">{cookiesMsg}</div>}
            </div>
          )}

          {wsSources.length > 0 ? (
            <>
              <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-1">
                  {gmailFilter === "all" ? `All ${sources.length} source(s) across all channels:` : `${wsSources.length} source(s) under this workspace:`}
                </div>
                {wsSources.slice(0, 5).map(s => {
                  const sc = s.linkedChannelId ? channels.find(c => c.id === s.linkedChannelId) : null;
                  return (
                    <div key={s.id} className="text-xs text-white flex items-center gap-2 py-0.5">
                      <span className="text-zinc-400">•</span>
                      <span>{s.accountHandle || s.accountUrl || s.platform}</span>
                      {sc && <span className="text-zinc-500">→ {sc.channelName || sc.youtubeChannelId?.slice(0, 16)}</span>}
                    </div>
                  );
                })}
                {wsSources.length > 5 && <div className="text-[10px] text-zinc-500 mt-1">...and {wsSources.length - 5} more</div>}
                <div className="text-[10px] text-indigo-400 mt-1">Settings will apply to all {wsSources.length} source(s)</div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={autoRefillEnabled} onChange={(e) => setAutoRefillEnabled(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
                <span className="text-sm text-white font-medium">Auto-Refill Enabled</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 font-medium mb-1 block">Max Age (min)</label>
                  <input type="number" value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} min={1} max={10} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-medium mb-1 block">Min Views</label>
                  <input type="number" value={minViews} onChange={(e) => setMinViews(Number(e.target.value))} min={500} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-medium mb-1 block">Sort By</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white">
                  <option value="all">All Videos (Newest First)</option>
                  <option value="oldest">All Videos (Oldest First)</option>
                  <option value="most_viewed">Most Viewed</option>
                  <option value="most_recent">Most Recent</option>
                </select>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-4">
              No sources found for this selection.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#2a2a2a]">
          <button onClick={onClose} className="bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-300 hover:text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">Close</button>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || wsSources.length === 0} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            {saveMutation.isPending ? "Saving..." : "Save Auto-Refill Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChannelsPage() {
  const queryClient = useQueryClient();
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [wsFilter, setWsFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [authorizeUrls, setAuthorizeUrls] = useState<Record<string, string>>({});
  const [importRows, setImportRows] = useState<{ tiktokUsername: string; channelName: string; youtubeChannelId: string; gmail: string }[]>(
    [{ tiktokUsername: "", channelName: "", youtubeChannelId: "", gmail: "" }]
  );
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showAutoRefill, setShowAutoRefill] = useState(false);
  const [autoRefillGmailFilter, setAutoRefillGmailFilter] = useState("all");

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "youtube-oauth-success") {
        queryClient.invalidateQueries({ queryKey: ["channels"] });
        const ch = e.data.verifiedChannel;
        if (ch) setFeedback({ type: "success", msg: `Authorized YouTube channel: ${ch.name}` });
        else setFeedback({ type: "success", msg: "Channel authorized!" });
        setTimeout(() => setFeedback(null), 8000);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [queryClient]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    const channelId = params.get("channelId");
    const verifiedRaw = params.get("verified");
    if (oauth === "success") {
      let verifiedName = "";
      if (verifiedRaw) {
        try { const v = JSON.parse(decodeURIComponent(verifiedRaw)); if (v?.name) verifiedName = v.name; } catch {}
      }
      setFeedback({ type: "success", msg: verifiedName ? `Authorized YouTube channel: ${verifiedName}` : "Channel authorized!" });
      window.history.replaceState({}, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setTimeout(() => setFeedback(null), 8000);
    }
  }, [queryClient]);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: () => api.get("/workspaces"),
  });

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ["sources"],
    queryFn: () => api.get("/sources"),
  });

  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    queryFn: () => api.get("/schedule"),
  });

  const importMutation = useMutation({
    mutationFn: () => api.post("/channels/batch-import", { rows: importRows.filter(r => r.tiktokUsername && r.channelName && r.youtubeChannelId && r.gmail) }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setImportStatus(`Imported ${data.imported} channels${data.errors > 0 ? `, ${data.errors} errors` : ""}`);
      setImportRows([{ tiktokUsername: "", channelName: "", youtubeChannelId: "", gmail: "" }]);
    },
    onError: (err: any) => setImportStatus(`Error: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/channels/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }),
  });

  const scheduleMap = useMemo(() => {
    const m = new Map<string, Schedule>();
    for (const s of schedules) {
      if (s.channelId) m.set(s.channelId, s);
    }
    return m;
  }, [schedules]);

  const sourceMap = useMemo(() => {
    const m = new Map<string, Source>();
    for (const s of sources) {
      if (s.linkedChannelId) m.set(s.linkedChannelId, s);
    }
    return m;
  }, [sources]);

  const filtered = useMemo(() => {
    return channels.filter((ch) => {
      if (search && !ch.channelName?.toLowerCase().includes(search.toLowerCase()) && !ch.youtubeChannelId?.toLowerCase().includes(search.toLowerCase())) return false;
      if (wsFilter !== "all" && ch.workspaceId !== wsFilter) return false;
      if (statusFilter === "live" && ch.authStatus !== "authorized") return false;
      if (statusFilter === "setup" && ch.authStatus !== "pending") return false;
      if (statusFilter === "off" && ch.authStatus !== "off") return false;
      return true;
    });
  }, [channels, search, wsFilter, statusFilter]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              className="w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none"
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={wsFilter} onChange={(e) => setWsFilter(e.target.value)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white">
            <option value="all">All Workspaces</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.email || w.name || w.id.slice(0, 8)}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white">
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="setup">Setup</option>
            <option value="off">Off</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Total: {channels.length}</span>
          <span className="text-xs text-green-500">Live: {channels.filter(c => c.authStatus === "authorized").length}</span>
          <span className="text-xs text-amber-500">Setup: {channels.filter(c => c.authStatus === "pending").length}</span>
          <span className="text-xs text-zinc-600">Off: {channels.filter(c => c.authStatus === "off" || !c.authStatus).length}</span>
          <span className="text-xs text-zinc-500 ml-2">Today: {channels.reduce((s, c) => s + (c.uploadsToday || 0), 0)}/{schedules.length * 3}</span>
          <button onClick={() => setShowAutoRefill(true)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ml-2 flex items-center gap-1.5">
            <Settings size={14} /> Auto-Refill
          </button>
          <button onClick={() => setShowImport(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ml-4">
            Import
          </button>
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowImport(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Batch Import Channels</h2>
              <button onClick={() => setShowImport(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            {importStatus && (
              <div className="mb-4 text-sm text-zinc-300 bg-zinc-800/50 rounded-lg px-4 py-2">
                {importStatus}
                <button onClick={() => setImportStatus(null)} className="ml-2 text-zinc-500 hover:text-white"><X size={14} className="inline" /></button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    <th className="text-left text-xs text-zinc-600 font-medium px-2 py-2 uppercase tracking-wider">TikTok Username</th>
                    <th className="text-left text-xs text-zinc-600 font-medium px-2 py-2 uppercase tracking-wider">YT Name</th>
                    <th className="text-left text-xs text-zinc-600 font-medium px-2 py-2 uppercase tracking-wider">YT Channel ID</th>
                    <th className="text-left text-xs text-zinc-600 font-medium px-2 py-2 uppercase tracking-wider">Gmail</th>
                    <th className="w-10 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i} className="border-b border-[#2a2a2a]">
                      <td className="px-2 py-1.5">
                        <input placeholder="@handle"
                          className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white placeholder:text-zinc-500"
                          value={row.tiktokUsername}
                          onChange={(e) => {
                            const next = [...importRows];
                            next[i] = { ...next[i], tiktokUsername: e.target.value };
                            setImportRows(next);
                          }} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input placeholder="Channel name"
                          className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white placeholder:text-zinc-500"
                          value={row.channelName}
                          onChange={(e) => {
                            const next = [...importRows];
                            next[i] = { ...next[i], channelName: e.target.value };
                            setImportRows(next);
                          }} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input placeholder="UCxxxx"
                          className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white placeholder:text-zinc-500"
                          value={row.youtubeChannelId}
                          onChange={(e) => {
                            const next = [...importRows];
                            next[i] = { ...next[i], youtubeChannelId: e.target.value };
                            setImportRows(next);
                          }} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input placeholder="email@gmail.com"
                          className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-sm text-white placeholder:text-zinc-500"
                          value={row.gmail}
                          onChange={(e) => {
                            const next = [...importRows];
                            next[i] = { ...next[i], gmail: e.target.value };
                            setImportRows(next);
                          }} />
                      </td>
                      <td className="px-2 py-1.5">
                        {importRows.length > 1 && (
                          <button onClick={() => setImportRows(importRows.filter((_, j) => j !== i))}
                            className="text-zinc-600 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setImportRows([...importRows, { tiktokUsername: "", channelName: "", youtubeChannelId: "", gmail: "" }])}
                className="text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-zinc-700 rounded-lg px-4 py-1.5">+ Add Row</button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{importRows.filter(r => r.tiktokUsername && r.channelName && r.youtubeChannelId && r.gmail).length} ready</span>
                <button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
                  <Upload size={14} /> Import All {importRows.filter(r => r.tiktokUsername && r.channelName && r.youtubeChannelId && r.gmail).length} Channels
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`mb-4 ${feedback.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"} border rounded-lg px-4 py-3 text-sm flex items-center gap-2`}>
          {feedback.type === "success" ? <Check size={16} /> : <X size={16} />} {feedback.msg}
          <button onClick={() => setFeedback(null)} className="ml-auto hover:text-white"><X size={14} /></button>
        </div>
      )}

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              {["Channel", "Source", "Workspace", "Today", "Schedule", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs text-zinc-600 font-medium px-3 py-2.5 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-zinc-500 py-12 text-sm">No channels found. Import a channel to get started.</td></tr>
            ) : filtered.map((ch) => {
              const src = sourceMap.get(ch.id);
              const sched = scheduleMap.get(ch.id);
              const schTimes = safeJson(sched?.uploadTimes);
              const qCount = 0;
              const todayCount = ch.uploadsToday || 0;
              const maxPerDay = parseInt(sched?.maxVideosPerDay || "3");
              const ws = workspaces.find(w => w.id === ch.workspaceId);
              const isExpanded = expandedRows.has(ch.id);
              return (
                <tr key={ch.id} className="border-b border-[#2a2a2a] hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleRow(ch.id)} className="text-zinc-600 hover:text-zinc-400">
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <div>
                        <p className="text-sm text-white font-medium">{ch.channelName || "Unnamed"}</p>
                        <p className="text-xs text-zinc-600 font-mono">{ch.youtubeChannelId || ch.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {src ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">🎵</span>
                        <span className="text-xs text-zinc-400">{src.accountHandle || src.platform}</span>
                      </div>
                    ) : <span className="text-xs text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-zinc-400">{ws?.email || ch.workspaceEmail || ch.workspaceId?.slice(0, 8) || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-zinc-400">{todayCount}/{maxPerDay}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {sched ? (
                      <div className="text-xs text-zinc-500">
                        <span>{schTimes.length}x/day</span>
                        {schTimes.length > 0 && <p className="text-zinc-600">{schTimes.map(formatTime12).join(", ")}</p>}
                      </div>
                    ) : <span className="text-xs text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${ch.authStatus === "authorized" ? "text-green-500" : ch.authStatus === "expired" ? "text-red-400" : "text-amber-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ch.authStatus === "authorized" ? "bg-green-500" : ch.authStatus === "expired" ? "bg-red-400" : "bg-amber-500"}`} />
                      {ch.authStatus === "authorized" ? "Live" : ch.authStatus === "expired" ? "GCP Expired" : ch.authStatus || "Setup"}
                    </span>
                    {ch.authStatus === "expired" && (
                      <p className="text-[10px] text-red-400/60 mt-0.5">Go to Workspaces → Upload new GCP → Re-authorize</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      {ch.gcpCredentialId ? (
                        ch.authStatus !== "authorized" && (
                          <>
                            <button onClick={() => { api.get<any>(`/channels/${ch.id}/authorize`).then((r) => { if (r.redirectUrl) window.open(r.redirectUrl, '_blank', 'width=600,height=700'); else alert('No redirect URL returned'); }).catch((e) => alert(`Auth failed: ${e.message}`)); }}
                              className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded hover:bg-indigo-500/20">Auth</button>
                            <button onClick={() => { api.get<any>(`/channels/${ch.id}/authorize`).then((r) => { if (r.redirectUrl) { navigator.clipboard.writeText(r.redirectUrl); setCopiedId(ch.id); setTimeout(() => setCopiedId(null), 2000); } else alert('No redirect URL returned'); }).catch((e) => alert(`Copy failed: ${e.message}`)); }}
                              className="text-xs bg-zinc-500/10 text-zinc-400 px-2 py-0.5 rounded hover:bg-zinc-500/20 flex items-center gap-1">
                              {copiedId === ch.id ? <Check size={10} /> : <Copy size={10} />}
                              {copiedId === ch.id ? "Copied" : "Copy Link"}
                            </button>
                          </>
                        )
                      ) : (
                        ch.authStatus !== "authorized" && <span className="text-xs text-zinc-600">Assign GCP first</span>
                      )}
                      <button onClick={() => { if (window.confirm(`Delete channel "${ch.channelName}"?`)) deleteMutation.mutate(ch.id); }} className="text-zinc-600 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    <AutoRefillModal 
      isOpen={showAutoRefill} 
      onClose={() => setShowAutoRefill(false)} 
      gmailFilter={autoRefillGmailFilter} 
      setGmailFilter={setAutoRefillGmailFilter}
      channels={channels} 
      sources={sources} 
      workspaces={workspaces} 
    />
    </>
  );
}
