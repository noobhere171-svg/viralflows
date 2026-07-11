import { useQuery } from "@tanstack/react-query";
import { Wifi, WifiOff, Globe } from "lucide-react";
import api from "../../lib/api";

export default function ProxiesPage() {
  const { data, isLoading } = useQuery<{ assigned: boolean; proxy?: any }>({
    queryKey: ["assigned-proxy"],
    queryFn: () => api.get("/proxies/assigned"),
    refetchInterval: 30000,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Proxy</h1>
      </div>

      {isLoading ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 text-center">
          <div className="animate-pulse text-zinc-500">Loading...</div>
        </div>
      ) : data?.assigned && data.proxy ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {["Protocol", "Host", "Port", "Status", "Country", "Speed", "Used For"].map((h) => (
                  <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#2a2a2a]">
                <td className="px-4 py-3 text-sm text-zinc-400 uppercase">{data.proxy.protocol}</td>
                <td className="px-4 py-3 text-sm text-white font-mono">{data.proxy.ipAddress}</td>
                <td className="px-4 py-3 text-sm text-zinc-400 font-mono">{data.proxy.port}</td>
                <td className="px-4 py-3">
                  {data.proxy.status ? (
                    <span className={`text-xs font-medium flex items-center gap-1 ${data.proxy.status === 'active' ? 'text-green-500' : 'text-red-400'}`}>
                      {data.proxy.status === 'active' ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {data.proxy.status === 'active' ? "Alive" : "Dead"}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">Untested</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-zinc-300 flex items-center gap-1">
                    <Globe size={12} className="text-zinc-500" />
                    {data.proxy.country || "-"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-500">{data.proxy.speedMs ? `${data.proxy.speedMs}ms` : "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 text-xs">
                    {data.proxy.useForFetch !== false && <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded">Fetch</span>}
                    {data.proxy.useForDownload !== false && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">Download</span>}
                    {data.proxy.useForUpload && <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded">Upload</span>}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="px-4 py-3 bg-[#0f0f0f] border-t border-[#2a2a2a]">
            <p className="text-xs text-zinc-500">Proxy assigned by admin based on your plan. Contact admin for changes.</p>
          </div>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 text-center">
          <WifiOff size={32} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No proxy assigned to your plan</p>
          <p className="text-zinc-600 text-xs mt-1">Contact admin to get a proxy for your account</p>
        </div>
      )}
    </div>
  );
}
