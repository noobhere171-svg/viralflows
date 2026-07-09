import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./components/layout/AdminLayout";

// Pages
import LandingPage from "./pages/landing/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import SelectPlanPage from "./pages/billing/SelectPlanPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import ChannelsPage from "./pages/channels/ChannelsPage";
import VideoQueuePage from "./pages/video-queue/VideoQueuePage";
import SourcesPage from "./pages/sources/SourcesPage";
import DiscoverPage from "./pages/discover/DiscoverPage";
import AnalyticsPage from "./pages/analytics/AnalyticsPage";
import SchedulePage from "./pages/schedule/SchedulePage";
import ManagePage from "./pages/manage/ManagePage";
import OperationsPage from "./pages/operations/OperationsPage";
import WorkspacesPage from "./pages/workspaces/WorkspacesPage";
import ProxiesPage from "./pages/proxies/ProxiesPage";
import AccountPage from "./pages/account/AccountPage";
import BillingPage from "./pages/billing/BillingPage";
import ReferralsPage from "./pages/referrals/ReferralsPage";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import SupportPage from "./pages/support/SupportPage";
import SettingsPage from "./pages/settings/SettingsPage";
import PricingPage from "./pages/pricing/PricingPage";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminProxies from "./pages/admin/AdminProxies";
import AdminPayments from "./pages/admin/AdminPayments";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const hasToken = !!localStorage.getItem("vf_token");
  if (!hasToken) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ForgotPasswordPage />} />
      <Route path="/select-plan" element={<ProtectedRoute><SelectPlanPage /></ProtectedRoute>} />
      <Route path="/pricing" element={<PricingPage />} />

      {/* Protected */}
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
      <Route path="/channels" element={<ProtectedRoute><AppLayout><ChannelsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/video-queue" element={<ProtectedRoute><AppLayout><VideoQueuePage /></AppLayout></ProtectedRoute>} />
      <Route path="/sources" element={<ProtectedRoute><AppLayout><SourcesPage /></AppLayout></ProtectedRoute>} />
      <Route path="/discover" element={<ProtectedRoute><AppLayout><DiscoverPage /></AppLayout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AppLayout><AnalyticsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/schedule" element={<ProtectedRoute><AppLayout><SchedulePage /></AppLayout></ProtectedRoute>} />
      <Route path="/manage" element={<ProtectedRoute><AppLayout><ManagePage /></AppLayout></ProtectedRoute>} />
      <Route path="/operations" element={<ProtectedRoute><AppLayout><OperationsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/workspaces" element={<ProtectedRoute><AppLayout><WorkspacesPage /></AppLayout></ProtectedRoute>} />
      <Route path="/proxies" element={<ProtectedRoute><AppLayout><ProxiesPage /></AppLayout></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><AppLayout><AccountPage /></AppLayout></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><AppLayout><BillingPage /></AppLayout></ProtectedRoute>} />
      <Route path="/referrals" element={<ProtectedRoute><AppLayout><ReferralsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><AppLayout><NotificationsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><AppLayout><SupportPage /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="plans" element={<AdminPlans />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="proxies" element={<AdminProxies />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
