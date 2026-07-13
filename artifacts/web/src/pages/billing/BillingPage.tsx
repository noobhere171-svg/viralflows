import { useState, useEffect, useRef } from "react";
import { Check, Clock, ArrowUpRight, Upload, CreditCard, FileImage } from "lucide-react";
import api from "../../lib/api";

const defaultFeatureLabels: Record<string, string> = {
  channels: "YouTube Channels", sources: "TikTok Sources", queueSize: "Queue Size",
  dailyUploads: "Daily Uploads", proxies: "Admin Proxies", customProxies: "Custom Proxies",
  autoRefill: "Auto-Refill", scheduledUpload: "Scheduled Upload", analyticsDays: "Analytics Days",
  aiSeo: "AI SEO", support: "Support Level", storageMb: "Storage (MB)",
  gcpProjects: "GCP Projects", dailySearches: "Daily Searches",
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

export default function BillingPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [myRequest, setMyRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string>("");
  const [transactionId, setTransactionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.get("/billing/plans").then(setPlans).catch(() => {}),
      api.get("/billing/plan").then((d) => {
        setCurrentPlan(d.plan);
        setPlanExpiresAt(d.planExpiresAt);
      }).catch(() => {}),
      api.get("/billing/my-request").then((d) => setMyRequest(d.request)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      alert("Only images and PDFs allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return; }
    setScreenshotFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setScreenshotPreview("pdf");
    }
  };

  const uploadScreenshot = async (): Promise<string | null> => {
    if (!screenshotFile) return null;
    const formData = new FormData();
    formData.append("screenshot", screenshotFile);
    try {
      const token = localStorage.getItem("vf_token");
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}/billing/upload-screenshot`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) return data.url;
    } catch {}
    return null;
  };

  const handleSubmitPayment = async () => {
    if (!selectedPlan || !paymentMethod) return;
    setSubmitting(true);
    try {
      let screenshotUrl = null;
      if (screenshotFile) {
        screenshotUrl = await uploadScreenshot();
      }
      const res = await api.post("/billing/request-upgrade", {
        requestedPlan: selectedPlan,
        paymentMethod,
        screenshotUrl,
        amount: selectedPlanData?.price || 0,
        transactionId: transactionId || null,
      });
      if (res.autoApproved) {
        setCurrentPlan(selectedPlan);
        setPlanExpiresAt(null);
        setSelectedPlan(null);
        setPaymentMethod("");
        setScreenshotFile(null);
        setScreenshotPreview("");
        setTransactionId("");
        alert(`Upgrade to ${selectedPlan} approved! You now have access to ${selectedPlan} features.`);
      } else {
        setMyRequest({ requestedPlan: selectedPlan, status: "pending" });
        setSelectedPlan(null);
        setPaymentMethod("");
        setScreenshotFile(null);
        setScreenshotPreview("");
        setTransactionId("");
        alert("Payment submitted! Waiting for admin approval.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to submit payment");
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-indigo-500 font-bold text-xl">Loading...</div></div>;

  const currentIdx = plans.findIndex(p => p.name === currentPlan);
  const selectedPlanData = plans.find(p => p.name === selectedPlan);
  const featureLabels = selectedPlanData?.featureLabels || defaultFeatureLabels;

  const pMethods = (selectedPlanData?.paymentMethods) || [];
  const allBankDetails = (typeof selectedPlanData?.bankDetails === "object" ? selectedPlanData.bankDetails : {}) || {};
  const currentMethodDetails = paymentMethod ? (allBankDetails[paymentMethod] || {}) : {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-zinc-400">Current Plan:</span>
          <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg font-semibold capitalize">{currentPlan}</span>
          {planExpiresAt && (
            <span className="text-zinc-500 text-sm">Expires: {new Date(planExpiresAt).toLocaleDateString()}</span>
          )}
          {myRequest && (
            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm flex items-center gap-1">
              <Clock size={14} /> Upgrade to {myRequest.requestedPlan} pending
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan, idx) => {
          const features = (typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features) || {};
          const fLabels = plan.featureLabels || defaultFeatureLabels;
          const isCurrent = plan.name === currentPlan;
          const isUpgrade = idx > currentIdx;
          const isPending = myRequest?.requestedPlan === plan.name && myRequest?.status === "pending";

          return (
            <div key={plan.id} className={`bg-[#1a1a1a] border rounded-xl p-5 flex flex-col ${isCurrent ? "border-indigo-500" : "border-[#2a2a2a]"}`}>
              <h3 className="text-white font-semibold text-lg mb-1">{plan.displayName}</h3>
              <div className="text-3xl font-bold text-white mb-4">
                {plan.price === 0 ? "Free" : `${plan.currency === "USD" ? "$" : ""}${plan.price?.toLocaleString()}${plan.currency !== "USD" ? " PKR" : ""}`}
                {plan.price > 0 && <span className="text-sm text-zinc-400 font-normal">/{plan.billingPeriod}</span>}
              </div>
              <div className="space-y-2 flex-1 text-sm">
                {Object.entries(features).slice(0, 8).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Check size={14} className="text-green-400 shrink-0" />
                    <span className="text-zinc-300">{fLabels[key] || key}: <span className="text-white font-medium">{typeof val === "boolean" ? (val ? "Yes" : "No") : val === 999999 ? "Unlimited" : String(val)}</span></span>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                {isCurrent ? (
                  <div className="w-full py-2 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm text-center font-medium">Current Plan</div>
                ) : isPending ? (
                  <div className="w-full py-2 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm text-center font-medium">Request Pending</div>
                ) : isUpgrade ? (
                  <button onClick={() => { setSelectedPlan(plan.name); setPaymentMethod(""); }}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center justify-center gap-2">
                    <ArrowUpRight size={14} /> Upgrade
                  </button>
                ) : (
                  <div className="w-full py-2 bg-[#0f0f0f] text-zinc-500 rounded-lg text-sm text-center">Downgrade</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedPlan(null)}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-1">Upgrade to {selectedPlanData?.displayName}</h2>
            <p className="text-sm text-zinc-500 mb-4">Select payment method and complete payment</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {pMethods.map((m: string) => (
                    <button key={m} onClick={() => setPaymentMethod(m)}
                      className={`p-3 rounded-lg border text-sm text-center transition-colors ${paymentMethod === m ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" : "border-[#2a2a2a] text-zinc-400 hover:border-zinc-600"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod && (
                <div className="bg-[#0f0f0f] rounded-lg p-4 text-sm space-y-2">
                  <p className="text-indigo-400 font-medium mb-2">{paymentMethod} — Send payment to:</p>
                  {methodFields[paymentMethod]?.map((field) => (
                    <div key={field.key} className="flex justify-between">
                      <span className="text-zinc-500">{field.label}:</span>
                      <span className="text-white font-mono">{currentMethodDetails[field.key] || "Not set"}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#2a2a2a] pt-2 mt-2">
                    <span className="text-zinc-400 font-medium">Amount:</span>
                    <span className="text-white font-bold">{selectedPlanData?.currency === "USD" ? "$" : ""}{selectedPlanData?.price?.toLocaleString()}{selectedPlanData?.currency !== "USD" ? " PKR" : ""}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Payment Screenshot / Receipt (Image or PDF)</label>
                <input type="file" accept="image/*,.pdf" onChange={handleScreenshotChange} ref={fileInputRef} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-[#2a2a2a] rounded-lg p-4 text-center hover:border-indigo-500/50 transition-colors">
                  {screenshotPreview ? (
                    <div className="flex items-center justify-center gap-2">
                      {screenshotPreview === "pdf" ? (
                        <><FileImage size={20} className="text-indigo-400" /><span className="text-white text-sm">{screenshotFile?.name}</span></>
                      ) : (
                        <img src={screenshotPreview} alt="Screenshot" className="max-h-32 rounded" />
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload size={20} className="text-zinc-500" />
                      <span className="text-zinc-500 text-xs">Click to upload image or PDF (max 5MB)</span>
                    </div>
                  )}
                </button>
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Transaction ID (optional)</label>
                <input type="text" placeholder="TRX-123456" value={transactionId} onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelectedPlan(null)} className="flex-1 py-2.5 bg-[#0f0f0f] text-zinc-400 rounded-lg text-sm hover:bg-[#1f1f1f]">Cancel</button>
              <button onClick={handleSubmitPayment} disabled={!paymentMethod || submitting}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? "Submitting..." : <><Upload size={14} /> Submit Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
