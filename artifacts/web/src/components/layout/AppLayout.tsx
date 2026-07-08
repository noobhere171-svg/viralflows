import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import FreePlanBanner from "./FreePlanBanner";
import ErrorBoundary from "../ErrorBoundary";
import { useUIStore } from "../../stores/uiStore";

export default function AppLayout({ children }: { children: ReactNode }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex">
      <Sidebar />
      <div className={`flex-1 flex flex-col transition-all duration-200 ${sidebarOpen ? "ml-[240px]" : "ml-0"}`}>
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <FreePlanBanner />
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
