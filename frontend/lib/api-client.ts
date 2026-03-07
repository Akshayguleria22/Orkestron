// ── Orkestron API Client ──
// Wraps fetch calls to the backend. Falls back to mock data for demo.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const api = {
  // Health
  health: () => request<{ status: string }>("/health"),

  // Auth
  authenticate: (userId: string, tenantId: string) =>
    request<{ token: string }>("/authenticate", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, tenant_id: tenantId }),
    }),

  // Tasks
  submitTask: (token: string, task: string) =>
    request("/task", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ input: task }),
    }),

  // Agents
  getAgents: () => request("/agents/registered"),

  // Billing
  getLedger: () => request("/billing/ledger"),

  // Capabilities
  getCapabilities: () => request("/capabilities"),

  // Metrics
  getMetrics: () => request<string>("/metrics"),
};
