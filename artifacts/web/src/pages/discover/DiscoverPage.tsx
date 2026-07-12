import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, X, Sparkles, Info, TrendingUp, ExternalLink, ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import api from "../../lib/api";

interface Creator {
  username: string;
  nickname: string;
  avatar: string;
  followers: number;
  following: number;
  likes: number;
  videos: number;
  bio: string;
  engagementScore: number;
}

interface CreatorResponse {
  creators: Creator[];
  total: number;
  uniqueCreators: number;
  searched: string;
}

interface CreatorDetail {
  profile: Creator & { engagementScore: number };
  videos: any[];
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function SeoModal({ creator, description, tags, onClose, onQueue }: {
  creator: Creator; description: string; tags: string; onClose: () => void;
  onQueue: (desc: string, t: string) => void;
}) {
  const [desc, setDesc] = useState(description);
  const [tagText, setTagText] = useState(tags);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerateDesc = async () => {
    setGeneratingDesc(true);
    try {
      const seo = await api.post<any>("/discover/generate-seo", { title: `${creator.nickname} TikTok`, platform: "tiktok" });
      setDesc(seo.description || desc);
    } catch {}
    setGeneratingDesc(false);
  };

  const handleGenerateTags = async () => {
    setGeneratingTags(true);
    try {
      const seo = await api.post<any>("/discover/generate-seo", { title: `${creator.nickname} content ideas`, platform: "tiktok" });
      setTagText((seo.tags || []).join(", "));
    } catch {}
    setGeneratingTags(false);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(null), 2000); });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Sparkles size={16} className="text-indigo-400" /> YouTube Content Generator</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">ViralFlows Powered — AI-generated content for @{creator.username}</p>

        <div className="mb-4">
          <label className="text-xs text-zinc-500 font-medium mb-1 block">📝 Generate Description</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={6} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none" />
          <div className="flex gap-2 mt-2">
            <button onClick={handleGenerateDesc} disabled={generatingDesc} className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
              <Sparkles size={12} /> {generatingDesc ? "Generating..." : "Generate Description"}
            </button>
            <button onClick={() => handleCopy(desc, "desc")} className="bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1">
              {copied === "desc" ? <Check size={12} className="text-green-500" /> : <Copy size={12} />} Copy
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-500 font-medium mb-1 block">🏷️ Generate 100+ Tags</label>
          <textarea value={tagText} onChange={(e) => setTagText(e.target.value)} rows={4} className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none" />
          <div className="flex gap-2 mt-2">
            <button onClick={handleGenerateTags} disabled={generatingTags} className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
              <Sparkles size={12} /> {generatingTags ? "Generating..." : "Generate 100+ Tags"}
            </button>
            <button onClick={() => handleCopy(tagText, "tags")} className="bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1">
              {copied === "tags" ? <Check size={12} className="text-green-500" /> : <Copy size={12} />} Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatorInfoModal({ creator, onClose }: { creator: Creator; onClose: () => void }) {
  const [detail, setDetail] = useState<CreatorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSeo, setShowSeo] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    api.get<CreatorDetail>(`/discover/creators/${creator.username}`).then(r => { setDetail(r); setLoading(false); }).catch(() => setLoading(false));
  }, [creator.username]);

  const handleCopyAll = () => {
    const text = `Username: @${creator.username}\nNickname: ${creator.nickname}\nFollowers: ${formatCount(creator.followers)}\nFollowing: ${formatCount(creator.following)}\nLikes: ${formatCount(creator.likes)}\nVideos: ${creator.videos}\nBio: ${creator.bio || "—"}`;
    navigator.clipboard.writeText(text).then(() => { setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000); });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {creator.avatar && <img src={creator.avatar} alt="" className="w-8 h-8 rounded-full border border-[#2a2a2a]" />}
            <div>
              <h2 className="text-white font-medium text-sm">{creator.nickname}</h2>
              <a href={`https://www.tiktok.com/@${creator.username}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">@{creator.username} <ExternalLink size={10} /></a>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3 text-center">
          {[
            { label: "Followers", value: creator.followers },
            { label: "Following", value: creator.following },
            { label: "Likes", value: creator.likes },
            { label: "Videos", value: creator.videos },
          ].map((s) => (
            <div key={s.label} className="bg-[#0f0f0f] rounded-lg p-2">
              <div className="text-white font-bold text-sm">{formatCount(s.value)}</div>
              <div className="text-[10px] text-zinc-600">{s.label}</div>
            </div>
          ))}
        </div>

        {creator.bio && <p className="text-xs text-zinc-400 mb-2">Bio: {creator.bio}</p>}

        <div className="flex items-center justify-between text-xs text-zinc-600 mb-3">
          <span>Engagement Score: <span className="text-indigo-400 font-medium">{creator.engagementScore || "—"}</span></span>
        </div>

        <div className="flex gap-2">
          <button onClick={handleCopyAll} className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-400 hover:text-white py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
            {copiedAll ? <Check size={12} className="text-green-500" /> : <Copy size={12} />} Copy All Info
          </button>
          <button onClick={() => setShowSeo(true)} className="flex-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
            <Sparkles size={12} /> YouTube Content Generator
          </button>
        </div>

        {loading && <div className="flex justify-center py-2 mt-2"><Loader2 size={14} className="animate-spin text-zinc-500" /></div>}

        {showSeo && (
          <SeoModal
            creator={creator}
            description=""
            tags=""
            onClose={() => setShowSeo(false)}
            onQueue={(desc, tags) => { setShowSeo(false); }}
          />
        )}
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const [searchType, setSearchType] = useState<"keyword" | "username" | "hashtag">("keyword");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All Regions");
  const [followers, setFollowers] = useState("All Followers");
  const [engagement, setEngagement] = useState("All");
  const [verified, setVerified] = useState("all");
  const [results, setResults] = useState<CreatorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [page, setPage] = useState(1);
  const [searchedVariations, setSearchedVariations] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const PER_PAGE = 20;

  const getMinFollowers = (f: string) => {
    if (f === "10K+") return 10000; if (f === "20K+") return 20000;
    if (f === "30K+") return 30000; if (f === "40K+") return 40000;
    if (f === "50K+") return 50000; if (f === "100K+") return 100000;
    if (f === "1M+") return 1000000; return 0;
  };

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setSearchedVariations([]);
    try {
      let searchQuery = query.trim();
      if (searchType === "username") searchQuery = query.trim().replace(/^@/, "");
      else if (searchType === "hashtag") searchQuery = query.trim().replace(/^#/, "");

      const minF = getMinFollowers(followers);
      const regionParam = region ? `&region=${encodeURIComponent(region)}` : "";
      const data = await api.get<CreatorResponse>(`/discover/creators?q=${encodeURIComponent(searchQuery)}&type=${searchType}&count=40&minFollowers=${minF}${regionParam}`);
      setResults(data);

      const variations = [searchQuery, `${searchQuery} tips`, `${searchQuery} tutorial`, `${searchQuery} ideas`, `${searchQuery} content`, `${searchQuery} best`];
      setSearchedVariations(variations);
    } catch (err: any) {
      setError(err?.error || err?.message || "Search failed");
      console.error("Creator search failed:", err);
    }
    setLoading(false);
  }, [query, searchType, followers, region]);

  const totalPages = results ? Math.ceil(results.creators.length / PER_PAGE) : 0;
  const paginated = results ? results.creators.slice((page - 1) * PER_PAGE, page * PER_PAGE) : [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">TikTok Discover</h1>
        <p className="text-sm text-zinc-500 mt-1">Discover creators by topic, username, hashtag — with filters</p>
      </div>

      {/* Search Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-[#1a1a1a] rounded-lg p-1 border border-[#2a2a2a] w-fit">
        {[
          { key: "keyword", label: "🔍 Keyword / Topic" },
          { key: "username", label: "@ Username" },
          { key: "hashtag", label: "# Hashtag" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => { setSearchType(tab.key as any); setQuery(""); setResults(null); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${searchType === tab.key ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:text-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {searchType === "keyword" && (
          <input className="w-64 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none"
            placeholder="cooking, fitness, pets, insurance, education..."
            value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
        )}
        {searchType === "username" && (
          <input className="w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none"
            placeholder="@username" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
        )}
        {searchType === "hashtag" && (
          <input className="w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none"
            placeholder="#hashtag" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
        )}

        <select value={region} onChange={(e) => setRegion(e.target.value)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white">
          <option value="">All Regions</option><option value="US">US</option><option value="UK">UK</option><option value="PK">Pakistan</option><option value="CN">China</option><option value="KR">Korea</option><option value="JP">Japan</option><option value="BR">Brazil</option><option value="DE">Germany</option><option value="FR">France</option><option value="CA">Canada</option><option value="AU">Australia</option>
        </select>
        <select value={followers} onChange={(e) => setFollowers(e.target.value)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white">
          <option>All Followers</option><option>10K+</option><option>20K+</option><option>30K+</option><option>40K+</option><option>50K+</option><option>100K+</option><option>1M+</option>
        </select>
        <select value={engagement} onChange={(e) => setEngagement(e.target.value)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white">
          <option>All</option><option>High</option><option>Medium</option>
        </select>
        <select value={verified} onChange={(e) => setVerified(e.target.value)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white">
          <option value="all">All Creators</option><option value="trending">Trending</option><option value="verified">Verified</option>
        </select>

        <button onClick={handleSearch} disabled={loading || !query.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Search
        </button>
      </div>

      {/* Quick Follower Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-zinc-600">Min followers:</span>
        {["10K", "20K", "30K", "40K", "50K", "100K", "1M"].map((limit) => (
          <button key={limit}
            onClick={() => {
              setFollowers(`${limit}+`);
              if (query.trim()) { setLoading(true); setPage(1);
                const regionParam = region ? `&region=${encodeURIComponent(region)}` : "";
                api.get<CreatorResponse>(`/discover/creators?q=${encodeURIComponent(query.trim())}&type=${searchType}&count=40&minFollowers=${getMinFollowers(`${limit}+`)}${regionParam}`)
                .then(d => { setResults(d); setError(null); }).catch((err: any) => setError(err?.error || err?.message || "Search failed")).finally(() => setLoading(false));
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${followers === `${limit}+` ? 'bg-indigo-600 text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-zinc-400 hover:border-indigo-500/30'}`}>
            {limit}+
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <X size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-white"><X size={14} /></button>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="mb-4">
          <div className="flex items-center gap-4 text-xs text-zinc-500 mb-2">
            <span>Showing <span className="text-white font-medium">{results.creators.length}</span></span>
            <span>Trending <span className="text-amber-400 font-medium">0</span></span>
            <span>Verified <span className="text-blue-400 font-medium">0</span></span>
            <span>Avg Engagement <span className="text-indigo-400 font-medium">
              {results.creators.length > 0 ? (results.creators.reduce((s, c) => s + (c.engagementScore || 0), 0) / results.creators.length).toFixed(1) : "—"}
            </span></span>
          </div>
          {searchedVariations.length > 0 && (
            <p className="text-xs text-zinc-600 mb-3">🔀 Searched {searchedVariations.length} variations: {searchedVariations.join(", ")}</p>
          )}

          {/* Creator Grid */}
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
          ) : paginated.length === 0 ? (
            <p className="text-center text-zinc-500 py-20 text-sm">No creators found. Try a different search.</p>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-3">
                {paginated.map((creator) => (
                  <div key={creator.username} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-center hover:border-zinc-600 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-[#0f0f0f] mx-auto mb-2 overflow-hidden border border-[#2a2a2a]">
                      {creator.avatar ? <img src={creator.avatar} alt={creator.nickname} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">?</div>}
                    </div>
                    <p className="text-sm text-white font-medium truncate">{creator.nickname}</p>
                    <p className="text-xs text-zinc-500 truncate">@{creator.username}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <TrendingUp size={11} className="text-amber-500" />
                      <span className="text-xs text-zinc-500">{creator.engagementScore || "—"}</span>
                    </div>
                    <button onClick={() => setSelectedCreator(creator)}
                      className="mt-2 text-xs bg-[#0f0f0f] border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10 px-3 py-1 rounded-lg w-full transition-colors flex items-center justify-center gap-1">
                      <Info size={11} /> Info
                    </button>
                    <div className="grid grid-cols-2 gap-1 mt-2 text-[10px] text-zinc-600">
                      <span>{formatCount(creator.followers)} Followers</span>
                      <span>{formatCount(creator.likes)} Likes</span>
                      <span>{creator.videos} Videos</span>
                      <span>{formatCount(creator.following)} Following</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="bg-[#1a1a1a] border border-[#2a2a2a] text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"><ChevronLeft size={14} /></button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i + 1} onClick={() => setPage(i + 1)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium ${page === i + 1 ? 'bg-indigo-600 text-white' : 'bg-[#0f0f0f] text-zinc-400 border border-[#2a2a2a] hover:border-indigo-500/30'}`}>
                      {i + 1}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="bg-[#1a1a1a] border border-[#2a2a2a] text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"><ChevronRight size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!results && !loading && (
        <div className="text-center py-20">
          <Search size={32} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">Search for TikTok creators</p>
          <p className="text-xs text-zinc-600 mt-1">Choose a search type, set your filters, and hit Search to discover creator profiles</p>
        </div>
      )}

      {selectedCreator && <CreatorInfoModal creator={selectedCreator} onClose={() => setSelectedCreator(null)} />}
    </div>
  );
}
