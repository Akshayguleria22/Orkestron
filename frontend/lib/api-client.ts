// ── Orkestron API Client ──
// Full API wrapper for backend — auth, workflows, products, analytics, WebSocket.

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
  if (!res.ok) {
    if (res.status === 401) {
      // Could trigger token refresh here
      throw new Error("Unauthorized");
    }
    if (res.status === 429) {
      const data = await res.json();
      throw new Error(`Rate limited. Retry after ${data.retry_after}s`);
    }
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  // ─── Health ───
  health: () => request<{ status: string; version: string }>("/health"),

  // ─── Auth ───
  authenticate: (userId: string, tenantId: string) =>
    request<{ access_token: string }>("/auth/token", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, tenant_id: tenantId }),
    }),

  getOAuthUrl: (provider: string, redirectUri: string) =>
    request<{ authorize_url: string }>(`/auth/oauth/${provider}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`),

  oauthCallback: (provider: string, code: string, state: string) =>
    request<{ access_token: string; refresh_token: string; user: Record<string, string> }>(
      `/auth/oauth/${provider}/callback`,
      { method: "POST", body: JSON.stringify({ code, state }) }
    ),

  refreshToken: (refreshToken: string) =>
    request<{ access_token: string; refresh_token: string }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  logout: (refreshToken: string) =>
    request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  me: (token: string) =>
    request<{ user_id: string; roles: string[] }>("/auth/me", {
      headers: authHeaders(token),
    }),

  // ─── Tasks ───
  submitTask: (token: string, task: string) =>
    request("/task", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ input: task }),
    }),

  // ─── Agents ───
  getAgents: () => request("/agents/registered"),

  // ─── Workflows ───
  createWorkflow: (token: string, name: string, graphJson: Record<string, unknown>, description = "") =>
    request<{ workflow: Record<string, unknown> }>("/workflows", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name, graph_json: graphJson, description }),
    }),

  listWorkflows: (token: string) =>
    request<{ workflows: Record<string, unknown>[] }>("/workflows", {
      headers: authHeaders(token),
    }),

  getWorkflow: (token: string, workflowId: string) =>
    request<{ workflow: Record<string, unknown> }>(`/workflows/${workflowId}`, {
      headers: authHeaders(token),
    }),

  updateWorkflow: (token: string, workflowId: string, data: Record<string, unknown>) =>
    request<{ workflow: Record<string, unknown> }>(`/workflows/${workflowId}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  deleteWorkflow: (token: string, workflowId: string) =>
    request(`/workflows/${workflowId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  runWorkflow: (token: string, workflowId: string) =>
    request<{ run: Record<string, unknown> }>(`/workflows/${workflowId}/run`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  getWorkflowRuns: (token: string, workflowId: string) =>
    request<{ runs: Record<string, unknown>[] }>(`/workflows/${workflowId}/runs`, {
      headers: authHeaders(token),
    }),

  getRun: (token: string, runId: string) =>
    request<{ run: Record<string, unknown> }>(`/workflows/runs/${runId}`, {
      headers: authHeaders(token),
    }),

  // ─── Products ───
  getProducts: (params?: {
    category?: string;
    vendor_id?: string;
    min_price?: number;
    max_price?: number;
    search?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      });
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ products: Record<string, unknown>[]; count: number }>(`/products${suffix}`);
  },

  getProduct: (productId: string) =>
    request<{ product: Record<string, unknown> }>(`/products/${productId}`),

  getCategories: () =>
    request<{ categories: string[] }>("/products/categories/list"),

  getProductStats: () =>
    request<{ stats: Record<string, unknown> }>("/products/stats/overview"),

  // ─── Vendors ───
  getVendors: () => request<{ vendors: Record<string, unknown>[] }>("/vendors"),

  getVendorAnalytics: () =>
    request<{ analytics: Record<string, unknown>[] }>("/vendors/analytics"),

  // ─── Analytics ───
  getDashboardAnalytics: (token: string) =>
    request<{ analytics: Record<string, unknown> }>("/analytics/dashboard", {
      headers: authHeaders(token),
    }),

  getDailyOutcomes: (token: string, days = 30) =>
    request<{ outcomes: Record<string, unknown>[] }>(`/analytics/daily-outcomes?days=${days}`, {
      headers: authHeaders(token),
    }),

  getRevenue: (token: string, days = 30) =>
    request<{ revenue: Record<string, unknown>[] }>(`/analytics/revenue?days=${days}`, {
      headers: authHeaders(token),
    }),

  getAgentUsage: (token: string) =>
    request<{ usage: Record<string, unknown>[] }>("/analytics/agent-usage", {
      headers: authHeaders(token),
    }),

  getWorkflowStats: (token: string) =>
    request<{ stats: Record<string, unknown> }>("/analytics/workflow-stats", {
      headers: authHeaders(token),
    }),

  // ─── Billing ───
  getLedger: (token: string, userId: string) =>
    request(`/billing/ledger/${userId}`, {
      headers: authHeaders(token),
    }),

  // ─── Capabilities ───
  getCapabilities: () => request("/agents/capabilities"),

  // ─── Metrics ───
  getMetrics: () => request<string>("/metrics"),
};
