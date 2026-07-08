import { useState, useEffect } from "react";
import { Palette, Globe, Database, Download, Shield, Loader2 } from "lucide-react";
import api from "../../lib/api";

const STORAGE_KEY = "vf_settings";

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export default function SettingsPage() {
  const saved = loadSettings();
  const [theme, setTheme] = useState(saved.theme || "dark");
  const [lang, setLang] = useState(saved.lang || "en");
  const [defaultPriority, setDefaultPriority] = useState(saved.defaultPriority || "normal");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const saveSettings = () => {
    setSaving(true);
    const settings = { theme, lang, defaultPriority };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setTimeout(() => { setSaving(false); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); }, 500);
  };

  const sections = [
    {
      icon: Palette, title: "Appearance",
      items: [
        { label: "Theme", control: <select className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2 py-1 text-xs text-white" value={theme} onChange={(e) => setTheme(e.target.value)}><option value="dark">Dark</option><option value="light">Light</option></select> },
      ],
    },
    {
      icon: Globe, title: "Regional",
      items: [
        { label: "Language", control: <select className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2 py-1 text-xs text-white" value={lang} onChange={(e) => setLang(e.target.value)}><option value="en">English</option><option value="ur">Urdu</option><option value="es">Spanish</option></select> },
      ],
    },
    {
      icon: Database, title: "Defaults",
      items: [
        { label: "Default Priority", control: <select className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2 py-1 text-xs text-white" value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select> },
      ],
    },
    {
      icon: Shield, title: "Privacy & Data",
      items: [
        { label: "Export Data", control: <button onClick={async () => { const data = await api.get("/account/export").catch(() => null); if (data) { const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'viralflows-export.json'; a.click(); } }} className="text-xs bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-300 px-2 py-1 rounded hover:border-zinc-600"><Download size={12} /></button> },
        { label: "Delete Account", control: <button onClick={async () => { if (confirm('Are you sure you want to delete your account? This cannot be undone.')) { await api.delete("/account").catch(() => {}); window.location.href = '/'; } }} className="text-xs text-red-400 hover:text-red-300">Delete</button> },
      ],
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <button onClick={saveSettings} disabled={saving}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : savedMsg ? "Saved!" : "Save Settings"}
        </button>
      </div>

      <div className="space-y-3">
        {sections.map((sec) => (
          <div key={sec.title} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <sec.icon size={16} className="text-violet-400" />
              <h3 className="text-white font-semibold text-sm">{sec.title}</h3>
            </div>
            <div className="space-y-3">
              {sec.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-zinc-400">{item.label}</span>
                  {item.control}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
