import { useQuery } from "@tanstack/react-query";
import { Gift, Copy, Share2, Users, DollarSign, Check } from "lucide-react";
import api from "../../lib/api";
import type { Referral } from "../../types";
import { useState } from "react";

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);

  const { data: raw } = useQuery<any>({
    queryKey: ["referrals"],
    queryFn: () => api.get("/referrals"),
  });
  const referrals: Referral[] = raw?.referrals || [];
  const referralLink = raw?.link || `${window.location.origin}/register?ref=code`;
  const referralCode = raw?.code || "YOURCODE";

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: "Join ViralFlows", url: referralLink }).catch(() => {});
    } else {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalEarnings = referrals.reduce((sum, r) => sum + Number((r as any).reward_amount || 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Referrals</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: Gift, label: "Referral Code", value: referralCode },
          { icon: Users, label: "Total Referrals", value: referrals.length },
          { icon: DollarSign, label: "Earnings", value: `$${totalEarnings.toFixed(2)}` },
          { icon: DollarSign, label: "Pending Rewards", value: "$0.00" },
        ].map((s) => (
          <div key={s.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={16} className="text-indigo-400" />
              <span className="text-sm text-zinc-400">{s.label}</span>
            </div>
            <div className="text-lg font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 mb-6">
        <h3 className="text-white font-semibold mb-2">Share Your Referral Link</h3>
        <p className="text-sm text-zinc-500 mb-4">Earn 10% of your referral's subscription for 12 months</p>
        <div className="flex items-center gap-2">
          <input className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white font-mono" value={referralLink} readOnly />
          <button onClick={copyLink} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button onClick={shareLink} className="bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-400 hover:text-white p-2 rounded-lg transition-colors" title="Share">
            <Share2 size={16} />
          </button>
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              {["Referred User", "Date", "Status", "Reward"].map((h) => (
                <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {referrals.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No referrals yet. Share your link!</td></tr>
            ) : referrals.map((r) => (
              <tr key={r.id} className="border-b border-[#2a2a2a]">
                <td className="px-4 py-3 text-sm text-white">-</td>
                <td className="px-4 py-3 text-sm text-zinc-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${r.status === "paid" ? "text-green-500 border-green-500/20" : r.status === "pending" ? "text-amber-400 border-amber-400/20" : "text-zinc-500 border-zinc-500/20"}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-white">${Number((r as any).reward_amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
