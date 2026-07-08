import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "text-amber-400 border-amber-400/20",
    processing: "text-violet-400 border-violet-400/20",
    in_progress: "text-violet-400 border-violet-400/20",
    uploaded: "text-green-500 border-green-500/20",
    completed: "text-green-500 border-green-500/20",
    active: "text-green-500 border-green-500/20",
    failed: "text-red-400 border-red-400/20",
    inactive: "text-zinc-500 border-zinc-500/20",
    error: "text-red-400 border-red-400/20",
    unauthorized: "text-rose-400 border-rose-400/20",
    expired: "text-rose-400 border-rose-400/20",
    connected: "text-green-500 border-green-500/20",
    disconnected: "text-zinc-500 border-zinc-500/20",
    ok: "text-green-500 border-green-500/20",
    idle: "text-amber-400 border-amber-400/20",
    active_text: "text-violet-400 border-violet-400/20",
  };
  return colors[status] || "text-zinc-500 border-zinc-500/20";
}
