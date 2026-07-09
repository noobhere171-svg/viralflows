import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check, X, Wifi, WifiOff, Play } from "lucide-react";
import api from "../../lib/api";
import type { Proxy } from "../../types";

export default function ProxiesPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ host: "", port: "", username: "", password: "", protocol: "http" });
  const [error, setError] = useState<string | null>(null);

  const { data: proxies = [] } = useQuery<Proxy[]>({
    queryKey: ["proxies"],
    queryFn: () => api.get("/proxies"),
  });

  const addMutation = useMutation({
    mutationFn: () => api.post("/proxies", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["proxies"] }); setShowAdd(false); setError(null); },
    onError: (err: any) => setError(err?.error || err?.message || "Failed to add proxy"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/proxies/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["proxies"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/proxies/${id}/test`),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Proxies</h1>
        <button onClick={() => setShowAdd(true)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <Plus size={16} /> Add Proxy
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Proxy</h2>
              <button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <select className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
                <option value="http">HTTP</option>
                <option value="socks4">SOCKS4</option>
                <option value="socks5">SOCKS5</option>
              </select>
              <input placeholder="Host / IP" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
              <input placeholder="Port" type="number" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
              <input placeholder="Username (optional)" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <input placeholder="Password (optional)" type="password" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button onClick={() => addMutation.mutate()} className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-lg text-sm font-medium">Add</button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <X size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-white"><X size={14} /></button>
        </div>
      )}

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              {["Protocol", "Host", "Port", "Status", "Speed", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proxies.map((p) => (
              <tr key={p.id} className="border-b border-[#2a2a2a] hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-sm text-zinc-400 uppercase">{p.protocol}</td>
                <td className="px-4 py-3 text-sm text-white font-mono">{(p as any).ipAddress || p.host}</td>
                <td className="px-4 py-3 text-sm text-zinc-400 font-mono">{p.port}</td>
                <td className="px-4 py-3">
                  {p.status ? (
                    <span className={`text-xs font-medium flex items-center gap-1 ${p.status === 'active' ? 'text-green-500' : 'text-red-400'}`}>
                      {p.status === 'active' ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {p.status === 'active' ? "Alive" : "Dead"}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">Untested</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-500">{(p as any).speedMs ? `${(p as any).speedMs}ms` : "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => testMutation.mutate(p.id)} className="text-zinc-400 hover:text-violet-400" title="Test Proxy"><Play size={14} /></button>
                    <button onClick={() => { if (window.confirm("Delete this proxy?")) deleteMutation.mutate(p.id); }} className="text-zinc-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
