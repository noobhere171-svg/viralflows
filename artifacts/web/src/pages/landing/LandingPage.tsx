import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Play, Zap, Sparkles, Cpu, BarChart3, Clock } from "lucide-react";

const features = [
  { icon: Zap, title: "Auto YouTube Upload", desc: "Connect your channels and auto-upload with AI-optimized metadata. Your content goes live automatically." },
  { icon: Sparkles, title: "TikTok & Instagram Sources", desc: "Fetch trending content automatically from your favorite creators. Never miss viral opportunities." },
  { icon: Cpu, title: "AI SEO Generator", desc: "Generate viral titles, descriptions, and tags with advanced AI. Optimize for maximum reach." },
  { icon: BarChart3, title: "GCP Workspaces", desc: "Manage multiple GCP projects for unlimited YouTube quota. Scale without limits." },
  { icon: Clock, title: "Smart Queue", desc: "Bulk upload, schedule, and manage your video pipeline. Stay organized and consistent." },
  { icon: Zap, title: "Proxy Rotation", desc: "Built-in proxy management to avoid rate limits. Upload faster and more reliably." },
];

const stats = [
  { value: "10K+", label: "Active Creators" },
  { value: "2M+", label: "Videos Automated" },
  { value: "99.9%", label: "Uptime Guarantee" },
];

const avatarColors = ["from-pink-500 to-rose-600", "from-indigo-500 to-indigo-600", "from-cyan-500 to-cyan-600"];
const avatarLetters = ["A", "M", "K"];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
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
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/login")} className="text-gray-300 hover:text-white transition-colors">Sign In</button>
            <button onClick={() => navigate("/register")} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-2 rounded-lg font-semibold transition-all shadow-lg shadow-orange-500/25">Start Growing Free</button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />

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
                className="mt-6 text-lg sm:text-xl text-gray-300 max-w-xl leading-relaxed"
              >
                Stop managing. Start growing. Auto-post from TikTok &amp; Instagram to YouTube with AI-powered SEO optimization. Scale your channel on autopilot.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                className="mt-8 flex flex-col sm:flex-row items-center gap-4"
              >
                <button onClick={() => navigate("/register")} className="group bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-3.5 rounded-xl text-lg font-semibold transition-all shadow-xl shadow-orange-500/35 flex items-center gap-2">
                  Launch Your Autopilot
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="flex items-center gap-2 text-gray-300 hover:text-white px-6 py-3.5 rounded-xl border border-slate-600 hover:border-slate-500 transition-all text-lg font-medium">
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
                <button onClick={() => navigate("/register")} className="flex -space-x-3 cursor-pointer">
                  {avatarColors.map((g, i) => (
                    <div key={i} className={`w-10 h-10 rounded-full bg-gradient-to-br ${g} border-2 border-[#0f172a] flex items-center justify-center text-xs font-bold text-white`}>
                      {avatarLetters[i]}
                    </div>
                  ))}
                </button>
                <button onClick={() => navigate("/register")} className="text-gray-300 text-sm hover:text-white transition-colors cursor-pointer">
                  Join <span className="text-white font-semibold">10K+ creators</span> growing on autopilot
                </button>
              </motion.div>
            </div>

            {/* Right: Animation Picture (floating gradient circles + emoji) */}
            <div className="hidden md:block flex-1 relative">
              <div className="relative w-full aspect-square max-w-lg mx-auto flex items-center justify-center">
                {/* Animated gradient circles */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 rounded-[3rem] blur-3xl animate-float" />
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-orange-500/20 rounded-[3rem] blur-3xl animate-float" style={{ animationDelay: "1s" }} />

                {/* Content card */}
                <div className="relative z-10 w-72 h-72 lg:w-80 lg:h-80 rounded-[2rem] bg-[#0f172a]/60 border border-white/5 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <div className="text-7xl lg:text-8xl">🎬</div>
                  <p className="text-gray-300 text-lg font-medium">Creator Automation</p>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/70 border border-slate-700/40">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" />
                    <span className="text-xs text-gray-200 font-medium">AI-Powered Automation</span>
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
            <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">Powerful automation tools built for creators who want to focus on content, not management.</p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={featuresInView ? "visible" : "hidden"}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  variants={itemVariants}
                  className="group p-6 rounded-xl border border-slate-700/50 bg-[#1A2847]/50 backdrop-blur hover:border-indigo-500/50 hover:bg-[#1A2847]/80 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">{feat.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{feat.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-16 lg:py-20 border-y border-slate-800/50" ref={statsRef}>
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={statsInView ? "visible" : "hidden"}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
          >
            {stats.map((stat) => (
              <motion.div key={stat.label} variants={itemVariants} className="space-y-2">
                <div className="text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">{stat.value}</div>
                <p className="text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24 lg:py-32 overflow-hidden" ref={ctaRef}>
        <div className="absolute inset-0 cta-gradient" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-orange-500/30 to-transparent rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="space-y-4 max-w-2xl mx-auto">
              <h2 className="text-3xl lg:text-4xl font-bold text-white">Ready to automate your growth?</h2>
              <p className="text-lg text-gray-300">Start free. No credit card required. Scale your YouTube channel on autopilot today.</p>
            </div>
            <button onClick={() => navigate("/register")} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-3.5 rounded-xl text-lg font-semibold transition-all shadow-xl shadow-orange-500/35 inline-flex items-center gap-2 group">
              Start Growing Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-800/50 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white text-xs">VF</div>
            <span className="font-semibold text-white">ViralFlows</span>
          </div>
          <p className="text-sm text-gray-400">&copy; 2026 ViralFlows. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <button onClick={() => navigate("/privacy")} className="text-gray-400 hover:text-white transition-colors">Privacy</button>
            <button onClick={() => navigate("/terms")} className="text-gray-400 hover:text-white transition-colors">Terms</button>
            <button onClick={() => navigate("/support")} className="text-gray-400 hover:text-white transition-colors">Contact</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
