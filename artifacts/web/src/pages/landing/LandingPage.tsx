import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Play, Zap, Sparkles, Settings, BarChart3, Clock } from "lucide-react";

const features = [
  { icon: Zap, title: "Auto YouTube Upload", desc: "Connect your channels and auto-upload with AI-optimized metadata. Your content goes live automatically." },
  { icon: Sparkles, title: "TikTok, IG & Facebook Sources", desc: "Fetch trending content automatically from your favorite creators. Never miss viral opportunities." },
  { icon: Settings, title: "AI SEO Generator", desc: "Generate viral titles, descriptions, and tags with Groq AI. Optimize for maximum reach." },
  { icon: BarChart3, title: "GCP Workspaces", desc: "Manage multiple GCP projects for unlimited YouTube quota. Scale without limits." },
  { icon: Clock, title: "Video Queue", desc: "Bulk upload, schedule, and manage your video pipeline. Stay organized and consistent." },
  { icon: Zap, title: "Proxy Rotation", desc: "Built-in proxy management to avoid rate limits. Upload faster and more reliably." },
];

const stats = [
  { value: "10K+", label: "Active Creators" },
  { value: "2M+", label: "Videos Automated" },
  { value: "99.9%", label: "Uptime Guarantee" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* ─── Navbar ─── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-indigo-500/25">VF</div>
            <span className="font-semibold text-white tracking-tight">ViralFlows</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/login")} className="text-sm text-[#94a3b8] hover:text-white transition-colors px-4 py-2">Sign In</button>
            <button onClick={() => navigate("/register")} className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/25">Start Growing Free</button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.15),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.1),transparent_60%)]" />

        <div className="relative max-w-7xl mx-auto px-6 w-full">
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
            {/* Left: Text */}
            <div className="flex-1 pt-24 md:pt-0 text-center md:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
                Your content.{" "}
                <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">On YouTube.</span>
                <br />
                <span>Automatically.</span>
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-[#cbd5e1] max-w-xl leading-relaxed animate-fade-in delay-200">
                Stop managing. Start growing. Auto-post from TikTok, Instagram &amp; Facebook to YouTube with AI-powered SEO optimization. Scale your channel on autopilot.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 animate-fade-in delay-400">
                <button onClick={() => navigate("/register")} className="group bg-gradient-to-r from-[#ff6b35] to-[#e85d2c] hover:from-[#e85d2c] hover:to-[#d64d1a] text-white px-8 py-3.5 rounded-xl text-lg font-semibold transition-all shadow-xl shadow-[#ff6b35]/25 flex items-center gap-2">
                  Launch Your Autopilot
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="flex items-center gap-2 text-[#cbd5e1] hover:text-white px-6 py-3.5 rounded-xl border border-[#334155] hover:border-[#64748b] transition-all text-lg font-medium">
                  <Play className="w-5 h-5" />
                  Watch Demo
                </button>
              </div>

              <div className="mt-10 flex items-center gap-4 animate-fade-in delay-600">
                <div className="flex -space-x-3">
                  {["from-pink-500", "from-indigo-500", "from-cyan-500"].map((g, i) => (
                    <div key={i} className={`w-10 h-10 rounded-full bg-gradient-to-br ${g} to-${g === "from-pink-500" ? "rose-600" : g === "from-indigo-500" ? "indigo-600" : "cyan-600"} border-2 border-[#0f172a] flex items-center justify-center text-xs font-bold text-white`}>
                      {["A", "M", "K"][i]}
                    </div>
                  ))}
                </div>
                <span className="text-[#94a3b8] text-sm">Join <span className="text-white font-semibold">10K+ creators</span> growing on autopilot</span>
              </div>
            </div>

            {/* Right: Floating Illustration (Desktop only) */}
            <div className="hidden md:block flex-1 relative">
              <div className="relative w-full aspect-square max-w-lg mx-auto animate-float">
                {/* Background glow */}
                <div className="w-72 h-72 lg:w-96 lg:h-96 rounded-full bg-gradient-to-br from-indigo-500/20 via-cyan-500/10 to-transparent blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

                {/* Desk scene */}
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="w-64 h-64 lg:w-80 lg:h-80 rounded-[2rem] bg-gradient-to-br from-indigo-500/5 via-cyan-500/5 to-transparent border border-white/5 backdrop-blur-sm flex items-center justify-center relative overflow-hidden">

                    {/* Person silhouette */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-b from-slate-400/15 to-slate-500/5" />
                      <div className="w-24 h-20 rounded-t-[30px] bg-gradient-to-b from-slate-400/10 to-slate-500/5 -mt-2" />
                    </div>

                    {/* Monitors row */}
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-end gap-2.5 z-10">
                      {/* Monitor 1 */}
                      <div className="flex flex-col items-center">
                        <div className="w-14 h-11 lg:w-16 lg:h-12 rounded-md bg-slate-800/90 border border-slate-600/40 p-1.5 flex flex-col gap-1">
                          <div className="h-1 w-full rounded bg-gradient-to-r from-indigo-400 to-indigo-500 animate-screen-pulse" />
                          <div className="h-1 w-3/4 rounded bg-slate-600/30" />
                          <div className="h-1 w-1/2 rounded bg-slate-600/30" />
                        </div>
                        <div className="w-0.5 h-2.5 bg-slate-600/40" />
                        <div className="w-3.5 h-0.5 rounded-full bg-slate-600/40" />
                      </div>

                      {/* Monitor 2 - Center (main) */}
                      <div className="flex flex-col items-center -mb-1">
                        <div className="w-[4.5rem] h-14 lg:w-20 lg:h-[3.75rem] rounded-md bg-slate-800/90 border border-slate-600/40 p-1.5 flex flex-col gap-1">
                          <div className="flex gap-1 h-full">
                            <div className="flex-1 flex flex-col gap-1">
                              <div className="h-1 w-full rounded bg-gradient-to-r from-cyan-400 to-cyan-500 animate-screen-pulse" />
                              <div className="h-1 w-2/3 rounded bg-slate-600/30" />
                              <div className="flex-1 flex items-end gap-px pt-1">
                                {[60,80,40,90,55].map((h,i) => (
                                  <div key={i} className="w-1 bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t" style={{height:`${h}%`}} />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-0.5 h-3 bg-slate-600/40" />
                        <div className="w-4 h-0.5 rounded-full bg-slate-600/40" />
                      </div>

                      {/* Monitor 3 */}
                      <div className="flex flex-col items-center">
                        <div className="w-14 h-11 lg:w-16 lg:h-12 rounded-md bg-slate-800/90 border border-slate-600/40 p-1.5 flex flex-col gap-1">
                          <div className="flex gap-px h-full items-end">
                            {[50,70,30,85,45].map((h,i) => (
                              <div key={i} className="w-1 bg-gradient-to-t from-[#ff6b35] to-orange-400 rounded-t" style={{height:`${h}%`}} />
                            ))}
                          </div>
                        </div>
                        <div className="w-0.5 h-2.5 bg-slate-600/40" />
                        <div className="w-3.5 h-0.5 rounded-full bg-slate-600/40" />
                      </div>
                    </div>

                    {/* Desk surface */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-1.5 bg-gradient-to-r from-indigo-500/40 via-cyan-500/40 to-indigo-500/40 rounded-full blur-[1px]" />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-[3px] bg-gradient-to-r from-indigo-400/60 via-cyan-400/50 to-indigo-400/60 rounded-full" />

                    {/* Floating label */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/30 backdrop-blur-sm whitespace-nowrap">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" />
                        <span className="text-xs lg:text-sm text-[#cbd5e1] font-medium">AI-Powered Automation</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="relative py-24 lg:py-32 features-gradient">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white">Everything you need to scale</h2>
            <p className="mt-4 text-lg text-[#cbd5e1] max-w-2xl mx-auto">Powerful automation tools built for creators who want to focus on content, not management.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="group relative bg-[#1a2847]/60 backdrop-blur-sm border border-[#334155]/40 rounded-xl p-6 transition-all duration-300 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/0 via-transparent to-cyan-500/0 group-hover:from-indigo-500/10 group-hover:to-cyan-500/10 transition-all duration-300 pointer-events-none" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feat.title}</h3>
                    <p className="text-sm text-[#cbd5e1] leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-16 lg:py-20 border-y border-[#1e293b]/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">{stat.value}</div>
                <div className="mt-2 text-sm text-[#94a3b8] font-medium uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24 lg:py-32">
        <div className="absolute inset-0 cta-gradient" />
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white">Ready to automate your growth?</h2>
          <p className="mt-4 text-lg text-[#cbd5e1] max-w-xl mx-auto">Start free. Scale your YouTube channel on autopilot today.</p>
          <div className="mt-8">
            <button onClick={() => navigate("/register")} className="group bg-gradient-to-r from-[#ff6b35] to-[#e85d2c] hover:from-[#e85d2c] hover:to-[#d64d1a] text-white px-8 py-3.5 rounded-xl text-lg font-semibold transition-all shadow-xl shadow-[#ff6b35]/25 inline-flex items-center gap-2">
              Start Growing Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#1e293b]/50 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white text-xs">VF</div>
            <span className="font-semibold text-white text-sm">ViralFlows</span>
          </div>
          <p className="text-sm text-[#64748b]">&copy; 2026 ViralFlows. All rights reserved.</p>
          <div className="flex items-center gap-6">
            {["Privacy", "Terms", "Contact"].map((link) => (
              <button key={link} className="text-sm text-[#94a3b8] hover:text-white transition-colors">{link}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
