import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { countries } from "../../data/countries";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(countries.find((c) => c.code === "PK") || countries[0]);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (!name.trim() || !email.trim() || !whatsappNumber.trim() || !password || !confirmPassword) { setError("All fields are required"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    const fullNumber = `${selectedCountry.dialCode}${whatsappNumber.replace(/\D/g, "")}`;
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(fullNumber)) { setError("Invalid WhatsApp number"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), whatsappNumber: fullNumber, country: selectedCountry.code, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); setLoading(false); return; }
      localStorage.setItem("vf_token", data.token);
      localStorage.setItem("vf_user", JSON.stringify(data.user));
      navigate("/select-plan", { replace: true });
    } catch (err: any) {
      setError(err.message || "Registration failed");
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
          <h2 className="text-lg font-semibold text-white mb-1">Create Account</h2>
          <p className="text-sm text-zinc-500 mb-6">Start your free automation journey</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors" required />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors" required />

            <div className="flex gap-2">
              <select value={selectedCountry.code} onChange={(e) => setSelectedCountry(countries.find((c) => c.code === e.target.value) || countries[0])}
                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors w-[140px] shrink-0">
                {countries.map((c) => (<option key={c.code} value={c.code}>{c.flag} {c.dialCode}</option>))}
              </select>
              <input type="tel" placeholder="WhatsApp Number" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors" required />
            </div>

            <div className="relative">
              <input type={showPassword ? "text" : "password"} placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors pr-10" required minLength={6} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <input type={showPassword ? "text" : "password"} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors" required minLength={6} />

            <button type="submit" disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating Account...</> : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-4">
            Already have an account?{" "}
            <button onClick={() => navigate("/login")} className="text-violet-400 hover:text-violet-300 font-medium">Sign In</button>
          </p>
        </div>
      </div>
    </div>
  );
}
