import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#cbd5e1] hover:text-white mb-8 transition-colors">
          <ArrowLeft size={18} /> Back to Home
        </button>

        <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>

        <div className="space-y-6 text-[#e2e8f0] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using ViralFlows, you agree to be bound by these Terms of Service. If you do not agree, please do not use our service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Service Description</h2>
            <p>ViralFlows provides automated content repurposing tools that allow users to auto-post content from TikTok, Instagram, and Facebook to YouTube. We use AI-powered SEO optimization to help maximize content reach.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. User Responsibilities</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree not to use the service for any unlawful purpose or in violation of any platform's terms of service.</p>
            <p className="mt-2">You must comply with YouTube's Terms of Service and Community Guidelines when uploading content through our platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Limitation of Liability</h2>
            <p>ViralFlows is provided "as is" without warranty of any kind. We are not liable for any damages arising from the use or inability to use our service, including but not limited to content takedowns, channel strikes, or loss of data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms or engage in abusive behavior. You may cancel your account at any time through your account settings.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Changes to Terms</h2>
            <p>We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
