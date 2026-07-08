import { Component } from "react";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-8">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 max-w-md text-center">
            <p className="text-red-400 text-lg font-semibold mb-2">Something went wrong</p>
            <p className="text-zinc-400 text-sm mb-4">{this.state.error?.message || "An unexpected error occurred"}</p>
            <button onClick={() => window.location.reload()} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Reload Page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
