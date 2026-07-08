import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import api from "../../lib/api";

const defaultFeatureLabels: Record<string, string> = {
  channels: "YouTube Channels", sources: "TikTok Sources", queueSize: "Queue Size",
  dailyUploads: "Daily Uploads", proxies: "Admin Proxies", customProxies: "Custom Proxies",
  autoRefill: "Auto-Refill", scheduledUpload: "Scheduled Upload", analyticsDays: "Analytics Days",
  aiSeo: "AI SEO", support: "Support Level", storageMb: "Storage (MB)",
};

const methodFields: Record<string, { key: string; label: string }[]> = {
  "Bank Transfer": [
    { key: "accountTitle", label: "Account Title" },
    { key: "accountNumber", label: "Account Number" },
    { key: "bankName", label: "Bank Name" },
    { key: "iban", label: "IBAN" },
  ],
  "JazzCash": [
    { key: "accountNumber", label: "Account Number" },
    { key: "accountHolderName", label: "Account Holder Name" },
  ],
  "EasyPaisa": [
    { key: "accountNumber", label: "Account Number" },
    { key: "accountHolderName", label: "Account Holder Name" },
  ],
  "SadaPay": [
    { key: "accountNumber", label: "Card/Account Number" },
    { key: "accountHolderName", label: "Account Holder Name" },
  ],
  "NayaPay": [
    { key: "accountNumber", label: "Account Number" },
    { key: "accountHolderName", label: "Account Holder Name" },
  ],
};

export default function AdminPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlans = () => {
    api.get("/admin/plans").then(setPlans).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchPlans(); }, []);

  const handleSave = async () => {
    const payload: any = {
      displayName: editing.displayName,
      price: editing.price,
      billingPeriod: editing.billingPeriod,
      billingDays: editing.billingDays,
      features: editing.features,
      featureLabels: editing.featureLabels,
      sortOrder: editing.sortOrder,
      isActive: editing.isActive,
      paymentMethods: editing.paymentMethods,
      bankDetails: editing.bankDetails,
    };
    if (editing.id) {
      await api.patch(`/admin/plans/${editing.id}`, payload);
    } else {
      payload.name = editing.name;
      await api.post("/admin/plans", payload);
    }
    setEditing(null);
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    await api.delete(`/admin/plans/${id}`);
    fetchPlans();
  };

  const updateFeature = (key: string, value: any) => {
    setEditing({ ...editing, features: { ...editing.features, [key]: value } });
  };

  const updateFeatureLabel = (key: string, label: string) => {
    setEditing({ ...editing, featureLabels: { ...editing.featureLabels, [key]: label } });
  };

  const updateBankDetail = (method: string, field: string, value: string) => {
    const bd = { ...editing.bankDetails };
    if (!bd[method]) bd[method] = {};
    bd[method] = { ...bd[method], [field]: value };
    setEditing({ ...editing, bankDetails: bd });
  };

  const addPaymentMethod = (method: string) => {
    if (editing.paymentMethods.includes(method)) return;
    setEditing({ ...editing, paymentMethods: [...editing.paymentMethods, method] });
    const bd = { ...editing.bankDetails };
    if (!bd[method]) bd[method] = {};
    setEditing({ ...editing, paymentMethods: [...editing.paymentMethods, method], bankDetails: bd });
  };

  const removePaymentMethod = (method: string) => {
    setEditing({ ...editing, paymentMethods: editing.paymentMethods.filter((m: string) => m !== method) });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-violet-500 font-bold text-xl">Loading...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Plan Management</h1>
        <button onClick={() => setEditing({
          name: "", displayName: "", price: 0, billingPeriod: "yearly", billingDays: 365,
          features: { channels: 1, sources: 2, queueSize: 10, dailyUploads: 3, proxies: 1, customProxies: 0, autoRefill: true, scheduledUpload: true, analyticsDays: 7, aiSeo: false, support: "community", storageMb: 500 },
          featureLabels: { ...defaultFeatureLabels },
          sortOrder: 0, isActive: true,
          paymentMethods: ["Bank Transfer", "JazzCash", "EasyPaisa"],
          bankDetails: {},
        })}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
          <Plus size={16} /> Add Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan) => {
          const features = (typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features) || {};
          const fLabels = (typeof plan.featureLabels === "string" ? JSON.parse(plan.featureLabels) : plan.featureLabels) || defaultFeatureLabels;
          const pMethods = (typeof plan.paymentMethods === "string" ? JSON.parse(plan.paymentMethods) : plan.paymentMethods) || [];
          return (
            <div key={plan.id} className={`bg-[#1a1a1a] border rounded-xl p-5 ${plan.isActive ? "border-[#2a2a2a]" : "border-red-500/30 opacity-60"}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-white font-semibold text-lg">{plan.displayName}</h3>
                  <p className="text-zinc-400 text-sm">{plan.name}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing({
                    ...plan,
                    features: typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features,
                    featureLabels: typeof plan.featureLabels === "string" ? JSON.parse(plan.featureLabels) : (plan.featureLabels || { ...defaultFeatureLabels }),
                    paymentMethods: typeof plan.paymentMethods === "string" ? JSON.parse(plan.paymentMethods) : (plan.paymentMethods || []),
                    bankDetails: typeof plan.bankDetails === "string" ? JSON.parse(plan.bankDetails) : (plan.bankDetails || {}),
                  })} className="text-zinc-400 hover:text-white"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(plan.id)} className="text-zinc-400 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-3">
                {plan.price === 0 ? "Free" : `${plan.price.toLocaleString()} PKR`}
                {plan.price > 0 && <span className="text-sm text-zinc-400 font-normal">/{plan.billingPeriod}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(features).map(([key, val]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-zinc-400">{fLabels[key] || key}</span>
                    <span className="text-white font-medium">{typeof val === "boolean" ? (val ? "Yes" : "No") : val === 999999 ? "Unlimited" : val === 999 ? "Full" : String(val)}</span>
                  </div>
                ))}
              </div>
              {pMethods.length > 0 && (
                <div className="mt-3 text-xs text-zinc-500">
                  Payment: {pMethods.join(", ")}
                </div>
              )}
              <div className="mt-3 text-xs text-zinc-500">
                Status: {plan.isActive ? <span className="text-green-400">Active</span> : <span className="text-red-400">Inactive</span>}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">{editing.id ? "Edit Plan" : "New Plan"}</h3>
              <button onClick={() => setEditing(null)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-sm">Name (slug)</label>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} disabled={!!editing.id}
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm disabled:opacity-50" />
                </div>
                <div>
                  <label className="text-zinc-400 text-sm">Display Name</label>
                  <input value={editing.displayName} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-400 text-sm">Price (PKR)</label>
                  <input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="text-zinc-400 text-sm">Billing Period</label>
                  <select value={editing.billingPeriod} onChange={(e) => setEditing({ ...editing, billingPeriod: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm">
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 text-sm">Billing Days</label>
                  <input type="number" value={editing.billingDays || 365} onChange={(e) => setEditing({ ...editing, billingDays: parseInt(e.target.value) || 365 })}
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
                </div>
              </div>

              <div className="border-t border-[#2a2a2a] pt-3">
                <h4 className="text-white text-sm font-medium mb-2">Features (click name to rename)</h4>
                {Object.entries(defaultFeatureLabels).map(([key, defaultLabel]) => (
                  <div key={key} className="flex items-center gap-2 py-1">
                    <input value={editing.featureLabels?.[key] || defaultLabel} onChange={(e) => updateFeatureLabel(key, e.target.value)}
                      className="w-1/3 px-2 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-violet-400 text-sm" placeholder="Label name" />
                    {typeof editing.features?.[key] === "boolean" ? (
                      <input type="checkbox" checked={editing.features[key]} onChange={(e) => updateFeature(key, e.target.checked)}
                        className="w-4 h-4 rounded border-[#2a2a2a]" />
                    ) : typeof editing.features?.[key] === "string" ? (
                      <input value={editing.features[key]} onChange={(e) => updateFeature(key, e.target.value)}
                        className="flex-1 px-2 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-white text-sm text-right" />
                    ) : (
                      <input type="number" value={editing.features?.[key] || 0} onChange={(e) => updateFeature(key, parseInt(e.target.value) || 0)}
                        className="w-24 px-2 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-white text-sm text-right" />
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-[#2a2a2a] pt-3">
                <h4 className="text-white text-sm font-medium mb-2">Payment Methods</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(editing.paymentMethods || []).map((m: string) => (
                    <span key={m} className="px-2 py-1 bg-violet-500/20 text-violet-400 rounded text-xs flex items-center gap-1">
                      {m}
                      <button onClick={() => removePaymentMethod(m)} className="text-violet-300 hover:text-white ml-1">&times;</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  {Object.keys(methodFields).filter(m => !(editing.paymentMethods || []).includes(m)).map(m => (
                    <button key={m} onClick={() => addPaymentMethod(m)}
                      className="px-3 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-zinc-400 text-xs hover:border-violet-500 hover:text-violet-400">
                      + {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#2a2a2a] pt-3">
                <h4 className="text-white text-sm font-medium mb-2">Payment Details (per method)</h4>
                {(editing.paymentMethods || []).map((method: string) => (
                  <div key={method} className="mb-3 bg-[#0f0f0f] rounded-lg p-3">
                    <p className="text-violet-400 text-xs font-medium mb-2">{method}</p>
                    <div className="space-y-2">
                      {(methodFields[method] || []).map((field) => (
                        <div key={field.key} className="flex gap-2">
                          <span className="w-1/3 text-zinc-500 text-xs flex items-center">{field.label}</span>
                          <input value={editing.bankDetails?.[method]?.[field.key] || ""}
                            onChange={(e) => updateBankDetail(method, field.key, e.target.value)}
                            className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white text-sm" placeholder={field.label} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-zinc-400 text-sm">Active</label>
                <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="w-4 h-4" />
              </div>
              <button onClick={handleSave} className="w-full py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center justify-center gap-2">
                <Save size={16} /> Save Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
