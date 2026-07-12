import { useState, useEffect } from "react";
import { Check, X, Eye, Clock, ExternalLink, XIcon, Image } from "lucide-react";
import api from "../../lib/api";

export default function AdminPayments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [actionNote, setActionNote] = useState<Record<string, string>>({});
  const [viewScreenshot, setViewScreenshot] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const loadSettings = () => {
    setSettingsLoading(true);
    api.get("/admin/settings").then((data) => {
      setAutoApprove(data.auto_approve_upgrades === "true");
    }).catch(() => {}).finally(() => setSettingsLoading(false));
  };

  const toggleAutoApprove = async () => {
    const next = !autoApprove;
    setAutoApprove(next);
    try {
      await api.post("/admin/settings", { key: "auto_approve_upgrades", value: next.toString() });
    } catch (err) { console.error("Failed to toggle auto-approve", err); setAutoApprove(!next); }
  };

  const load = () => {
    setLoading(true);
    api.get(`/admin/payments?status=${tab}`).then(setPayments).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => { load(); }, [tab]);

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/admin/payments/${id}/approve`, { adminNote: actionNote[id] || null });
      load();
    } catch (err: any) { alert(err.message); }
  };

  const handleReject = async (id: string) => {
    try {
      await api.post(`/admin/payments/${id}/reject`, { adminNote: actionNote[id] || "Rejected" });
      load();
    } catch (err: any) { alert(err.message); }
  };

  const getScreenshotUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return url;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Payment Approvals</h1>
        <button onClick={toggleAutoApprove} disabled={settingsLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${autoApprove ? "bg-green-600/20 text-green-400 hover:bg-green-600/30" : "bg-[#1a1a1a] text-zinc-400 hover:text-white"}`}>
          <span className={`inline-block w-5 h-5 rounded border ${autoApprove ? "bg-green-400 border-green-400 text-black text-center leading-5 text-xs font-bold" : "bg-transparent border-zinc-500"}`}>
            {autoApprove ? "\u2713" : ""}
          </span>
          Auto-Approve {autoApprove ? "ON" : "OFF"}
        </button>
      </div>
      {autoApprove && (
        <div className="bg-green-600/10 border border-green-600/30 rounded-lg px-4 py-2 text-sm text-green-400">
          Auto-approve is enabled — all new upgrade requests will be approved automatically
        </div>
      )}

      <div className="flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-indigo-600 text-white" : "bg-[#1a1a1a] text-zinc-400 hover:text-white"}`}>
            {t} {t === "pending" && <span className="ml-1 text-xs">({payments.length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-zinc-500 py-8">Loading...</div>
      ) : payments.length === 0 ? (
        <div className="text-center text-zinc-500 py-8">No {tab} payments</div>
      ) : (
        <div className="space-y-4">
          {payments.map((p) => (
            <div key={p.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white font-medium">{p.userName || p.userEmail}</span>
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-xs capitalize">{p.requestedPlan}</span>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{p.paymentMethod}</span>
                    <span className="text-zinc-500 text-xs">{new Date(p.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-zinc-400">Amount: <span className="text-white">{p.amount?.toLocaleString()} PKR</span></span>
                    {p.transactionId && <span className="text-zinc-400">TXN: <span className="text-white">{p.transactionId}</span></span>}
                  </div>
                  {p.screenshotUrl && (
                    <button onClick={() => setViewScreenshot(getScreenshotUrl(p.screenshotUrl))}
                      className="inline-flex items-center gap-1 text-indigo-400 text-sm mt-2 hover:text-indigo-300">
                      <Image size={14} /> View Screenshot
                    </button>
                  )}
                  {p.adminNote && tab !== "pending" && (
                    <p className="text-zinc-500 text-xs mt-1 italic">Note: {p.adminNote}</p>
                  )}
                </div>

                {tab === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <input type="text" placeholder="Admin note..." value={actionNote[p.id] || ""}
                      onChange={(e) => setActionNote({ ...actionNote, [p.id]: e.target.value })}
                      className="w-40 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white placeholder:text-zinc-600" />
                    <button onClick={() => handleApprove(p.id)} className="p-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30" title="Approve">
                      <Check size={16} />
                    </button>
                    <button onClick={() => handleReject(p.id)} className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30" title="Reject">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Screenshot Modal */}
      {viewScreenshot && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8" onClick={() => setViewScreenshot(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewScreenshot(null)} className="absolute -top-10 right-0 text-white hover:text-zinc-300">
              <XIcon size={24} />
            </button>
            {viewScreenshot.endsWith(".pdf") ? (
              <iframe src={viewScreenshot} className="w-full h-[80vh] rounded-lg bg-white" />
            ) : (
              <img src={viewScreenshot} alt="Payment Screenshot" className="max-w-full max-h-[80vh] rounded-lg mx-auto" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
