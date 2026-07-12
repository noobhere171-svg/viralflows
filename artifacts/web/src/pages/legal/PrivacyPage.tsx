import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#cbd5e1] hover:text-white mb-8 transition-colors">
          <ArrowLeft size={18} /> Back to Home
        </button>

        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>

        <div className="space-y-6 text-[#e2e8f0] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, including name, email address, WhatsApp number, and YouTube channel data when you create an account or use our services.</p>
            <p className="mt-2">We also automatically collect certain technical information such as IP address, browser type, device information, and usage data to improve our service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use the collected information to provide, maintain, and improve our YouTube automation services; to process transactions; to send technical notices and support messages; and to communicate with you about our service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Sharing & Disclosure</h2>
            <p>We do not sell your personal information. We may share your data with third-party service providers (such as Google Cloud Platform) solely for the purpose of operating our service, complying with legal obligations, or protecting our rights.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Security</h2>
            <p>We implement industry-standard security measures including encryption in transit and at rest, regular security audits, and access controls to protect your personal information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data at any time through your account settings. You may also contact us to request data portability or restriction of processing.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Contact</h2>
            <p>For any privacy-related questions, please contact us at <span className="text-indigo-400">support@viralflows.com</span>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
