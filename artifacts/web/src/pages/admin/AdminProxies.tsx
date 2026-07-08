import { useState, useEffect } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import api from "../../lib/api";

export default function AdminProxies() {
  const [proxies, setProxies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState({ ipAddress: "", port: "", protocol: "http", username: "", passwordEncrypted: "", assignedToPlan: "all", maxConcurrentUsers: 5 });
  const [bulkText, setBulkText] = useState("");

  const fetchProxies = () => {
    api.get("/admin/proxies").then(setProxies).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchProxies(); }, []);

  const handleAdd = async () => {
    await api.post("/admin/proxies", { ...form, port: parseInt(form.port) || 8080 });
    setShowAdd(false);
    setForm({ ipAddress: "", port: "", protocol: "http", username: "", passwordEncrypted: "", assignedToPlan: "all", maxConcurrentUsers: 5 });
    fetchProxies();
  };

  const handleBulk = async () => {
    const lines = bulkText.split("\n").filter(Boolean).map((l) => {
      const parts = l.split(":");
      return { ipAddress: parts[0], port: parseInt(parts[1]) || 8080, username: parts[2] || "", passwordEncrypted: parts[3] || "" };
    });
    await api.post("/admin/proxies/bulk", { proxies: lines, assignedToPlan: "all" });
    setShowBulk(false);
    setBulkText("");
    fetchProxies();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete proxy?")) return;
    await api.delete(`/admin/proxies/${id}`);
    fetchProxies();
  };

  const handleAssignPlan = async (id: string, plan: string) => {
    await api.patch(`/admin/proxies/${id}`, { assignedToPlan: plan });
    fetchProxies();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Global Proxy Pool</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg text-sm hover:bg-white/5"><Upload size={16} /> Bulk Import</button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"><Plus size={16} /> Add Proxy</button>
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#2a2a2a] text-left">
            <th className="px-4 py-3 text-zinc-400 font-medium">IP:Port</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Protocol</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Status</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Speed</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Plan</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Users</th>
            <th className="px-4 py-3 text-zinc-400 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            : proxies.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No proxies</td></tr>
            : proxies.map((p) => (
              <tr key={p.id} className="border-b border-[#2a2a2a]">
                <td className="px-4 py-3 text-white font-mono">{p.ipAddress}:{p.port}</td>
                <td className="px-4 py-3 text-zinc-300 uppercase">{p.protocol}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${p.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{p.status}</span></td>
                <td className="px-4 py-3 text-zinc-400">{p.speedMs ? `${p.speedMs}ms` : "-"}</td>
                <td className="px-4 py-3">
                  <select value={p.assignedToPlan} onChange={(e) => handleAssignPlan(p.id, e.target.value)}
                    className="px-2 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-white text-xs">
                    <option value="all">All</option>
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="agency">Agency</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-zinc-400">{p.currentUsers}/{p.maxConcurrentUsers}</td>
                <td className="px-4 py-3"><button onClick={() => handleDelete(p.id)} className="text-zinc-400 hover:text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Add Proxy</h3>
              <button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-zinc-400 text-sm">IP Address</label>
                  <input value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} placeholder="192.168.1.1"
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="text-zinc-400 text-sm">Port</label>
                  <input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="8080"
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-sm">Protocol</label>
                  <select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm">
                    <option value="http">HTTP</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 text-sm">Assign to Plan</label>
                  <select value={form.assignedToPlan} onChange={(e) => setForm({ ...form, assignedToPlan: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm">
                    <option value="all">All Plans</option>
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="agency">Agency</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-sm">Username (optional)</label>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="text-zinc-400 text-sm">Password (optional)</label>
                  <input type="password" value={form.passwordEncrypted} onChange={(e) => setForm({ ...form, passwordEncrypted: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
                </div>
              </div>
              <button onClick={handleAdd} className="w-full py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">Add Proxy</button>
            </div>
          </div>
        </div>
      )}

      {showBulk && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowBulk(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Bulk Import (ip:port:user:pass)</h3>
              <button onClick={() => setShowBulk(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={10} placeholder={"192.168.1.1:8080:user:pass\n10.0.0.1:3128:\n172.16.0.1:1080:admin:secret"}
              className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm font-mono" />
            <button onClick={handleBulk} className="w-full mt-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">Import</button>
          </div>
        </div>
      )}
    </div>
  );
}
