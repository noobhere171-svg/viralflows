import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import api from "../../lib/api";

export default function AdminPlanRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);

  const fetchRequests = () => {
    setLoading(true);
    api.get(`/admin/plan-requests?status=${status}`).then(setRequests).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchRequests(); }, [status]);

  const handleApprove = async (id: string) => {
    await api.post(`/admin/plan-requests/${id}/approve`, {});
    fetchRequests();
  };
  const handleReject = async (id: string) => {
    const note = prompt("Rejection reason (optional):");
    await api.post(`/admin/plan-requests/${id}/reject`, { adminNote: note });
    fetchRequests();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Plan Requests</h1>

      <div className="flex gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-4 py-2 rounded-lg text-sm capitalize ${status === s ? "bg-violet-600 text-white" : "bg-[#1a1a1a] border border-[#2a2a2a] text-zinc-400 hover:text-white"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#2a2a2a] text-left">
            <th className="px-4 py-3 text-zinc-400 font-medium">User</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Requested Plan</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Date</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Status</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            : requests.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No requests</td></tr>
            : requests.map((r) => (
              <tr key={r.id} className="border-b border-[#2a2a2a]">
                <td className="px-4 py-3 text-white">{r.userEmail || "Unknown"}</td>
                <td className="px-4 py-3"><span className="px-2 py-1 rounded text-xs font-medium bg-violet-500/20 text-violet-400 capitalize">{r.requestedPlan}</span></td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${r.status === "approved" ? "bg-green-500/20 text-green-400" : r.status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>{r.status}</span></td>
                <td className="px-4 py-3 flex gap-2">
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => handleApprove(r.id)} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                      <button onClick={() => handleReject(r.id)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                    </>
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
