import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email");

  const [email, setEmail] = useState(emailParam || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="w-full max-w-md p-6">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white">VF</div>
            <span className="text-xl font-semibold text-white">ViralFlows</span>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
            <button onClick={() => navigate("/login")} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm mb-4 transition-colors">
              <ArrowLeft size={16} /> Back to Login
            </button>
            <h2 className="text-lg font-semibold text-white mb-1">Forgot Password?</h2>
            <p className="text-sm text-zinc-500 mb-6">Enter your email and we'll send you a reset link.</p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
                <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}

            {!success && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                if (!email.trim()) { setError("Email is required"); return; }
                setLoading(true);
                try {
                  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: email.trim().toLowerCase() }),
                  });
                  const data = await res.json();
                  if (!res.ok) { setError(data.error || "Failed"); setLoading(false); return; }
                  setSuccess("If an account with that email exists, a password reset link has been sent.");
                } catch (err: any) {
                  setError(err.message || "Failed");
                } finally {
                  setLoading(false);
                }
              }} className="space-y-3">
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors" required />

                <button type="submit" disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : "Send Reset Link"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-full max-w-md p-6">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white">VF</div>
          <span className="text-xl font-semibold text-white">ViralFlows</span>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Set New Password</h2>
          <p className="text-sm text-zinc-500 mb-6">Enter your new password below.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 mb-4">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {!success ? (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
              if (password !== confirmPassword) { setError("Passwords do not match"); return; }
              setLoading(true);
              try {
                const res = await fetch(`${API_BASE}/auth/reset-password`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token, password }),
                });
                const data = await res.json();
                if (!res.ok) { setError(data.error || "Failed"); setLoading(false); return; }
                setSuccess("Password has been reset successfully!");
              } catch (err: any) {
                setError(err.message || "Failed");
              } finally {
                setLoading(false);
              }
            }} className="space-y-3">
              <input type="password" placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors" required />

              <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors" required />

              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Resetting...</> : "Reset Password"}
              </button>
            </form>
          ) : (
            <button onClick={() => navigate("/login")}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
              Go to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
