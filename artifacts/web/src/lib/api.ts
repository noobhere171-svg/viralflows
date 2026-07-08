const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
  const token = localStorage.getItem("vf_token");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T = any>(path: string) => request<T>("GET", path),
  post: <T = any>(path: string, body?: any) => request<T>("POST", path, body),
  put: <T = any>(path: string, body?: any) => request<T>("PUT", path, body),
  patch: <T = any>(path: string, body?: any) => request<T>("PATCH", path, body),
  delete: <T = any>(path: string) => request<T>("DELETE", path),
};

export function logout() {
  const token = localStorage.getItem("vf_token");
  if (token) {
    fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  localStorage.removeItem("vf_token");
  localStorage.removeItem("vf_user");
  window.location.href = "/login";
}

export function getLocalUser() {
  try {
    const raw = localStorage.getItem("vf_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default api;
