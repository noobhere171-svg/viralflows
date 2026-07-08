import { useNavigate } from "react-router-dom";
import { BarChart3, Youtube, Share2, Globe, Shield, ListVideo } from "lucide-react";

const steps = [
  { num: 1, title: "Import Channels", desc: "Add your YouTube channels with source accounts and workspace emails", cta: "Import Channels", route: "/channels", icon: Youtube },
  { num: 2, title: "Upload OAuth Files", desc: "Upload client_secret JSON files for each workspace to enable YouTube API access", cta: "Go to Workspaces", route: "/workspaces", icon: Shield },
  { num: 3, title: "Auto-Assign GCP", desc: "Let the system create GCP projects and assign channels automatically", cta: "Auto-Assign", route: "/workspaces", icon: Globe },
  { num: 4, title: "Authorize", desc: "Authorize each GCP project with Google to enable uploads", cta: "Authorize", route: "/workspaces", icon: Share2 },
  { num: 5, title: "Add Sources", desc: "Connect TikTok, Instagram, or Facebook accounts to automatically fetch viral content", cta: "Add Sources", route: "/sources", icon: Share2 },
  { num: 6, title: "Start Uploading", desc: "Activate your first workflow and begin auto-uploading to YouTube", cta: "Go to Queue", route: "/video-queue", icon: ListVideo },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Nav */}
      <div className="border-b border-[#2a2a2a]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-orange-500 flex items-center justify-center font-bold text-white text-sm">VF</div>
            <span className="font-semibold text-white">ViralFlows</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/login")} className="text-sm text-zinc-400 hover:text-white transition-colors">Sign In</button>
            <button onClick={() => navigate("/register")} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Get Started Free</button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold text-white mb-6">
          AI-Powered YouTube<br />
          <span className="text-violet-500">Automation Platform</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-8">
          Auto-post from TikTok & Instagram to YouTube. Generate AI-powered SEO descriptions & tags. 
          Discover trending creators and grow your channel on autopilot.
        </p>
        <button onClick={() => navigate("/register")} className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-xl text-lg font-medium transition-colors">
          Start Free — No Credit Card
        </button>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-3 gap-6">
          {[
            { icon: Youtube, title: "Auto YouTube Upload", desc: "Connect your channels and auto-upload with AI-optimized metadata" },
            { icon: Share2, title: "TikTok & IG Sources", desc: "Fetch trending content automatically from your favorite creators" },
            { icon: BarChart3, title: "AI SEO Generator", desc: "Generate viral titles, descriptions, and tags with Groq AI" },
            { icon: Globe, title: "GCP Workspaces", desc: "Manage multiple GCP projects for unlimited YouTube quota" },
            { icon: Shield, title: "Proxy Rotation", desc: "Built-in proxy management to avoid rate limits" },
            { icon: ListVideo, title: "Smart Queue", desc: "Bulk upload, schedule, and manage your video pipeline" },
          ].map((feat) => (
            <div key={feat.title} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 card-hover">
              <feat.icon className="text-violet-500 mb-4" size={24} />
              <h3 className="text-white font-semibold mb-2">{feat.title}</h3>
              <p className="text-zinc-400 text-sm">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#2a2a2a] py-8 text-center text-sm text-zinc-600">
        ViralFlows — AI-Powered YouTube Automation
      </div>
    </div>
  );
}
