import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { countries } from "../../data/countries";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export default function AccountSetupPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(countries.find((c) => c.code === "PK") || countries[0]);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("vf_token");
    if (!token) {
      navigate("/login");
      return;
    }

    const checkSetup = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.user?.accountSetupComplete) {
          navigate("/dashboard");
          return;
        }

        if (data.user?.name) setName(data.user.name);
        if (data.user?.email) setEmail(data.user.email);
      } catch {
      } finally {
        setCheckingSetup(false);
      }
    };

    checkSetup();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Name is required"); return; }
    if (!whatsappNumber.trim()) { setError("WhatsApp number is required"); return; }

    const fullNumber = `${selectedCountry.dialCode}${whatsappNumber.replace(/\D/g, "")}`;
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(fullNumber)) { setError("Invalid WhatsApp number"); return; }

    setLoading(true);
    try {
      const token = localStorage.getItem("vf_token");
      const res = await fetch(`${API_BASE}/auth/account-setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          whatsappNumber: fullNumber,
          country: selectedCountry.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Setup failed"); setLoading(false); return; }

      localStorage.setItem("vf_user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="animate-spin text-violet-500" size={32} />
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
          <h2 className="text-lg font-semibold text-white mb-1">Complete Your Profile</h2>
          <p className="text-sm text-zinc-500 mb-6">Just a few details to get you started</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Full Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
              required
            />

            {email && (
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-zinc-500 cursor-not-allowed"
              />
            )}

            <select
              value={selectedCountry.code}
              onChange={(e) => setSelectedCountry(countries.find((c) => c.code === e.target.value) || countries[0])}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.dialCode})</option>
              ))}
            </select>

            <div className="flex gap-2">
              <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-zinc-400 w-[90px] shrink-0 flex items-center">
                {selectedCountry.dialCode}
              </div>
              <input
                type="tel"
                placeholder="WhatsApp Number *"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Complete Setup"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
