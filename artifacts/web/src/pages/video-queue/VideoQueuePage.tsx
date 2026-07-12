import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Trash2, Upload, Sparkles, X, Search, Download, Eye, Settings } from "lucide-react";
import api from "../../lib/api";
import { getStatusColor, formatRelativeTime } from "../../lib/utils";
import type { VideoQueueItem, Channel, Source } from "../../types";

function SeoModal({ video, channels, sources, onClose }: { video: VideoQueueItem; channels: Channel[]; sources: Source[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(video.title || "");
  const [description, setDescription] = useState(video.description || "");
  const [tagsText, setTagsText] = useState((video.tags || []).join(", "));
  const [category, setCategory] = useState(video.category || "Entertainment");
  const [targetChannelId, setTargetChannelId] = useState(video.targetChannelId || "");
  const [generating, setGenerating] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/queue/${video.id}`, { title, description, tags: tagsText.split(",").map(t => t.trim()).filter(Boolean), category, targetChannelId: targetChannelId || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["queue"] }); onClose(); },
  });

  const approveAndUpload = useMutation({
    mutationFn: async () => {
      await api.patch(`/queue/${video.id}`, { title, description, tags: tagsText.split(",").map(t => t.trim()).filter(Boolean), category, targetChannelId: targetChannelId || undefined });
      await api.post(`/queue/${video.id}/upload-now`);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["queue"] }); onClose(); },
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const updated = await api.post<any>(`/queue/${video.id}/generate-seo`);
      setTitle(updated.title || "");
      setDescription(updated.description || "");
      setTagsText((updated.tags || []).join(", "));
      setCategory(updated.category || "Entertainment");
    } catch (err) {
      console.error("SEO generation failed:", err);
    }
    setGenerating(false);
  };

  const categories = ["Entertainment", "Education", "Music", "Gaming", "Comedy", "Howto & Style", "People & Blogs", "Science & Technology", "Sports", "News & Politics"];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">SEO Preview & Edit</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">Target Channel</label>
            <select value={targetChannelId} onChange={(e) => setTargetChannelId(e.target.value)} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white">
              <option value="">Select a channel to upload to</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.channelName || ch.youtubeChannelId || ch.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500" maxLength={100} />
            <p className="text-xs text-zinc-600 mt-1">{title.length}/100</p>
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none" maxLength={5000} />
            <p className="text-xs text-zinc-600 mt-1">{description.length}/5000</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 font-medium mb-1 block">Tags (comma-separated)</label>
              <textarea value={tagsText} onChange={(e) => setTagsText(e.target.value)} rows={3} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium mb-1 block">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white">
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a]">
            <button onClick={handleGenerate} disabled={generating} className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50">
              <Sparkles size={14} /> {generating ? "Generating..." : "Generate with AI"}
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-300 hover:text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Save</button>
              <button onClick={() => approveAndUpload.mutate()} disabled={approveAndUpload.isPending || !targetChannelId} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                <Upload size={14} /> Approve & Upload
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourcePreviews({ sources }: { sources: Source[] }) {
  const [videoData, setVideoData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const result: Record<string, any[]> = {};
      for (const src of sources) {
        if (cancelled) return;
        const prevSrc = result[Object.keys(result)[Object.keys(result).length - 1] ?? ""];
        if (prevSrc !== undefined) await new Promise(r => setTimeout(r, 1500));
        try {
          const vids = await api.get<any[]>(`/sources/${src.id}/videos`);
          if (!cancelled) result[src.id] = vids;
        } catch {
          // skip failed sources silently
        }
        if (!cancelled) setVideoData({ ...result });
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sources]);

  if (loading) {
    return <p className="text-xs text-zinc-500 text-center py-2">Loading previews...</p>;
  }

  return (
    <>
      {sources.map(src => {
        const vids = videoData[src.id];
        if (!vids?.length) return null;
        return (
          <div key={src.id}>
            <label className="text-xs text-zinc-500 font-medium mb-2 block">Preview — {src.accountHandle || src.accountUrl || src.platform}</label>
            <div className="grid grid-cols-4 gap-2">
              {vids.slice(0, 4).map((v: any) => (
                <div key={v.id} className="rounded-lg overflow-hidden border border-[#2a2a2a]">
                  <img src={v.coverUrl} alt={v.title} className="w-full aspect-[9/16] object-cover" />
                  <div className="p-1">
                    <p className="text-[10px] text-white truncate">{v.likeCount?.toLocaleString() || 0} ❤</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function AutoRefillModal({ sources, channels: allCh, workspaces, onClose }: { sources: Source[]; channels: Channel[]; workspaces: any[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [gmailFilter, setGmailFilter] = useState("all");

  const wsMap = useMemo(() => new Map(workspaces.map((w: any) => [w.id, w])), [workspaces]);
  const chMap = useMemo(() => new Map(allCh.map(c => [c.id, c])), [allCh]);

  const isAllChannels = gmailFilter === "all";

  const wsSources = useMemo(() => {
    if (isAllChannels) return sources;
    const wsChannelIds = new Set(allCh.filter(c => c.workspaceId === gmailFilter).map(c => c.id));
    return sources.filter(s => s.linkedChannelId && wsChannelIds.has(s.linkedChannelId));
  }, [sources, gmailFilter, allCh, isAllChannels]);

  const [autoRefillEnabled, setAutoRefillEnabled] = useState(false);
  const [sortBy, setSortBy] = useState<string>("all");
  const [minViews, setMinViews] = useState(500);
  const [maxAge, setMaxAge] = useState(10);

  // Load saved settings when sources list changes
  useEffect(() => {
    const f = wsSources[0] ? ((wsSources[0] as any).contentFilter || {}) : {};
    setAutoRefillEnabled(f.autoRefillEnabled ?? false);
    setSortBy(f.sortBy ?? "all");
    setMinViews(Math.max(f.minViews ?? 500, 500));
    setMaxAge(f.maxAge ?? 10);
  }, [wsSources]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isAllChannels) {
        await api.post("/channels/auto-refill/bulk", {
          enabled: autoRefillEnabled,
          sortBy,
          minViews,
          maxAge,
        });
      } else {
        await Promise.all(wsSources.map(s =>
          api.patch(`/sources/${s.id}`, {
            contentFilter: { autoRefillEnabled, sortBy, minViews, maxAge },
          })
        ));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.refetchQueries({ queryKey: ["sources"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Auto-Refill Settings</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 font-medium mb-1 block">Apply To</label>
            <select value={gmailFilter} onChange={(e) => setGmailFilter(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white">
              <option value="all">All Channels</option>
              {workspaces.map((w: any) => (
                <option key={w.id} value={w.id}>{w.email || w.name || w.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>

          {wsSources.length > 0 ? (
            <>
              <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-1">
                  {isAllChannels ? `All ${sources.length} source(s) across all channels:` : `${wsSources.length} source(s) under this Gmail:`}
                </div>
                {wsSources.slice(0, 5).map(s => {
                  const sc = s.linkedChannelId ? chMap.get(s.linkedChannelId) : null;
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

              <SourcePreviews sources={wsSources} />
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
            {saveMutation.isPending ? "Saving..." : "Save Settings to All Sources"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VideoQueuePage() {
  const queryClient = useQueryClient();
  const [filterTab, setFilterTab] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [seoVideo, setSeoVideo] = useState<VideoQueueItem | null>(null);
  const [showAutoRefill, setShowAutoRefill] = useState(false);

  const { data: queue = [] } = useQuery<VideoQueueItem[]>({
    queryKey: ["queue"],
    queryFn: () => api.get("/queue"),
    refetchInterval: 10000,
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ["sources"],
    queryFn: () => api.get("/sources"),
  });

  const { data: workspaces = [] } = useQuery<any[]>({
    queryKey: ["workspaces"],
    queryFn: () => api.get("/workspaces"),
  });

  const sourceMap = useMemo(() => {
    const m = new Map<string, Source>();
    for (const s of sources) m.set(s.id, s);
    return m;
  }, [sources]);

  const channelMap = useMemo(() => {
    const m = new Map<string, Channel>();
    for (const c of channels) m.set(c.id, c);
    return m;
  }, [channels]);

  const filtered = useMemo(() => {
    let items = queue;
    if (filterTab === "queued") items = items.filter(v => v.status === "pending" || v.status === "processing");
    else if (filterTab === "uploaded") items = items.filter(v => v.status === "uploaded");
    else if (filterTab === "failed") items = items.filter(v => v.status === "failed");
    else if (filterTab === "blocked") items = items.filter(v => v.status === "blocked");
    // else — show all items including uploaded
    if (channelFilter !== "all") items = items.filter(v => v.targetChannelId === channelFilter);
    if (searchQ) items = items.filter(v => v.title?.toLowerCase().includes(searchQ.toLowerCase()));
    return items;
  }, [queue, filterTab, channelFilter, searchQ]);

  const uploadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/queue/${id}/upload-now`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queue"] }),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/queue/${id}/retry`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queue"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/queue/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queue"] }),
  });

  const ytDeleteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/queue/${id}/youtube-delete`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queue"] }),
  });

  const queuedCount = queue.filter(v => v.status === "pending" || v.status === "processing").length;
  const uploadedCount = queue.filter(v => v.status === "uploaded").length;
  const blockedCount = queue.filter(v => v.status === "blocked").length;

  const getChannelName = (chId?: string) => {
    if (!chId) return "-";
    const ch = channelMap.get(chId);
    return ch?.channelName || ch?.youtubeChannelId || chId.slice(0, 8) || "-";
  };

  const getSourceHandle = (srcId?: string) => {
    if (!srcId) return "—";
    const src = sourceMap.get(srcId);
    return src?.accountHandle || src?.accountUrl?.replace(/^@/, "") || src?.platform || "—";
  };

  return (
    <div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">Video Queue</h1>
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => setFilterTab("queued")} className={`px-3 py-1 rounded-md ${filterTab === "queued" ? "bg-indigo-500/10 text-indigo-400" : "text-zinc-500 hover:text-white"}`}>
              Queued <span className="text-zinc-600">({queuedCount})</span>
            </button>
            <button onClick={() => setFilterTab("uploaded")} className={`px-3 py-1 rounded-md ${filterTab === "uploaded" ? "bg-indigo-500/10 text-indigo-400" : "text-zinc-500 hover:text-white"}`}>
              Uploaded <span className="text-zinc-600">({uploadedCount})</span>
            </button>
            <button onClick={() => setFilterTab("failed")} className={`px-3 py-1 rounded-md ${filterTab === "failed" ? "bg-indigo-500/10 text-indigo-400" : "text-zinc-500 hover:text-white"}`}>
              Failed <span className="text-zinc-600">({queue.filter(v => v.status === "failed").length})</span>
            </button>
            {blockedCount > 0 && (
              <button onClick={() => setFilterTab("blocked")} className={`px-3 py-1 rounded-md ${filterTab === "blocked" ? "bg-red-500/10 text-red-400" : "text-red-500/70 hover:text-red-400"}`}>
                Blocked <span className="text-red-500/50">({blockedCount})</span>
              </button>
            )}
            <button onClick={() => setFilterTab("all")} className={`px-3 py-1 rounded-md ${filterTab === "all" ? "bg-indigo-500/10 text-indigo-400" : "text-zinc-500 hover:text-white"}`}>
              All <span className="text-zinc-600">({queue.length})</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input className="w-44 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none" placeholder="Search..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
          </div>
          <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-xs text-white">
            <option value="all">All Channels</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.channelName || ch.youtubeChannelId || ch.id.slice(0, 8)}</option>
            ))}
          </select>
          <button onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL || "/api"}/analytics/videos/csv`, "_blank")} className="bg-[#1a1a1a] border border-[#2a2a2a] text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1">
            <Download size={12} /> CSV
          </button>
          <button onClick={() => setShowAutoRefill(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1">
            <Settings size={12} /> Auto-Refill
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              {["Video", "Source", "Channel", "Views", "Likes", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs text-zinc-600 font-medium px-3 py-2.5 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-zinc-500 py-12 text-sm">No videos in queue.</td></tr>
            ) : filtered.map((video) => {
              const isUploaded = video.status === "uploaded";
              const isPending = video.status === "pending";
              const isFailed = video.status === "failed";
              const isBlocked = video.status === "blocked";
              const srcHandle = getSourceHandle(video.sourceId);
              const chName = getChannelName(video.targetChannelId);
              const sourceIcon = video.sourcePlatform === "tiktok" ? "🎵" : "🌐";
              return (
                <tr key={video.id} className="border-b border-[#2a2a2a] hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-[56px] rounded bg-[#0f0f0f] border border-[#2a2a2a] flex items-center justify-center text-xs text-zinc-600 flex-shrink-0 overflow-hidden">
                        {video.youtubeVideoId ? <Eye size={16} className="text-green-500" /> : <Play size={14} className="text-zinc-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate max-w-[300px]">{video.title || "Untitled"}</p>
                        <p className="text-xs text-zinc-600">{video.sourcePlatform || "manual"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{sourceIcon}</span>
                      <span className="text-xs text-zinc-400">{srcHandle}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-zinc-400">{chName}</td>
                  <td className="px-3 py-2.5 text-xs text-zinc-400">
                    {video.status === "uploaded"
                      ? (video.ytViews != null && video.ytViews > 0 ? (video.ytViews >= 1000 ? `${(video.ytViews / 1000).toFixed(1)}K` : video.ytViews) : "—")
                      : (video.srcViews != null && video.srcViews > 0 ? (video.srcViews >= 1000 ? `${(video.srcViews / 1000).toFixed(1)}K` : video.srcViews) : "—")}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-zinc-400">
                    {video.status === "uploaded"
                      ? (video.ytLikes != null && video.ytLikes > 0 ? video.ytLikes : "—")
                      : (video.srcLikes != null && video.srcLikes > 0 ? video.srcLikes : "—")}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {isPending && (
                        <>
                          <button onClick={() => setSeoVideo(video)} className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded hover:bg-indigo-500/20">Source</button>
                          <button onClick={() => uploadMutation.mutate(video.id)} className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded hover:bg-green-500/20">Upload</button>
                          <button onClick={() => { if (window.confirm("Skip this video?")) deleteMutation.mutate(video.id); }} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded hover:bg-red-500/20">Skip</button>
                          <button onClick={() => { if (window.confirm("Delete this video?")) deleteMutation.mutate(video.id); }} className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/20"><Trash2 size={12} /></button>
                        </>
                      )}
                      {isUploaded && (
                        <>
                          <span className="text-xs text-green-500">Uploaded ✓</span>
                          <button onClick={() => { if (window.confirm("Remove from queue?")) deleteMutation.mutate(video.id); }} className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/20"><Trash2 size={12} /></button>
                          <button onClick={() => {
                            if (window.confirm("Are you sure? This will permanently delete the video from YouTube.")) {
                              ytDeleteMutation.mutate(video.id);
                            }
                          }} className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded hover:bg-orange-500/20">YT Delete</button>
                        </>
                      )}
                      {isFailed && (
                        <>
                          <button onClick={() => retryMutation.mutate(video.id)} className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded hover:bg-amber-500/20">Retry</button>
                          <button onClick={() => { if (window.confirm("Delete this failed video?")) deleteMutation.mutate(video.id); }} className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/20"><Trash2 size={12} /></button>
                        </>
                      )}
                      {isBlocked && (
                        <>
                          <span className="text-xs text-red-400 font-medium">Blocked (GCP)</span>
                          <button onClick={() => retryMutation.mutate(video.id)} className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded hover:bg-amber-500/20">Retry</button>
                          <button onClick={() => { if (window.confirm("Delete this blocked video?")) deleteMutation.mutate(video.id); }} className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/20"><Trash2 size={12} /></button>
                        </>
                      )}
                      {!isUploaded && !isFailed && !isPending && !isBlocked && (
                        <button onClick={() => { if (window.confirm("Delete this video?")) deleteMutation.mutate(video.id); }} className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/20"><Trash2 size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {seoVideo && <SeoModal video={seoVideo} channels={channels} sources={sources} onClose={() => setSeoVideo(null)} />}
      {showAutoRefill && <AutoRefillModal sources={sources} channels={channels} workspaces={workspaces} onClose={() => setShowAutoRefill(false)} />}
    </div>
  );
}
