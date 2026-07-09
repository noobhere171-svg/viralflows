import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("vf_token");
    if (token) {
      navigate("/dashboard", { replace: true });
      return;
    }
    setCheckingAuth(false);
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Email and password are required"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed"); setLoading(false); return; }
      localStorage.setItem("vf_token", data.token);
      localStorage.setItem("vf_user", JSON.stringify(data.user));
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-full max-w-md p-6">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-orange-500 flex items-center justify-center font-bold text-white">VF</div>
          <span className="text-xl font-semibold text-white">ViralFlows</span>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Welcome Back</h2>
          <p className="text-sm text-zinc-500 mb-6">Sign in to your account</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors" required />

            <div className="relative">
              <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors pr-10" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : "Sign In"}
            </button>

            <div className="text-center mt-2">
              <button type="button" onClick={() => navigate("/forgot-password")} className="text-sm text-zinc-500 hover:text-violet-400 transition-colors">
                Forgot Password?
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-4">
            Don't have an account?{" "}
            <button onClick={() => navigate("/register")} className="text-violet-400 hover:text-violet-300 font-medium">Create Account</button>
          </p>
        </div>
      </div>
    </div>
  );
}
