import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, TrendingUp, Eye, ThumbsUp, MessageSquare, Upload, ShieldAlert,
  Tv, Video, Database, Clock, Search, Download, CheckCheck, Reply, ExternalLink,
  ChevronDown, Filter, AlertTriangle, Globe, CheckCircle, XCircle, FileText
} from "lucide-react";
import api from "../../lib/api";
import type {
  AnalyticsMetrics, AnalyticsChannel, AnalyticsVideo, AnalyticsSource,
  AnalyticsHistoryItem, AnalyticsComment, CopyrightData
} from "../../types";

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "channels", label: "Channels", icon: Tv },
  { key: "videos", label: "Videos", icon: Video },
  { key: "sources", label: "Sources", icon: Database },
  { key: "history", label: "History", icon: Clock },
  { key: "comments", label: "Comments", icon: MessageSquare },
  { key: "copyright", label: "Copyright", icon: ShieldAlert },
];

const PERIODS = ["7d", "30d", "90d", "all"] as const;
type Period = typeof PERIODS[number];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [period, setPeriod] = useState<Period>("7d");
  const [channelId, setChannelId] = useState<string>("");
  const [copyrightFilter, setCopyrightFilter] = useState("all");
  const [commentFilter, setCommentFilter] = useState("all");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const queryClient = useQueryClient();

  const periodParam = `period=${period}`;
  const channelParam = channelId ? `&channelId=${channelId}` : "";

  const { data: overview } = useQuery<AnalyticsMetrics>({
    queryKey: ["analytics", "overview", period, channelId],
    queryFn: () => api.get(`/analytics/overview?${periodParam}${channelParam}`),
  });

  const { data: channels } = useQuery<AnalyticsChannel[]>({
    queryKey: ["analytics", "channels", period],
    queryFn: () => api.get(`/analytics/channels?${periodParam}`),
  });

  const { data: videos } = useQuery<AnalyticsVideo[]>({
    queryKey: ["analytics", "videos", period, channelId, copyrightFilter],
    queryFn: () => api.get(`/analytics/videos?${periodParam}${channelParam}&copyright=${copyrightFilter}`),
  });

  const { data: sources } = useQuery<AnalyticsSource[]>({
    queryKey: ["analytics", "sources", period],
    queryFn: () => api.get(`/analytics/sources?${periodParam}`),
  });

  const { data: history } = useQuery<{ total: number; items: AnalyticsHistoryItem[] }>({
    queryKey: ["analytics", "history", period, channelId],
    queryFn: () => api.get(`/analytics/history?${periodParam}${channelParam}`),
  });

  const { data: comments } = useQuery<AnalyticsComment[]>({
    queryKey: ["analytics", "comments", period, channelId, commentFilter],
    queryFn: () => api.get(`/analytics/comments?${periodParam}${channelParam}&filter=${commentFilter}`),
  });

  const { data: copyright } = useQuery<CopyrightData>({
    queryKey: ["analytics", "copyright", period, channelId, issuesOnly],
    queryFn: () => api.get(`/analytics/copyright?${periodParam}${channelParam}&issuesOnly=${issuesOnly}`),
  });

  const exportCsv = async () => {
    const token = localStorage.getItem("vf_token") || "";
    const base = import.meta.env.VITE_API_BASE_URL || "/api";
    window.open(`${base}/analytics/videos/csv?${periodParam}${channelParam}&token=${token}`, "_blank");
  };

  const handleChannelClick = (id: string) => {
    setChannelId(channelId === id ? "" : id);
  };

  const handleMarkAllRead = async () => {
    await api.post("/analytics/comments/mark-read");
    queryClient.invalidateQueries({ queryKey: ["analytics", "comments"] });
  };

  const handleReply = async (commentId: string) => {
    const text = prompt("Enter your reply:");
    if (!text) return;
    await api.post(`/analytics/comments/${commentId}/reply`, { replyText: text });
    queryClient.invalidateQueries({ queryKey: ["analytics", "comments"] });
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text" placeholder="Search..." className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 w-48"
              />
            </div>
            <div className="flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-2 text-xs font-medium transition ${period === p ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                  {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : p === "90d" ? "90 Days" : "All Time"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === tab.key ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white hover:bg-[#2a2a2a]"}`}>
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {channelId && (
          <div className="flex items-center gap-2 mb-4 text-sm text-zinc-400">
            <span>Filtered by channel:</span>
            <button onClick={() => setChannelId("")} className="text-blue-400 hover:text-blue-300 underline">Clear filter</button>
          </div>
        )}

        {activeTab === "overview" && <OverviewTab data={overview} channels={channels} />}
        {activeTab === "channels" && <ChannelsTab data={channels} onChannelClick={handleChannelClick} activeChannelId={channelId} />}
        {activeTab === "videos" && (
          <VideosTab
            data={videos} copyrightFilter={copyrightFilter} setCopyrightFilter={setCopyrightFilter} onExportCsv={exportCsv}
          />
        )}
        {activeTab === "sources" && <SourcesTab data={sources} />}
        {activeTab === "history" && <HistoryTab data={history} />}
        {activeTab === "comments" && (
          <CommentsTab data={comments} filter={commentFilter} setFilter={setCommentFilter} onMarkAllRead={handleMarkAllRead} onReply={handleReply} />
        )}
        {activeTab === "copyright" && <CopyrightTab data={copyright} issuesOnly={issuesOnly} setIssuesOnly={setIssuesOnly} />}
      </div>
    </div>
  );
}

function MetricCard({ label, value, change, icon: Icon, color }: { label: string; value: string | number; change?: string; icon: any; color: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-zinc-400">{label}</span>
        <Icon size={16} className={color} />
      </div>
      <div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {change && <div className={`text-xs font-medium mt-1 ${change.startsWith("-") ? "text-red-400" : "text-green-500"}`}>{change} vs prev period</div>}
    </div>
  );
}

function OverviewTab({ data, channels }: { data?: AnalyticsMetrics; channels?: AnalyticsChannel[] }) {
  if (!data) return <div className="text-zinc-500 text-center py-12">Loading...</div>;

  const metrics = [
    { label: "Total Views", value: data.totalViews, change: data.viewsChange, icon: Eye, color: "text-blue-400" },
    { label: "Total Likes", value: data.totalLikes, change: data.likesChange, icon: ThumbsUp, color: "text-green-400" },
    { label: "Comments", value: data.totalComments, icon: MessageSquare, color: "text-violet-400" },
    { label: "Subs Gained", value: `+${data.subsGained}`, icon: TrendingUp, color: "text-amber-400" },
    { label: "Uploads", value: data.totalUploads, icon: Upload, color: "text-cyan-400" },
    { label: "© Issues", value: data.copyrightIssues, icon: ShieldAlert, color: "text-rose-400" },
  ];

  const maxViewTrend = Math.max(...data.viewsTrend.map(v => v.views), 1);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 col-span-2">
          <h3 className="text-white font-semibold mb-4">Views Trend</h3>
          <div className="flex items-end gap-1 h-32">
            {data.viewsTrend.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-zinc-500">{v.views > 999 ? `${(v.views / 1000).toFixed(1)}K` : v.views}</span>
                <div className="w-full bg-blue-500/20 rounded-t" style={{ height: `${(v.views / maxViewTrend) * 100}%`, minHeight: v.views > 0 ? "4px" : "1px" }}>
                  <div className="w-full bg-blue-500 rounded-t h-full opacity-70" />
                </div>
                <span className="text-[10px] text-zinc-600">{new Date(v.date).getDate()}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-zinc-600">
            <span>Fri</span><span>Mon</span><span>Thu</span><span>Sun</span><span>Wed</span><span>Sat</span><span>Tue</span>
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3">Trending Sources ({periodLabel(data.viewsTrend.length)})</h3>
          <div className="space-y-2">
            {data.trendingSources.slice(0, 5).map((src: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-zinc-500 w-5 text-xs">#{i + 1}</span>
                  <span className="truncate">🎵 {src.handle}</span>
                </div>
                <div className="text-right text-xs text-zinc-400 shrink-0 ml-2">
                  <div>{src.videos} videos</div>
                  <div>{src.ytViews} YT views</div>
                </div>
              </div>
            ))}
            {data.trendingSources.length === 0 && <p className="text-xs text-zinc-500">No sources yet</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3">Trending Videos (Top 5)</h3>
          <div className="space-y-2">
            {data.trendingVideos.map((v: any, i: number) => (
              <div key={v.id} className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-zinc-500 text-xs w-4">#{i + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate text-zinc-200 max-w-[280px]">{v.title}</div>
                    <div className="text-[11px] text-zinc-500">🎵 • {v.channel}</div>
                  </div>
                </div>
                <div className="text-right text-xs shrink-0 ml-2">
                  <div className="text-blue-400">{v.ytViews >= 1000 ? `${(v.ytViews / 1000).toFixed(1)}K` : v.ytViews} views</div>
                  <div className="text-zinc-500">{v.ytLikes} likes</div>
                </div>
              </div>
            ))}
            {data.trendingVideos.length === 0 && <p className="text-xs text-zinc-500">No trending videos yet</p>}
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3">Subscriber Growth</h3>
          <div className="space-y-2">
            {data.subscriberGrowth.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300 truncate">{s.channelName}</span>
                <span className={`font-medium ${s.subs > 0 ? "text-green-400" : "text-zinc-500"}`}>{s.subs > 0 ? `+${s.subs}` : `${s.subs}`}</span>
              </div>
            ))}
            {data.subscriberGrowth.length === 0 && <p className="text-xs text-zinc-500">No channels yet</p>}
          </div>
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-white font-semibold mb-2">Best Upload Times</h3>
        <p className="text-xs text-zinc-500 mb-3">Analyzed {data.totalUploadsAnalyzed} uploads</p>
        {data.bestTime && <p className="text-sm text-green-400 mb-3">{data.bestTime}</p>}
        <div>
          <div className="flex text-[10px] text-zinc-600 mb-1 ml-8">
            {[0, 3, 6, 9, 12, 15, 18, 21].map(h => <div key={h} className="flex-1 text-center">{h}:00</div>)}
          </div>
          {dayNames.map(day => (
            <div key={day} className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] text-zinc-500 w-7">{day}</span>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map(hour => {
                const cell = data.bestUploadTimes.find((b: any) => b.day === day && b.hour === hour);
                const max = Math.max(...data.bestUploadTimes.map((b: any) => b.avgViews), 1);
                const intensity = cell ? (cell.avgViews / max) : 0;
                return (
                  <div key={`${day}-${hour}`} className="flex-1 h-4 rounded-sm" style={{
                    backgroundColor: intensity > 0.7 ? "#166534" : intensity > 0.4 ? "#14532d" : intensity > 0.1 ? "#0f172a" : "#1a1a1a",
                    border: "1px solid #2a2a2a",
                  }} title={cell ? `${day} ${hour}:00 - ${cell.avgViews.toLocaleString()} avg views` : ""} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function periodLabel(days: number) {
  if (days <= 7) return "7 days";
  if (days <= 30) return "30 days";
  return "90 days";
}

function ChannelsTab({ data, onChannelClick, activeChannelId }: { data?: AnalyticsChannel[]; onChannelClick: (id: string) => void; activeChannelId: string }) {
  if (!data) return <div className="text-zinc-500 text-center py-12">Loading...</div>;

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2a2a] text-zinc-400 text-left">
            <th className="p-4 font-medium">Channel</th>
            <th className="p-4 font-medium">Views ▼</th>
            <th className="p-4 font-medium">Likes</th>
            <th className="p-4 font-medium">Comments</th>
            <th className="p-4 font-medium">Subs</th>
            <th className="p-4 font-medium">Uploads</th>
            <th className="p-4 font-medium">©</th>
          </tr>
        </thead>
        <tbody>
          {data.map((ch) => (
            <tr key={ch.id} onClick={() => onChannelClick(ch.id)} className={`border-b border-[#2a2a2a] cursor-pointer transition hover:bg-[#252525] ${activeChannelId === ch.id ? "bg-blue-600/10 border-l-2 border-l-blue-500" : ""}`}>
              <td className="p-4">
                <div className="font-medium text-white">{ch.channelName}</div>
                <div className="text-xs text-zinc-500">🎵 {ch.sourceHandle} • {ch.email}</div>
              </td>
              <td className="p-4 text-white">{ch.views >= 1000 ? `${(ch.views / 1000).toFixed(1)}K` : ch.views}</td>
              <td className="p-4 text-zinc-300">{ch.likes}</td>
              <td className="p-4 text-zinc-300">{ch.comments}</td>
              <td className="p-4 text-zinc-300">{ch.subs > 0 ? `+${ch.subs}` : ch.subs}</td>
              <td className="p-4 text-zinc-300">{ch.uploads}</td>
              <td className="p-4">{ch.copyrightIssues > 0 ? <span className="text-rose-400">⚠️ {ch.copyrightIssues}</span> : <span className="text-green-500">✅</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VideosTab({ data, copyrightFilter, setCopyrightFilter, onExportCsv }: { data?: AnalyticsVideo[]; copyrightFilter: string; setCopyrightFilter: (v: string) => void; onExportCsv: () => void }) {
  if (!data) return <div className="text-zinc-500 text-center py-12">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <select value={copyrightFilter} onChange={(e) => setCopyrightFilter(e.target.value)} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-9 pr-8 py-2 text-sm text-white appearance-none focus:outline-none focus:border-zinc-600">
              <option value="all">All Copyright</option>
              <option value="clean">Clean Only</option>
              <option value="issues">Issues Only</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>
        <button onClick={onExportCsv} className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-zinc-300 hover:text-white hover:border-zinc-600 transition">
          <Download size={16} /> Export CSV
        </button>
      </div>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a] text-zinc-400 text-left">
              <th className="p-4 font-medium">Video</th>
              <th className="p-4 font-medium">Channel</th>
              <th className="p-4 font-medium">Src Views</th>
              <th className="p-4 font-medium">YT Views ▼</th>
              <th className="p-4 font-medium">Likes</th>
              <th className="p-4 font-medium">Comm</th>
              <th className="p-4 font-medium">Subs</th>
              <th className="p-4 font-medium">Conv %</th>
              <th className="p-4 font-medium">Health</th>
              <th className="p-4 font-medium">©</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((v) => (
              <tr key={v.id} className="border-b border-[#2a2a2a] hover:bg-[#252525] transition">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" className="w-10 h-14 rounded object-cover bg-zinc-800" />}
                    <div className="min-w-0">
                      <div className="truncate max-w-[200px] text-white">{v.title}</div>
                      <div className="text-[11px] text-zinc-500">🎵 • {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-zinc-300">{v.channelName}</td>
                <td className="p-4 text-zinc-500">{v.srcViews || "—"}</td>
                <td className="p-4 text-blue-400 font-medium">{v.ytViews >= 1000 ? `${(v.ytViews / 1000).toFixed(1)}K` : v.ytViews}</td>
                <td className="p-4 text-zinc-300">{v.ytLikes}</td>
                <td className="p-4 text-zinc-300">{v.ytComments}</td>
                <td className="p-4 text-zinc-300">{v.ytSubsGained > 0 ? `+${v.ytSubsGained}` : v.ytSubsGained}</td>
                <td className="p-4 text-zinc-300">{v.conversionRate}%</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${v.healthScore >= 80 ? "bg-green-900/50 text-green-400" : v.healthScore >= 50 ? "bg-yellow-900/50 text-yellow-400" : "bg-red-900/50 text-red-400"}`}>{v.healthScore}</span>
                </td>
                <td className="p-4">
                  {v.copyrightStatus === "clean" ? <span className="text-green-500" title="Clean">✅</span>
                    : v.copyrightStatus === "claimed" ? <span className="text-yellow-500" title="Claimed">⚠️</span>
                    : v.copyrightStatus === "blocked" ? <span className="text-red-500" title="Blocked">❌</span>
                    : v.copyrightStatus === "restricted" ? <span className="text-orange-500" title="Restricted">🌍</span>
                    : <span className="text-green-500">✅</span>}
                </td>
                <td className="p-4">
                  {v.youtubeVideoId && (
                    <a href={`https://youtu.be/${v.youtubeVideoId}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      <ExternalLink size={16} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourcesTab({ data }: { data?: AnalyticsSource[] }) {
  if (!data) return <div className="text-zinc-500 text-center py-12">Loading...</div>;

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#2a2a2a]">
        <h3 className="text-white font-semibold">Source Account Performance</h3>
        <p className="text-xs text-zinc-500">Which source accounts produce the best content</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2a2a] text-zinc-400 text-left">
            <th className="p-4 font-medium w-10">#</th>
            <th className="p-4 font-medium">Source</th>
            <th className="p-4 font-medium">Platform</th>
            <th className="p-4 font-medium">Videos</th>
            <th className="p-4 font-medium">Src Views</th>
            <th className="p-4 font-medium">YT Views</th>
            <th className="p-4 font-medium">Best Video</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s) => (
            <tr key={s.rank} className="border-b border-[#2a2a2a] hover:bg-[#252525] transition">
              <td className="p-4 text-zinc-500">#{s.rank}</td>
              <td className="p-4">🎵 <span className="text-white">@{s.handle}</span></td>
              <td className="p-4 text-zinc-300">{s.platform}</td>
              <td className="p-4 text-zinc-300">{s.videos}</td>
              <td className="p-4 text-zinc-300">{s.srcViews >= 1000 ? `${(s.srcViews / 1000).toFixed(1)}K` : s.srcViews}</td>
              <td className="p-4 text-blue-400">{s.ytViews >= 1000 ? `${(s.ytViews / 1000).toFixed(1)}K` : s.ytViews}</td>
              <td className="p-4 text-zinc-400 text-xs">
                {s.bestVideoYoutubeId ? (
                  <a href={`https://youtu.be/${s.bestVideoYoutubeId}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                    {s.bestVideoViews >= 1000 ? `${(s.bestVideoViews / 1000).toFixed(1)}K` : s.bestVideoViews} views ↗
                  </a>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab({ data }: { data?: { total: number; items: AnalyticsHistoryItem[] } }) {
  if (!data) return <div className="text-zinc-500 text-center py-12">Loading...</div>;

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#2a2a2a] text-sm text-zinc-400">
        Upload History <span className="text-white font-medium">{data.total}</span> total uploads
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2a2a] text-zinc-400 text-left">
            <th className="p-4 font-medium">Video</th>
            <th className="p-4 font-medium">Channel</th>
            <th className="p-4 font-medium">Source</th>
            <th className="p-4 font-medium">YT Views</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((h) => (
            <tr key={h.id} className="border-b border-[#2a2a2a] hover:bg-[#252525] transition">
              <td className="p-4 text-zinc-300 truncate max-w-[250px]">{h.title}</td>
              <td className="p-4">{h.channelName}</td>
              <td className="p-4 text-zinc-400">{h.sourcePlatform === "tiktok" ? "🎵 @" : ""}{h.sourceHandle}</td>
              <td className="p-4 text-blue-400">{h.ytViews >= 1000 ? `${(h.ytViews / 1000).toFixed(1)}K` : h.ytViews}</td>
              <td className="p-4">
                {h.copyrightStatus === "clean" ? <span className="text-green-500">Clean</span>
                  : h.copyrightStatus === "claimed" ? <span className="text-yellow-500">Claimed</span>
                  : h.copyrightStatus === "blocked" ? <span className="text-red-500">Blocked</span>
                  : <span className="text-orange-500">Restricted</span>}
              </td>
              <td className="p-4 text-zinc-400">{new Date(h.date).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommentsTab({ data, filter, setFilter, onMarkAllRead, onReply }: { data?: AnalyticsComment[]; filter: string; setFilter: (v: string) => void; onMarkAllRead: () => void; onReply: (id: string) => void }) {
  if (!data) return <div className="text-zinc-500 text-center py-12">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1">
          {["all", "unread", "read"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded text-sm font-medium transition ${filter === f ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>
              {f === "all" ? "All" : f === "unread" ? `Unread (0)` : "Read"}
            </button>
          ))}
        </div>
        <button onClick={onMarkAllRead} className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-zinc-300 hover:text-white hover:border-zinc-600 transition">
          <CheckCheck size={16} /> Mark All Read
        </button>
      </div>
      <div className="space-y-3">
        {data.map((c) => (
          <div key={c.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <div className="text-sm text-zinc-300 truncate max-w-[500px]">{c.videoTitle}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Channel: {c.channelName} | Views: — | Likes: {c.likeCount}
                </div>
              </div>
              <div className="text-xs text-zinc-500 shrink-0 ml-3">
                {new Date(c.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
            </div>
            <div className="bg-[#252525] rounded-lg p-3 mb-2">
              <div className="text-xs text-zinc-400 mb-1">{c.authorName}</div>
              <div className="text-sm text-zinc-200">{c.commentText}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-zinc-500">{c.likeCount} 💬</div>
              <button onClick={() => onReply(c.id)} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                <Reply size={12} /> Reply on YouTube ↗
              </button>
              {c.replyText && (
                <div className="text-xs text-green-500">✓ Replied</div>
              )}
            </div>
          </div>
        ))}
        {data.length === 0 && <div className="text-zinc-500 text-center py-8">No comments found</div>}
      </div>
    </div>
  );
}

function CopyrightTab({ data, issuesOnly, setIssuesOnly }: { data?: CopyrightData; issuesOnly: boolean; setIssuesOnly: (v: boolean) => void }) {
  if (!data) return <div className="text-zinc-500 text-center py-12">Loading...</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-green-900/30 border border-green-800/50 rounded-lg text-sm">
          <CheckCircle size={16} className="text-green-400" /> <span className="text-green-400">✅ Clean</span> <span className="text-white font-medium">{data.summary.clean}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-900/30 border border-yellow-800/50 rounded-lg text-sm">
          <AlertTriangle size={16} className="text-yellow-400" /> <span className="text-yellow-400">⚠️ Claimed</span> <span className="text-white font-medium">{data.summary.claimed}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-900/30 border border-red-800/50 rounded-lg text-sm">
          <XCircle size={16} className="text-red-400" /> <span className="text-red-400">❌ Blocked</span> <span className="text-white font-medium">{data.summary.blocked}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-900/30 border border-orange-800/50 rounded-lg text-sm">
          <Globe size={16} className="text-orange-400" /> <span className="text-orange-400">🌍 Restricted</span> <span className="text-white font-medium">{data.summary.restricted}</span>
        </div>
        <div className="ml-auto">
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} className="accent-blue-600" />
            Issues Only
          </label>
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a] text-zinc-400 text-left">
              <th className="p-4 font-medium">Video</th>
              <th className="p-4 font-medium">Channel</th>
              <th className="p-4 font-medium">Copyright</th>
              <th className="p-4 font-medium">Restriction</th>
              <th className="p-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-b border-[#2a2a2a] hover:bg-[#252525] transition">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[300px]">{item.title}</span>
                    {item.youtubeVideoId && (
                      <a href={`https://youtu.be/${item.youtubeVideoId}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 shrink-0">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </td>
                <td className="p-4 text-zinc-300">{item.channelName}</td>
                <td className="p-4">
                  {item.copyrightStatus === "clean" ? <span className="text-green-500">✅ Clean</span>
                    : item.copyrightStatus === "claimed" ? <span className="text-yellow-500">⚠️ Claimed</span>
                    : item.copyrightStatus === "blocked" ? <span className="text-red-500">❌ Blocked</span>
                    : <span className="text-orange-500">🌍 Restricted</span>}
                </td>
                <td className="p-4 text-zinc-400 text-xs">{item.restrictionCountries || "✅ None"}</td>
                <td className="p-4 text-zinc-400">{new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
