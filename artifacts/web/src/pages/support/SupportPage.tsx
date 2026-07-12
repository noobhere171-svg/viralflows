import { useState } from "react";
import { MessageSquare, Send, Search, HelpCircle, Book, Mail, Check } from "lucide-react";
import api from "../../lib/api";

const faqs = [
  { q: "How do I import a YouTube channel?", a: "Go to Channels > Import Channels and enter your YouTube Channel ID or URL." },
  { q: "How do I set up YouTube OAuth?", a: "Create a GCP Project, enable YouTube Data API v3, download client_secret.json, then upload it in Workspaces." },
  { q: "Why are my uploads failing?", a: "Check your YouTube API quota at Google Cloud Console. Each channel has 10,000 units/day." },
  { q: "How do I add TikTok sources?", a: "Go to Sources > Add Source and paste the TikTok profile URL or @handle." },
  { q: "Can I use my own proxies?", a: "Yes, go to Proxies to add HTTP/SOCKS proxies for source scraping." },
];

export default function SupportPage() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [search, setSearch] = useState("");

  const filteredFaqs = faqs.filter(f => f.q.toLowerCase().includes(search.toLowerCase()));

  const sendMessage = async () => {
    if (!message.trim()) return;
    try { await api.post("/support/tickets", { subject: "Support Request", description: message }); } catch {}
    setSent(true);
    setMessage("");
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Help & Support</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Book, label: "Documentation", desc: "Read the full API and user guide" },
          { icon: MessageSquare, label: "Community", desc: "Join our Discord for help" },
          { icon: Mail, label: "Email Us", desc: "support@viralflows.ai" },
        ].map((c) => (
          <div key={c.label} onClick={() => {
            if (c.label === "Email Us") window.location.href = "mailto:support@viralflows.ai";
            else if (c.label === "Community") window.open("https://discord.gg/viralflows", "_blank");
            else window.open("https://github.com/viralflows/docs", "_blank");
          }} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 text-center hover:border-indigo-500/30 transition-colors cursor-pointer">
            <c.icon size={24} className="text-indigo-400 mx-auto mb-2" />
            <h3 className="text-white font-medium text-sm">{c.label}</h3>
            <p className="text-xs text-zinc-500 mt-1">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">FAQ</h3>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500" placeholder="Search FAQs..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          {filteredFaqs.map((faq) => (
            <details key={faq.q} className="bg-[#0f0f0f] rounded-lg overflow-hidden">
              <summary className="px-4 py-2.5 text-sm text-white cursor-pointer hover:bg-white/[0.02]">{faq.q}</summary>
              <p className="px-4 pb-2.5 text-sm text-zinc-400">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Contact Form */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Send Us a Message</h3>
        <textarea className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 resize-none h-24" placeholder="Describe your issue..." value={message} onChange={(e) => setMessage(e.target.value)} />
        <button onClick={sendMessage} className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          {sent ? <Check size={14} /> : <Send size={14} />}
          {sent ? "Sent!" : "Send Message"}
        </button>
      </div>
    </div>
  );
}


