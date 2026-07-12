import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Youtube, ListVideo, Share2, Globe, BarChart3, Activity, ArrowRight, Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import api from "../../lib/api";
import { formatRelativeTime, getStatusColor } from "../../lib/utils";
import type { AnalyticsOverview, Operation } from "../../types";

const JS_ORIGIN = "https://viralflows-web-ecur.vercel.app";
const REDIRECT_URI = "https://viralflows-api.onrender.com/api/workspaces/oauth/callback";

function Step({ num, title, children }: { num: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-xs font-bold text-indigo-400">{num}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-white font-medium mb-0.5">{title}</p>
        <div className="text-xs text-zinc-400 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

const steps = [
  { num: 1, title: "Import Channels", route: "/channels", icon: Youtube },
  { num: 2, title: "Upload OAuth Files", route: "/workspaces", icon: Globe },
  { num: 3, title: "Auto-Assign GCP", route: "/workspaces", icon: Globe },
  { num: 4, title: "Authorize", route: "/workspaces", icon: Share2 },
  { num: 5, title: "Add Sources", route: "/sources", icon: Share2 },
  { num: 6, title: "Start Uploading", route: "/video-queue", icon: ListVideo },
];

const kpiCards = [
  { key: "totalChannels", label: "Total Channels", icon: Youtube },
  { key: "queueCount", label: "Videos in Queue", icon: ListVideo },
  { key: "videosUploaded", label: "Uploaded Today", icon: BarChart3 },
  { key: "totalViews", label: "Total Views", icon: BarChart3 },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showGcpGuide, setShowGcpGuide] = useState(true);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    try { await navigator.clipboard.writeText(text); setter(true); setTimeout(() => setter(false), 2000); } catch {}
  };

  const { data: overview } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview"],
    queryFn: () => api.get("/analytics/overview"),
  });

  const { data: recentOps } = useQuery<Operation[]>({
    queryKey: ["operations-recent"],
    queryFn: () => api.get("/operations/recent"),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Welcome to ViralFlows</h1>

      {/* GCP Setup Guide */}
      {showGcpGuide && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-400" />
              How to Create GCP OAuth File
            </h2>
            <button onClick={() => setShowGcpGuide(false)} className="text-sm text-zinc-500 hover:text-white transition-colors">Dismiss</button>
          </div>
          <p className="text-sm text-zinc-400 mb-5">
            Use the <strong className="text-zinc-200">same Gmail</strong> that has your YouTube channels. Follow each step carefully:
          </p>

          <div className="space-y-4">
            {/* Step 1 */}
            <Step num={1} title="Open Google Cloud Console">
              <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer"
                className="text-indigo-400 underline inline-flex items-center gap-1 hover:text-indigo-300">
                console.cloud.google.com <ExternalLink size={10} />
              </a>
              <br />Sign in with the Gmail that owns your YouTube channels.
            </Step>

            {/* Step 2 */}
            <Step num={2} title="Create a New Project">
              Click the project dropdown at the top → <strong className="text-zinc-300">New Project</strong>
              <br />Name it (e.g. "ViralFlows-YouTube") → Click <strong className="text-zinc-300">Create</strong>
              <br />Wait for it to finish, then select the new project from the dropdown.
            </Step>

            {/* Step 3 */}
            <Step num={3} title="Enable YouTube Data API">
              Left menu → <strong className="text-zinc-300">APIs & Services</strong> → <strong className="text-zinc-300">Library</strong>
              <br />Search <strong className="text-zinc-300">"YouTube Data API v3"</strong> → Click it → Click <strong className="text-zinc-300">Enable</strong>
            </Step>

            {/* Step 4 */}
            <Step num={4} title="Configure OAuth Consent Screen">
              Left menu → <strong className="text-zinc-300">APIs & Services</strong> → <strong className="text-zinc-300">OAuth consent screen</strong>
              <br />User Type: <strong className="text-zinc-300">External</strong> → Click <strong className="text-zinc-300">Create</strong>
              <br />Fill: App name (e.g. "ViralFlows Uploader"), User support email (your email), Developer contact (your email)
              <br />Click <strong className="text-zinc-300">Save and Continue</strong> (skip Scopes, just click Save)
              <br />Under <strong className="text-zinc-300">Test Users</strong> → <strong className="text-zinc-300">Add Users</strong> → enter your email → click Save → Back to Dashboard
            </Step>

            {/* Step 5 */}
            <Step num={5} title="Create OAuth 2.0 Client ID">
              Left menu → <strong className="text-zinc-300">APIs & Services</strong> → <strong className="text-zinc-300">Credentials</strong>
              <br />Click <strong className="text-zinc-300">+ Create Credentials</strong> → <strong className="text-zinc-300">OAuth 2.0 Client ID</strong>
              <br />Application type: <strong className="text-zinc-300">Web Application</strong>
              <br />Name: "ViralFlows" (or anything)
            </Step>

            {/* Step 6 - URL with copy */}
            <Step num={6} title="Add Authorized JavaScript Origins">
              <p className="text-zinc-400 mb-1.5">Paste this URL in the <strong className="text-zinc-300">Authorized JavaScript origins</strong> field:</p>
              <div className="flex items-center gap-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 max-w-full">
                <code className="text-xs text-indigo-300 flex-1 min-w-0 truncate">{JS_ORIGIN}</code>
                <button onClick={() => handleCopy(JS_ORIGIN, setCopiedOrigin)}
                  className="text-[10px] bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-2 py-1 rounded flex items-center gap-1 shrink-0">
                  {copiedOrigin ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 italic mt-1">This tells Google which website can make requests.</p>
            </Step>

            {/* Step 7 - URL with copy */}
            <Step num={7} title="Add Authorized Redirect URIs">
              <p className="text-zinc-400 mb-1.5">Paste this URL in the <strong className="text-zinc-300">Authorized redirect URIs</strong> field:</p>
              <div className="flex items-center gap-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 max-w-full">
                <code className="text-xs text-indigo-300 flex-1 min-w-0 truncate">{REDIRECT_URI}</code>
                <button onClick={() => handleCopy(REDIRECT_URI, setCopiedRedirect)}
                  className="text-[10px] bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-2 py-1 rounded flex items-center gap-1 shrink-0">
                  {copiedRedirect ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 italic mt-1">This tells Google where to send the OAuth response.</p>
            </Step>

            {/* Step 8 */}
            <Step num={8} title="Download the JSON File">
              Click <strong className="text-zinc-300">Create</strong> at the bottom
              <br />In the popup → Click <strong className="text-zinc-300">Download JSON</strong>
              <br />Save the <code className="text-indigo-300 bg-[#0f0f0f] px-1 rounded">client_secret.json</code> file to your computer
            </Step>

            {/* Step 9 */}
            <Step num={9} title="Upload to ViralFlows">
              Go to the <strong className="text-zinc-300">Workspaces</strong> tab (click "Workspaces & GCP" button above)
              <br />Click <strong className="text-zinc-300">Upload</strong> → Select the downloaded <code className="text-indigo-300 bg-[#0f0f0f] px-1 rounded">.json</code> file
              <br /><span className="text-green-400">Done! ✓</span> Now go to Workspaces and click <strong className="text-zinc-300">Auth</strong> on your channel.
            </Step>
          </div>

          <div className="mt-5 pt-4 border-t border-[#2a2a2a]">
            <button onClick={() => { setShowGcpGuide(false); navigate("/workspaces"); }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
              Go to Workspaces to Upload <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Onboarding Wizard */}
      {showOnboarding && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Getting Started</h2>
            <button onClick={() => setShowOnboarding(false)} className="text-sm text-zinc-500 hover:text-white transition-colors">Dismiss</button>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {steps.map((step, i) => (
              <button
                key={step.num}
                onClick={() => navigate(step.route)}
                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3 text-center hover:border-indigo-500/30 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-2">
                  <step.icon size={16} className="text-indigo-400" />
                </div>
                <div className="text-xs text-zinc-500 font-medium mb-1">Step {step.num}</div>
                <div className="text-xs text-zinc-300 group-hover:text-white transition-colors">{step.title}</div>
                <ArrowRight size={12} className="mx-auto mt-1 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpiCards.map((kpi) => (
          <div key={kpi.key} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">{kpi.label}</span>
              <kpi.icon size={18} className="text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-white">
              {(overview as any)?.[kpi.key] ?? "-"}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Recent Activity</h3>
          {recentOps?.length ? (
            <div className="space-y-3">
              {recentOps.map((op) => (
                <div key={op.id} className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0">
                  <div>
                    <p className="text-sm text-white capitalize">{op.jobType.replace(/_/g, " ")}</p>
                    <p className="text-xs text-zinc-500">{formatRelativeTime(op.createdAt)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getStatusColor(op.status)}`}>
                    {op.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No recent activity. Start by importing a channel.</p>
          )}
        </div>

        {/* System Status */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">System Status</h3>
          <div className="space-y-3">
            {[
              { label: "GCP Connection", status: "connected" },
              { label: "YouTube API", status: "ok" },
              { label: "TikTok Sources", status: overview?.totalChannels ? "active" : "inactive" },
              { label: "Queue Processing", status: "idle" },
            ].map((sys) => (
              <div key={sys.label} className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0">
                <span className="text-sm text-zinc-400">{sys.label}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${sys.status === "connected" || sys.status === "ok" ? "text-green-500" : sys.status === "active" ? "text-indigo-400" : "text-zinc-500"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sys.status === "connected" || sys.status === "ok" ? "bg-green-500" : sys.status === "active" ? "bg-indigo-400" : "bg-zinc-500"}`} />
                  {sys.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
