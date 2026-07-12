import { useState, useEffect } from "react";
import { User, Save, Loader2 } from "lucide-react";
import api from "../../lib/api";

export default function AccountPage() {
  const [profile, setProfile] = useState({ name: "", email: "", whatsappNumber: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/me").then((d) => {
      if (d.user) {
        setProfile({
          name: d.user.name || "",
          email: d.user.email || "",
          whatsappNumber: d.user.whatsappNumber || "",
          country: d.user.country || "",
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch("/account/profile", { name: profile.name });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Account Settings</h1>

      <div className="max-w-lg">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <User size={24} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-white font-medium">Profile</h3>
              <p className="text-sm text-zinc-500">Manage your account information</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">Full Name</label>
              <input className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500" placeholder="Full Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">Email</label>
              <input className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-zinc-500 cursor-not-allowed" type="email" value={profile.email} disabled />
            </div>
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">WhatsApp Number</label>
              <input className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-zinc-500 cursor-not-allowed" value={profile.whatsappNumber} disabled />
            </div>
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">Country</label>
              <input className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-zinc-500 cursor-not-allowed" value={profile.country} disabled />
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> {saved ? "Saved!" : "Save Changes"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
