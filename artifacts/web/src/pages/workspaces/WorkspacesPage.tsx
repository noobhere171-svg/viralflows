import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Globe, Upload, X, Check, RefreshCw, Search, Settings2, Copy, AlertTriangle, HelpCircle } from "lucide-react";
import api from "../../lib/api";
import type { Workspace, Channel, Schedule } from "../../types";

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", gcpProjectId: "", gcpEmail: "" });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [search, setSearch] = useState("");
  const [showAutoAssign, setShowAutoAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({ workspaceId: "", channelsPerProject: 2, videosPerDay: 3 });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<any[] | null>(null);
  const [verifySummary, setVerifySummary] = useState<any | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerifyTokens = async () => {
    setVerifying(true);
    try {
      const resp = await api.get<any>("/workspaces/_diag/verify-tokens");
      setVerifyResults(resp.channels);
      setVerifySummary(resp.summary);
    } catch (err: any) {
      fb("error", err?.message || "Verify failed");
    }
    setVerifying(false);
  };

  const getVerifyStatus = (channelId: string) => {
    if (!verifyResults) return null;
    return verifyResults.find((r: any) => r.channelId === channelId);
  };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "youtube-oauth-success") {
        const verified = e.data.verifiedChannel;
        if (verified) {
          setOauthStatus(`success:${verified.name}:${verified.id}`);
        } else {
          setOauthStatus("success");
        }
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        queryClient.invalidateQueries({ queryKey: ["channels"] });
        setTimeout(() => setOauthStatus(null), 8000);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [queryClient]);

  // Handle OAuth error/success from URL params (redirect flow when window.opener is null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    const message = params.get("message");
    const verifiedRaw = params.get("verified");
    if (oauth === "error" && message) {
      if (message.startsWith("wrong_account:")) {
        const parts = message.split(":");
        const verifiedName = parts[1] || "unknown";
        const conflictChannel = parts[2] || "unknown";
        fb("error", `WRONG ACCOUNT: You authorized "${verifiedName}" but it's already assigned to channel "${conflictChannel}". Log into the correct Google account and try again.`);
      } else {
        fb("error", `OAuth error: ${message}`);
      }
      window.history.replaceState({}, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    }
    if (oauth === "success") {
      let verifiedName = "";
      if (verifiedRaw) {
        try { const v = JSON.parse(decodeURIComponent(verifiedRaw)); if (v?.name) verifiedName = v.name; } catch {}
      }
      fb("success", verifiedName ? `Authorized YouTube channel: ${verifiedName}` : "Channel authorized!");
      window.history.replaceState({}, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    }
  }, [queryClient]);

  const fb = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const { data: workspaces = [] } = useQuery<Workspace[]>({ queryKey: ["workspaces"], queryFn: () => api.get("/workspaces") });
  const { data: channels = [] } = useQuery<Channel[]>({ queryKey: ["channels"], queryFn: () => api.get("/channels") });
  const { data: schedules = [] } = useQuery<Schedule[]>({ queryKey: ["schedules"], queryFn: () => api.get("/schedule") });

  const createMutation = useMutation({
    mutationFn: () => api.post("/workspaces", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workspaces"] }); setShowCreate(false); setForm({ name: "", gcpProjectId: "", gcpEmail: "" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workspaces"] }); queryClient.invalidateQueries({ queryKey: ["channels"] }); setDeleteConfirm(null); },
  });

  const scheduleMap = new Map<string, Schedule>();
  for (const s of schedules) if (s.channelId) scheduleMap.set(s.channelId, s);

  // ─── GCP credential upload + auto-assign ───
  const refreshGcpData = () => {
    workspaces.forEach((ws) => {
      api.get<any[]>(`/workspaces/${ws.id}/gcp-credentials`).then(creds => {
        setGcpData(prev => ({ ...prev, [ws.id]: creds }));
      }).catch(() => {});
    });
  };

  const handleUploadGcp = async (ws: Workspace) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0]; if (!file) return;
      setUploadingId(ws.id);
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const oauthData = json.web || json.installed || json;
        if (!oauthData.client_id || !oauthData.client_secret) { fb("error", "Invalid client_secret.json"); setUploadingId(null); return; }
        const fileName = file.name.replace(".json", "");
        const name = fileName || `GCP-${Date.now()}`;
        await api.post(`/workspaces/${ws.id}/gcp-credentials`, { name, clientSecretData: json });
        fb("success", `Added GCP "${name}"`);

        // Auto-assign: distribute all channels in workspace across available GCPs
        const wsChannels = channels.filter(c => c.workspaceId === ws.id);
        if (wsChannels.length > 0) {
          const creds = await api.get<any[]>(`/workspaces/${ws.id}/gcp-credentials`);
          if (creds.length > 0) {
            // Round-robin assign channels to credentials
            for (let i = 0; i < wsChannels.length; i++) {
              const cred = creds[i % creds.length];
              await api.patch(`/channels/${wsChannels[i].id}`, { gcpCredentialId: cred.id });
            }
            fb("success", `Auto-assigned ${wsChannels.length} channels across ${creds.length} GCPs`);
          }
        }
        refreshGcpData();
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        queryClient.invalidateQueries({ queryKey: ["channels"] });
      } catch (err: any) { fb("error", err?.message || "Upload failed"); }
      setUploadingId(null);
    };
    input.click();
  };

  const handleDeleteGcpCred = async (wsId: string, credId: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/workspaces/${wsId}/gcp-credentials/${credId}`);
      refreshGcpData();
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    } catch (err: any) { fb("error", err?.message); }
  };

  // ─── Per-workspace GCP credentials fetch ───
  const [gcpData, setGcpData] = useState<Record<string, any[]>>({});
  useEffect(() => {
    const ids = workspaces.map(w => w.id);
    ids.forEach((id) => {
      api.get<any[]>(`/workspaces/${id}/gcp-credentials`).then(creds => {
        setGcpData(prev => ({ ...prev, [id]: creds }));
      }).catch(() => {
        setGcpData(prev => ({ ...prev, [id]: [] }));
      });
    });
  }, [workspaces.length]);

  return (
    <div className="max-w-5xl mx-auto">
      {oauthStatus === "success" && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400 flex items-center gap-2">
          <Check size={16} /> YouTube authorization successful!
        </div>
      )}
      {oauthStatus?.startsWith("success:") && (() => {
        const parts = oauthStatus.split(":");
        const verifiedName = parts[1] || "unknown";
        const verifiedId = parts[2] || "";
        // Check if verified channel matches any existing channel name
        const matchingChannel = channels.find(c => c.channelName === verifiedName);
        const isMismatch = !matchingChannel && channels.some(c => c.authStatus === "authorized");
        return (
          <div className={`mb-4 ${isMismatch ? "bg-yellow-500/10 border-yellow-500/30" : "bg-green-500/10 border-green-500/30"} border rounded-lg px-4 py-3 text-sm flex items-center gap-2`}>
            <Check size={16} className={isMismatch ? "text-yellow-400" : "text-green-400"} />
            <div>
              <span className={isMismatch ? "text-yellow-400" : "text-green-400"}>
                Authorized YouTube channel: <strong>{verifiedName}</strong>
              </span>
              {verifiedId && <span className="text-zinc-500 text-xs ml-2">({verifiedId})</span>}
              {isMismatch && (
                <p className="text-yellow-400/70 text-xs mt-1">
                  This channel name doesn't match any existing channel in your workspace. If this is wrong, log into the correct Google account and re-authorize.
                </p>
              )}
            </div>
          </div>
        );
      })()}
      {feedback && (
        <div className={`mb-4 ${feedback.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"} border rounded-lg px-4 py-3 text-sm flex items-center gap-2`}>
          {feedback.type === "success" ? <Check size={16} /> : <X size={16} />} {feedback.msg}
        </div>
      )}

      {verifySummary && (
        <div className="mb-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-zinc-500 font-medium">Token Verification:</span>
            {verifySummary.correct > 0 && <span className="text-green-400">{verifySummary.correct} correct</span>}
            {verifySummary.wrongAccount > 0 && <span className="text-red-400 font-semibold">{verifySummary.wrongAccount} wrong account</span>}
            {verifySummary.expired > 0 && <span className="text-yellow-400">{verifySummary.expired} expired</span>}
            {verifySummary.noToken > 0 && <span className="text-zinc-500">{verifySummary.noToken} no token</span>}
            {verifySummary.failed > 0 && <span className="text-red-400">{verifySummary.failed} failed</span>}
            <button onClick={() => { setVerifyResults(null); setVerifySummary(null); }} className="text-zinc-600 hover:text-zinc-400 ml-auto">Clear</button>
          </div>
          {verifySummary.wrongAccount > 0 && (
            <p className="text-red-400/70 mt-1.5">Some tokens belong to wrong YouTube channels. Click "Auth" on affected channels and authorize with the correct Google account.</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Workspaces & GCP</h1>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input className="w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleVerifyTokens} disabled={verifying}
            className="bg-[#1a1a1a] border border-[#2a2a2a] text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
            <RefreshCw size={12} className={verifying ? "animate-spin" : ""} />
            {verifying ? "Verifying..." : "Verify Tokens"}
          </button>
          <button onClick={() => setShowAutoAssign(true)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium">GCP Auto-Assign</button>
          <button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
            <Plus size={14} /> Create Workspace
          </button>
        </div>
      </div>

      {workspaces.map((ws) => {
        const wsChannels = channels.filter(c => c.workspaceId === ws.id);
        const wsActiveCh = wsChannels.filter(c => c.authStatus === "authorized").length;
        const creds = gcpData[ws.id] || [];
        const hasGcp = creds.length > 0;
        const hasAutoAssign = wsChannels.some(c => c.gcpCredentialId);
        const allAuth = wsActiveCh === wsChannels.length && wsChannels.length > 0;

        return (
          <div key={ws.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-indigo-400" />
                <h2 className="text-lg font-semibold text-white">{ws.email || ws.gcpEmail || "Unnamed"}</h2>
              </div>
              <button onClick={() => setDeleteConfirm(ws.id)} className="text-zinc-500 hover:text-red-400 text-xs border border-[#2a2a2a] px-2.5 py-1 rounded-lg">Delete</button>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-2 mb-5 text-xs">
              {[
                { label: "Import", done: true },
                { label: "GCP", done: hasGcp },
                { label: "Assign", done: hasAutoAssign },
                { label: "Auth", done: wsActiveCh > 0 },
                { label: "Live", done: allAuth },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-2">
                  {s.done
                    ? <span className="text-green-500 flex items-center gap-1"><Check size={12} /> {s.label}</span>
                    : <span className="text-zinc-600">{i + 1}. {s.label}</span>}
                  {i < 4 && <span className="text-zinc-700">→</span>}
                </div>
              ))}
            </div>

            {/* OAuth Files - Unified */}
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-3">OAuth Files</h3>
              {creds.length === 0 ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Upload JSON</span>
                    <button onClick={() => navigate("/")}
                      className="text-[10px] text-zinc-600 hover:text-indigo-400 flex items-center gap-0.5">
                      <HelpCircle size={10} /> Guide
                    </button>
                  </div>
                  <button onClick={() => handleUploadGcp(ws)} disabled={uploadingId === ws.id}
                    className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded hover:bg-indigo-500/20">
                    {uploadingId === ws.id ? "Uploading..." : "Upload"}
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {creds.map((cred: any, idx: number) => {
                    const authCount = wsChannels.filter(c => c.gcpCredentialId === cred.id && c.authStatus === "authorized").length;
                    const isBlocked = cred.status === "blocked";
                    const isExpired = cred.status === "expired";
                    return (
                      <div key={cred.id} className="flex items-center justify-between py-1 border-b border-[#2a2a2a]/50 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-zinc-600">#{idx + 1}</span>
                          <span className={`text-xs truncate max-w-[160px] ${isBlocked ? "text-red-400" : isExpired ? "text-yellow-400" : "text-zinc-300"}`}>{cred.name || cred.clientId?.slice(0, 20)}</span>
                          {isBlocked && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-semibold">BLOCKED</span>}
                          {isExpired && <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">EXPIRED</span>}
                          {!isBlocked && !isExpired && <span className={`text-[10px] ${authCount > 0 ? "text-green-500" : "text-red-400"}`}>{authCount > 0 ? "✅" : "🔴"}</span>}
                          {cred.dailyUploadCount > 0 && <span className="text-[10px] text-zinc-500">{cred.dailyUploadCount}/6 today</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          {(isBlocked || isExpired) && (
                            <button onClick={async () => {
                              if (!window.confirm(`Expire GCP "${cred.name}"? All channels using it will be de-authorized.`)) return;
                              try {
                                await api.post(`/workspaces/${ws.id}/expire-gcp/${cred.id}`);
                                refreshGcpData();
                                queryClient.invalidateQueries({ queryKey: ["channels"] });
                                fb("success", `GCP expired. Upload a new GCP project and re-authorize channels.`);
                              } catch (err: any) { fb("error", err?.message); }
                            }} className="text-[10px] text-yellow-400 hover:text-yellow-300 border border-yellow-400/20 px-1.5 py-0.5 rounded">Expire</button>
                          )}
                          <button onClick={() => handleDeleteGcpCred(ws.id, cred.id, cred.name)}
                            className="text-[10px] text-red-400 hover:text-red-300 border border-red-400/20 px-1.5 py-0.5 rounded">Del</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center justify-between mt-1.5">
                <button onClick={() => handleUploadGcp(ws)} disabled={uploadingId === ws.id}
                  className="text-xs text-indigo-400 hover:text-indigo-300">
                  {uploadingId === ws.id ? "Uploading..." : creds.length === 0 ? "+ Add GCP Project" : "+ Add Another GCP"}
                </button>
                <button onClick={() => navigate("/")}
                  className="text-[10px] text-zinc-600 hover:text-indigo-400 flex items-center gap-0.5">
                  <HelpCircle size={10} /> Guide
                </button>
              </div>
            </div>

            {/* GCP Blocked/Expired Alert */}
            {creds.some((c: any) => c.status === "blocked" || c.status === "expired") && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-400">GCP Project Blocked by YouTube</p>
                    <p className="text-[11px] text-red-300/70 mt-1">
                      Your GCP project is unverified. All uploaded videos are locked as private.
                      Channels using this GCP have been de-authorized.
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-2">
                      <span className="text-zinc-300">Steps:</span> 1. Click "Expire" on blocked GCP → 2. Create new Google Cloud Project → 3. Upload new credentials → 4. Re-authorize channels
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Limit Info */}
            <div className="mt-2 text-[10px] text-zinc-600">
              Daily limits: 1 channel/GCP = 3/day, 2 channels = 2/day each, 3 channels = 1/day each
            </div>

            {/* Channels */}
            {wsChannels.length > 0 && (
              <div className="mt-4 border-t border-[#2a2a2a] pt-3">
                <div className="space-y-0.5">
                  {wsChannels.map(ch => {
                    const sched = scheduleMap.get(ch.id);
                    const maxVid = sched?.maxVideosPerDay || "2";
                    const credName = (ch as any).gcpCredentialName || "";
                    return (
                      <div key={ch.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs ${ch.authStatus === "authorized" ? "text-green-400" : "text-zinc-400"}`}>
                            {ch.channelName || ch.youtubeChannelId || ch.id.slice(0, 8)}
                          </span>
                          {(() => {
                            const vs = getVerifyStatus(ch.id);
                            if (!vs) return null;
                            if (vs.verifyStatus === "WRONG_ACCOUNT") {
                              return <span className="text-[10px] text-red-400 font-semibold bg-red-500/10 px-1.5 py-0.5 rounded">WRONG: {vs.verifiedChannelName}</span>;
                            }
                            if (vs.verifyStatus === "TOKEN_EXPIRED") {
                              return <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">EXPIRED</span>;
                            }
                            if (vs.verifyStatus === "VERIFY_FAILED") {
                              return <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">INVALID</span>;
                            }
                            if (vs.verifyStatus === "CORRECT") {
                              return <span className="text-[10px] text-green-500">verified</span>;
                            }
                            return null;
                          })()}
                          {credName && <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1 rounded">{credName}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-zinc-600">{maxVid}/d</span>
                          {ch.authStatus === "authorized" ? (
                            <span className="text-[10px] text-green-500 font-medium">LIVE</span>
                          ) : ch.gcpCredentialId ? (
                            <>
                              <button onClick={async () => {
                                try {
                                  const r = await api.get<any>(`/channels/${ch.id}/authorize`);
                                  if (r.conflictWarning) {
                                    if (!window.confirm(`${r.conflictWarning}\n\nProceed with authorization?`)) return;
                                  }
                                  if (r.redirectUrl) window.open(r.redirectUrl, '_blank', 'width=600,height=700');
                                } catch (err: any) { fb("error", err?.message || "Auth failed"); }
                              }} className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded hover:bg-indigo-500/20">Auth</button>
                              <button onClick={async () => {
                                try {
                                  const r = await api.get<any>(`/channels/${ch.id}/authorize`);
                                  if (r.redirectUrl) {
                                    await navigator.clipboard.writeText(r.redirectUrl);
                                    setCopiedId(ch.id);
                                    setTimeout(() => setCopiedId(null), 2000);
                                  }
                                } catch (err: any) { fb("error", err?.message || "Failed"); }
                              }} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded hover:bg-emerald-500/20 flex items-center gap-1">
                                {copiedId === ch.id ? <Check size={10} /> : <Copy size={10} />}
                                {copiedId === ch.id ? "Copied" : "Copy Link"}
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-zinc-600">Assign GCP first</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 text-[10px] text-zinc-600 border-t border-[#2a2a2a]/50 mt-2 pt-2">
                  <span>Authorized: {wsActiveCh}/{wsChannels.length}</span>
                  <span>GCPs: {creds.length}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Auto-Assign Modal */}
      {showAutoAssign && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowAutoAssign(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Settings2 size={16} className="text-indigo-400" /> GCP Auto-Assign</h2>
              <button onClick={() => setShowAutoAssign(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>

            {/* Workspace Select */}
            <div className="mb-4">
              <label className="text-xs text-zinc-500 block mb-1">Workspace Email</label>
              <select value={assignForm.workspaceId} onChange={(e) => setAssignForm({ ...assignForm, workspaceId: e.target.value })}
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white">
                <option value="">Select workspace...</option>
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>
                    {ws.email || ws.id.slice(0, 8)} ({channels.filter(c => c.workspaceId === ws.id).length}ch, {(gcpData[ws.id] || []).length} OAuth files)
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-600 mt-1">Only your workspaces are shown — fully isolated</p>
            </div>

            {assignForm.workspaceId && (() => {
              const wsId = assignForm.workspaceId;
              const ws = workspaces.find(w => w.id === wsId);
              const wsCh = channels.filter(c => c.workspaceId === wsId);
              const totalCh = wsCh.length;
              const wsCreds = gcpData[wsId] || [];
              const wsLevelOAuth = ws?.oauthFilePath && !wsCreds.some(c => c.oauthFilePath === ws.oauthFilePath) ? 1 : 0;
              const existingProjects = wsCreds.length + wsLevelOAuth;
              const oauthFiles = existingProjects;
              const chPerProject = assignForm.channelsPerProject;
              const maxVidPerCh = Math.floor(6 / chPerProject);
              const vidPerDay = Math.min(assignForm.videosPerDay, maxVidPerCh);
              const projectsNeeded = Math.ceil(totalCh / chPerProject);
              const oauthFilesNeeded = Math.max(0, projectsNeeded - oauthFiles);
              const canAssign = oauthFilesNeeded === 0;

              return (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 bg-[#0a0a0a] rounded-lg p-3 text-xs">
                    <div className="text-zinc-500">Total channels: <span className="text-white">{totalCh}</span></div>
                    <div className="text-zinc-500">OAuth files: <span className="text-white">{oauthFiles}</span></div>
                    <div className="text-zinc-500">Existing GCP projects: <span className="text-white">{existingProjects}</span></div>
                  </div>

                  {/* Channels per GCP */}
                  <div>
                    <label className="text-xs text-zinc-500 block mb-2">Channels per GCP Project</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[{ v: 1, l: "1 ch", m: "6 vid/day each" }, { v: 2, l: "2 ch", m: "3 vid/day each" }, { v: 3, l: "3 ch", m: "2 vid/day each" }, { v: 6, l: "6 ch", m: "1 vid/day each" }].map(o => (
                        <button key={o.v} onClick={() => setAssignForm(a => ({ ...a, channelsPerProject: o.v, videosPerDay: Math.min(a.videosPerDay, Math.floor(6 / o.v)) }))}
                          className={`p-2 rounded-lg border text-center ${assignForm.channelsPerProject === o.v ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-[#0f0f0f] border-[#2a2a2a]'}`}>
                          <div className={`text-xs font-medium ${assignForm.channelsPerProject === o.v ? 'text-indigo-400' : 'text-zinc-400'}`}>{o.l}</div>
                          <div className="text-[10px] text-zinc-600">{o.m}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">Recommended: 2 channels per GCP (6 daily uploads max). GCP lasts ~7 days.</p>
                  </div>

                  {/* Videos per day */}
                  <div>
                    <label className="text-xs text-zinc-500 block mb-2">Videos per day per channel (max {maxVidPerCh})</label>
                    <input type="range" min={1} max={maxVidPerCh} value={vidPerDay}
                      onChange={(e) => setAssignForm(a => ({ ...a, videosPerDay: Number(e.target.value) }))} className="w-full accent-indigo-500" />
                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                      <span>{chPerProject} channels x {vidPerDay} vids = {chPerProject * vidPerDay}/6 daily slots used</span>
                      <span className="text-indigo-400">{vidPerDay}</span>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="bg-[#0a0a0a] rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-zinc-500">Projects needed:</span><span className="text-white">{projectsNeeded}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">OAuth files available:</span><span className="text-white">{oauthFiles}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">OAuth files needed:</span><span className={oauthFilesNeeded > 0 ? 'text-yellow-400' : 'text-green-500'}>{oauthFilesNeeded}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Projects to create:</span><span className="text-white">{Math.max(0, projectsNeeded - existingProjects)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Channels to assign:</span><span className="text-white">{totalCh} of {totalCh}</span></div>
                  </div>

                  {/* Action */}
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setShowAutoAssign(false)} className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-400 hover:text-white py-2 rounded-lg text-sm">Cancel</button>
                    {oauthFilesNeeded > 0 ? (
                      <button disabled className="flex-1 bg-yellow-600/30 text-yellow-500 py-2 rounded-lg text-sm font-medium cursor-not-allowed">
                        Upload {oauthFilesNeeded} more OAuth file(s) first
                      </button>
                    ) : (
                      <button onClick={async () => {
                        try {
                          await api.post("/workspaces/auto-assign", { ...assignForm, videosPerDay: vidPerDay });
                          fb("success", `Assigned ${totalCh} channel${totalCh !== 1 ? 's' : ''}`);
                          setShowAutoAssign(false);
                          queryClient.invalidateQueries({ queryKey: ["channels"] });
                        } catch (err: any) { fb("error", err?.message); }
                      }} disabled={!canAssign} className={`flex-1 py-2 rounded-lg text-sm font-medium ${canAssign ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
                        Re-Assign {totalCh} channel{totalCh !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Create Workspace</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Workspace Name" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input placeholder="GCP Project ID" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" value={form.gcpProjectId} onChange={(e) => setForm({ ...form, gcpProjectId: e.target.value })} />
              <input placeholder="GCP Service Account Email" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" value={form.gcpEmail} onChange={(e) => setForm({ ...form, gcpEmail: e.target.value })} />
              <button onClick={() => createMutation.mutate()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium">Create</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-2">Delete Workspace?</h3>
            <p className="text-sm text-zinc-400 mb-4">This will permanently delete the workspace and all its channels.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-400 hover:text-white rounded-lg text-sm">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
