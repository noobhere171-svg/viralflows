import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Save, GripVertical } from "lucide-react";
import api from "../../lib/api";

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

const ALL_METHODS = Object.keys(methodFields);

export default function AdminPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [featureDefs, setFeatureDefs] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({ key: "", label: "", type: "number", defaultVal: 0 });

  const fetchData = async () => {
    try {
      const [p, f] = await Promise.all([
        api.get("/admin/plans"),
        api.get("/admin/feature-definitions"),
      ]);
      setPlans(p);
      setFeatureDefs(f);
    } catch {} finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, []);

  const getDefaultFeatures = () => {
    const def: Record<string, any> = {};
    for (const f of featureDefs) {
      def[f.key] = f.defaultVal ?? (f.type === "boolean" ? false : 0);
    }
    return def;
  };

  const getDefaultLabels = () => {
    const labels: Record<string, string> = {};
    for (const f of featureDefs) {
      labels[f.key] = f.label;
    }
    return labels;
  };

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
    fetchData();
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    await api.delete(`/admin/plans/${id}`);
    fetchData();
  };

  const updateFeature = (key: string, value: any) => {
    setEditing({ ...editing, features: { ...editing.features, [key]: value } });
  };

  const updateFeatureLabel = (key: string, label: string) => {
    setEditing({ ...editing, featureLabels: { ...editing.featureLabels, [key]: label } });
  };

  const deleteFeatureFromPlan = (key: string) => {
    const features = { ...editing.features };
    delete features[key];
    const labels = { ...editing.featureLabels };
    delete labels[key];
    setEditing({ ...editing, features, featureLabels: labels });
  };

  const addFeatureToPlan = (featKey: string) => {
    if (editing.features[featKey] !== undefined) return;
    const def = featureDefs.find(f => f.key === featKey);
    setEditing({
      ...editing,
      features: { ...editing.features, [featKey]: def?.defaultVal ?? (def?.type === "boolean" ? false : 0) },
      featureLabels: { ...editing.featureLabels, [featKey]: def?.label || featKey },
    });
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

  // Feature definition CRUD
  const handleAddFeatureDef = async () => {
    if (!newFeature.key || !newFeature.label) return;
    try {
      await api.post("/admin/feature-definitions", {
        key: newFeature.key,
        label: newFeature.label,
        type: newFeature.type,
        defaultVal: newFeature.type === "boolean" ? false : Number(newFeature.defaultVal) || 0,
        sortOrder: featureDefs.length,
      });
      setShowAddFeature(false);
      setNewFeature({ key: "", label: "", type: "number", defaultVal: 0 });
      fetchData();
    } catch (e: any) {
      alert(e?.error || "Failed to add feature");
    }
  };

  const handleRenameFeatureDef = async (id: string, label: string) => {
    try {
      await api.patch(`/admin/feature-definitions/${id}`, { label });
      fetchData();
    } catch {}
  };

  const handleDeleteFeatureDef = async (id: string, key: string) => {
    if (!confirm(`Delete feature "${key}" from ALL plans?`)) return;
    try {
      await api.delete(`/admin/feature-definitions/${id}`);
      fetchData();
    } catch {}
  };

  const allowedMethods = ALL_METHODS;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-violet-500 font-bold text-xl">Loading...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Plan Management</h1>
        <button onClick={() => setEditing({
          name: "", displayName: "", price: 0, billingPeriod: "yearly", billingDays: 365,
          features: getDefaultFeatures(),
          featureLabels: getDefaultLabels(),
          sortOrder: plans.length, isActive: true,
          paymentMethods: ["Bank Transfer", "JazzCash", "EasyPaisa"],
          bankDetails: {},
        })}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
          <Plus size={16} /> Add Plan
        </button>
      </div>

      {/* Feature Definitions Bar */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-white">Feature Definitions</h2>
          <button onClick={() => setShowAddFeature(true)}
            className="flex items-center gap-1 px-3 py-1 bg-violet-600/20 text-violet-400 rounded text-xs hover:bg-violet-600/30">
            <Plus size={12} /> Add Feature
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {featureDefs.map((f) => (
            <div key={f.id} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#0f0f0f] border border-[#2a2a2a]">
              <span className="text-violet-400 font-mono">{f.key}</span>
              <span className="text-zinc-500">=</span>
              <span className="text-white">{f.label}</span>
              <span className={`px-1 rounded ${f.type === "boolean" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>{f.type}</span>
              {f.isEnforced && <span className="text-amber-400 font-bold">⚠</span>}
              <button onClick={() => {
                const newLabel = prompt("Rename feature label:", f.label);
                if (newLabel && newLabel !== f.label) handleRenameFeatureDef(f.id, newLabel);
              }} className="text-zinc-500 hover:text-white ml-1"><Edit2 size={10} /></button>
              <button onClick={() => handleDeleteFeatureDef(f.id, f.key)} className="text-zinc-500 hover:text-red-400"><Trash2 size={10} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan) => {
          const features = (typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features) || {};
          const fLabels = (typeof plan.featureLabels === "string" ? JSON.parse(plan.featureLabels) : plan.featureLabels) || {};
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
                    features: typeof plan.features === "string" ? JSON.parse(plan.features) : { ...plan.features },
                    featureLabels: typeof plan.featureLabels === "string" ? JSON.parse(plan.featureLabels) : { ...(plan.featureLabels || {}) },
                    paymentMethods: typeof plan.paymentMethods === "string" ? JSON.parse(plan.paymentMethods) : (plan.paymentMethods || []),
                    bankDetails: typeof plan.bankDetails === "string" ? JSON.parse(plan.bankDetails) : (plan.bankDetails || {}),
                  })} className="text-zinc-400 hover:text-white"><Edit2 size={14} /></button>
                  <button onClick={() => handleDeletePlan(plan.id)} className="text-zinc-400 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-3">
                {plan.price === 0 ? "Free" : `${plan.price.toLocaleString()} PKR`}
                {plan.price > 0 && <span className="text-sm text-zinc-400 font-normal">/{plan.billingPeriod}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {featureDefs.map((def) => {
                  const val = features[def.key];
                  if (val === undefined) return null;
                  return (
                    <div key={def.key} className="flex justify-between">
                      <span className="text-zinc-400">{fLabels[def.key] || def.label}</span>
                      <span className={`font-medium ${def.isEnforced ? "text-amber-400" : "text-white"}`}>
                        {typeof val === "boolean" ? (val ? "Yes" : "No") : val === -1 ? "Unlimited" : val === 999999 ? "Unlimited" : val === 999 ? "Full" : String(val)}
                      </span>
                    </div>
                  );
                })}
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

      {/* Edit Plan Modal */}
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

              {/* Dynamic Features Editor */}
              <div className="border-t border-[#2a2a2a] pt-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-white text-sm font-medium">Features (click label to rename)</h4>
                  <div className="flex gap-2">
                    {featureDefs.filter(f => editing.features[f.key] === undefined).map(f => (
                      <button key={f.key} onClick={() => addFeatureToPlan(f.key)}
                        className="px-2 py-0.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-zinc-400 text-xs hover:border-violet-500 hover:text-violet-400">
                        + {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {featureDefs.map((def) => {
                  const val = editing.features?.[def.key];
                  if (val === undefined) return null;
                  return (
                    <div key={def.key} className="flex items-center gap-2 py-1 group">
                      <span className="text-zinc-600 text-xs cursor-move"><GripVertical size={12} /></span>
                      <input value={editing.featureLabels?.[def.key] || def.label}
                        onChange={(e) => updateFeatureLabel(def.key, e.target.value)}
                        className="w-1/3 px-2 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-violet-400 text-sm" placeholder="Label" />
                      {def.type === "boolean" ? (
                        <input type="checkbox" checked={!!val} onChange={(e) => updateFeature(def.key, e.target.checked)}
                          className="w-4 h-4 rounded border-[#2a2a2a]" />
                      ) : (
                        <input type="number" value={val === -1 ? "" : val} onChange={(e) => {
                          const v = e.target.value;
                          updateFeature(def.key, v === "" ? -1 : parseInt(v) || 0);
                        }}
                          className="w-24 px-2 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-white text-sm text-right"
                          placeholder="Unlimited" />
                      )}
                      {def.isEnforced && <span className="text-amber-400 text-xs font-bold" title="Enforced by backend">⚠</span>}
                      <button onClick={() => deleteFeatureFromPlan(def.key)}
                        className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Payment Methods */}
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
                <div className="flex gap-2 flex-wrap">
                  {allowedMethods.filter(m => !(editing.paymentMethods || []).includes(m)).map(m => (
                    <button key={m} onClick={() => addPaymentMethod(m)}
                      className="px-3 py-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded text-zinc-400 text-xs hover:border-violet-500 hover:text-violet-400">
                      + {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank Details */}
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

      {/* Add Feature Definition Modal */}
      {showAddFeature && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddFeature(false)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Add New Feature</h3>
              <button onClick={() => setShowAddFeature(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-zinc-400 text-sm">Feature Key (slug)</label>
                <input value={newFeature.key} onChange={(e) => setNewFeature({ ...newFeature, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                  className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" placeholder="e.g. dailySearches" />
              </div>
              <div>
                <label className="text-zinc-400 text-sm">Display Label</label>
                <input value={newFeature.label} onChange={(e) => setNewFeature({ ...newFeature, label: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" placeholder="e.g. Daily Searches" />
              </div>
              <div>
                <label className="text-zinc-400 text-sm">Type</label>
                <select value={newFeature.type} onChange={(e) => setNewFeature({ ...newFeature, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm">
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>
              {newFeature.type === "number" && (
                <div>
                  <label className="text-zinc-400 text-sm">Default Value</label>
                  <input type="number" value={newFeature.defaultVal} onChange={(e) => setNewFeature({ ...newFeature, defaultVal: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-white text-sm" />
                </div>
              )}
              <button onClick={handleAddFeatureDef}
                className="w-full py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                Add Feature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
