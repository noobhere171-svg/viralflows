import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
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

const avatarGradients = ["from-pink-500 to-rose-600", "from-indigo-500 to-indigo-600", "from-cyan-500 to-cyan-600"];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const statVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const featuresRef = useRef(null);
  const statsRef = useRef(null);
  const ctaRef = useRef(null);
  const featuresInView = useInView(featuresRef, { once: true, margin: "-100px" });
  const statsInView = useInView(statsRef, { once: true, margin: "-100px" });
  const ctaInView = useInView(ctaRef, { once: true, margin: "-100px" });

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
            <button onClick={() => navigate("/login")} className="text-sm text-[#cbd5e1] hover:text-white transition-colors px-4 py-2">Sign In</button>
            <button onClick={() => navigate("/register")} className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/25">Start Growing Free</button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.2),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.15),transparent_60%)]" />

        <div className="relative max-w-7xl mx-auto px-6 w-full">
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
            {/* Left: Text */}
            <div className="flex-1 pt-24 md:pt-0 text-center md:text-left">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight"
              >
                Your content.{" "}
                <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">On YouTube.</span>
                <br />
                <span>Automatically.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
                className="mt-6 text-lg sm:text-xl text-[#e2e8f0] max-w-xl leading-relaxed"
              >
                Stop managing. Start growing. Auto-post from TikTok, Instagram &amp; Facebook to YouTube with AI-powered SEO optimization. Scale your channel on autopilot.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                className="mt-8 flex flex-col sm:flex-row items-center gap-4"
              >
                <button onClick={() => navigate("/register")} className="group bg-gradient-to-r from-[#ff6b35] to-[#e85d2c] hover:from-[#e85d2c] hover:to-[#d64d1a] text-white px-8 py-3.5 rounded-xl text-lg font-semibold transition-all shadow-xl shadow-[#ff6b35]/35 flex items-center gap-2">
                  Launch Your Autopilot
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="flex items-center gap-2 text-[#cbd5e1] hover:text-white px-6 py-3.5 rounded-xl border border-[#475569] hover:border-[#64748b] transition-all text-lg font-medium">
                  <Play className="w-5 h-5" />
                  Watch Demo
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
                className="mt-10 flex items-center gap-4"
              >
                <div className="flex -space-x-3">
                  {avatarGradients.map((g, i) => (
                    <div key={i} className={`w-10 h-10 rounded-full bg-gradient-to-br ${g} border-2 border-[#0f172a] flex items-center justify-center text-xs font-bold text-white`}>
                      {["A", "M", "K"][i]}
                    </div>
                  ))}
                </div>
                <span className="text-[#cbd5e1] text-sm">Join <span className="text-white font-semibold">10K+ creators</span> growing on autopilot</span>
              </motion.div>
            </div>

            {/* Right: SVG Illustration (Desktop only) */}
            <div className="hidden md:block flex-1 relative">
              <div className="relative w-full aspect-square max-w-lg mx-auto">
                <div className="absolute inset-0 animate-float">
                  {/* Background glow */}
                  <div className="w-72 h-72 lg:w-96 lg:h-96 rounded-full bg-gradient-to-br from-indigo-500/25 via-cyan-500/15 to-transparent blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="w-64 h-64 lg:w-80 lg:h-80 rounded-[2rem] bg-gradient-to-br from-indigo-500/10 via-cyan-500/5 to-transparent border border-white/5 backdrop-blur-sm flex items-center justify-center relative overflow-hidden">
                      <svg viewBox="0 0 500 420" className="w-full h-full">
                        <defs>
                          <linearGradient id="deskGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
                            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.45" />
                          </linearGradient>
                          <linearGradient id="screenGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
                          </linearGradient>
                          <linearGradient id="centerChart1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#4f46e5" />
                          </linearGradient>
                          <linearGradient id="centerChart2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#0891b2" />
                          </linearGradient>
                          <linearGradient id="centerChart3" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ff6b35" />
                            <stop offset="100%" stopColor="#e85d2c" />
                          </linearGradient>
                          <linearGradient id="leftMonitorLine" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#4f46e5" />
                          </linearGradient>
                          <linearGradient id="rightBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ff6b35" />
                            <stop offset="100%" stopColor="#e85d2c" />
                          </linearGradient>
                          <filter id="screenGlowFilter">
                            <feGaussianBlur stdDeviation="1.5" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {/* Person silhouette (behind desk) */}
                        <g opacity="0.25">
                          {/* Head */}
                          <ellipse cx="250" cy="295" rx="20" ry="24" fill="#94a3b8" />
                          {/* Body */}
                          <path d="M215 340 Q230 310 250 310 Q270 310 285 340 L288 380 Q250 370 212 380 Z" fill="#94a3b8" />
                        </g>

                        {/* Desk */}
                        <rect x="50" y="342" width="400" height="7" rx="3.5" fill="url(#deskGrad)" />
                        <rect x="60" y="349" width="380" height="2" rx="1" fill="#000" fillOpacity="0.3" />

                        {/* Left Monitor */}
                        <g>
                          <rect x="110" y="268" width="76" height="60" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1" />
                          <rect x="112" y="270" width="72" height="56" rx="3" fill="url(#screenGlow)" />
                          <rect x="118" y="280" width="58" height="4" rx="1" fill="url(#leftMonitorLine)" filter="url(#screenGlowFilter)" />
                          <rect x="118" y="290" width="44" height="3" rx="1" fill="#475569" />
                          <rect x="118" y="299" width="50" height="3" rx="1" fill="#475569" />
                          <rect x="118" y="308" width="30" height="3" rx="1" fill="#475569" />
                          <rect x="143" y="328" width="10" height="12" rx="1" fill="#334155" />
                          <rect x="132" y="340" width="32" height="3" rx="1.5" fill="#334155" />
                        </g>

                        {/* Right Monitor */}
                        <g>
                          <rect x="314" y="268" width="76" height="60" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1" />
                          <rect x="316" y="270" width="72" height="56" rx="3" fill="url(#screenGlow)" />
                          <rect x="324" y="306" width="8" height="14" rx="1" fill="url(#rightBar)" filter="url(#screenGlowFilter)" />
                          <rect x="337" y="296" width="8" height="24" rx="1" fill="url(#rightBar)" filter="url(#screenGlowFilter)" />
                          <rect x="350" y="302" width="8" height="18" rx="1" fill="url(#rightBar)" filter="url(#screenGlowFilter)" />
                          <rect x="363" y="290" width="8" height="30" rx="1" fill="url(#rightBar)" filter="url(#screenGlowFilter)" />
                          <rect x="376" y="298" width="8" height="22" rx="1" fill="url(#rightBar)" />
                          <rect x="347" y="328" width="10" height="12" rx="1" fill="#334155" />
                          <rect x="336" y="340" width="32" height="3" rx="1.5" fill="#334155" />
                        </g>

                        {/* Center Monitor (larger) */}
                        <g>
                          <rect x="195" y="250" width="110" height="80" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1" />
                          <rect x="197" y="252" width="106" height="76" rx="4" fill="url(#screenGlow)" />
                          {/* Chart bars */}
                          <rect x="207" y="292" width="10" height="28" rx="1.5" fill="url(#centerChart1)" filter="url(#screenGlowFilter)" />
                          <rect x="221" y="278" width="10" height="42" rx="1.5" fill="url(#centerChart2)" filter="url(#screenGlowFilter)" />
                          <rect x="235" y="296" width="10" height="24" rx="1.5" fill="url(#centerChart1)" filter="url(#screenGlowFilter)" />
                          <rect x="249" y="270" width="10" height="50" rx="1.5" fill="url(#centerChart2)" filter="url(#screenGlowFilter)" />
                          <rect x="263" y="286" width="10" height="34" rx="1.5" fill="url(#centerChart3)" filter="url(#screenGlowFilter)" />
                          <rect x="277" y="268" width="10" height="52" rx="1.5" fill="url(#centerChart1)" filter="url(#screenGlowFilter)" />
                          <rect x="291" y="294" width="10" height="26" rx="1.5" fill="url(#centerChart2)" />
                          {/* Monitor top bar */}
                          <rect x="215" y="256" width="70" height="4" rx="1" fill="#1e293b" />
                          <rect x="243" y="330" width="14" height="10" rx="1.5" fill="#334155" />
                          <rect x="232" y="340" width="36" height="3" rx="1.5" fill="#334155" />
                        </g>

                        <path d="M250 340 L250 360" stroke="#334155" strokeWidth="1" fill="none" />
                      </svg>

                      {/* AI-Powered Automation badge */}
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/70 border border-slate-700/40 backdrop-blur-sm whitespace-nowrap shadow-lg shadow-indigo-500/10">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" />
                          <span className="text-xs lg:text-sm text-[#e2e8f0] font-medium">AI-Powered Automation</span>
                        </div>
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
      <section className="relative py-24 lg:py-32 features-gradient" ref={featuresRef}>
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-white">Everything you need to scale</h2>
            <p className="mt-4 text-lg text-[#e2e8f0] max-w-2xl mx-auto">Powerful automation tools built for creators who want to focus on content, not management.</p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={featuresInView ? "visible" : "hidden"}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  variants={itemVariants}
                  className="group relative bg-[#0f1b33]/60 backdrop-blur-sm border border-[#334155]/40 rounded-xl p-6 transition-all duration-300 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5"
                >
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/0 via-transparent to-cyan-500/0 group-hover:from-indigo-500/10 group-hover:to-cyan-500/10 transition-all duration-300 pointer-events-none" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feat.title}</h3>
                    <p className="text-sm text-[#cbd5e1] leading-relaxed">{feat.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-16 lg:py-20 border-y border-[#1e293b]/50" ref={statsRef}>
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={statsInView ? "visible" : "hidden"}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
          >
            {stats.map((stat) => (
              <motion.div key={stat.label} variants={statVariants}>
                <div className="text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">{stat.value}</div>
                <div className="mt-2 text-sm text-[#cbd5e1] font-medium uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24 lg:py-32" ref={ctaRef}>
        <div className="absolute inset-0 cta-gradient" />
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-white">Ready to automate your growth?</h2>
            <p className="mt-4 text-lg text-[#e2e8f0] max-w-xl mx-auto">Start free. Scale your YouTube channel on autopilot today.</p>
            <div className="mt-8">
              <button onClick={() => navigate("/register")} className="group bg-gradient-to-r from-[#ff6b35] to-[#e85d2c] hover:from-[#e85d2c] hover:to-[#d64d1a] text-white px-8 py-3.5 rounded-xl text-lg font-semibold transition-all shadow-xl shadow-[#ff6b35]/35 inline-flex items-center gap-2">
                Start Growing Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
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
