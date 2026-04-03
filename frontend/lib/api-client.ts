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
      // Dispatch an event to log the user out on the frontend
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("orkestron:auth:unauthorized"));
      }
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
    request("/tasks/real", {
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

  getBillingSummary: (token: string) =>
    request<{ summary: Record<string, unknown> }>("/billing/summary", {
      headers: authHeaders(token),
    }),

  // ─── Capabilities ───
  getCapabilities: () => request("/agents/capabilities"),

  // ─── Metrics ───
  getMetrics: () => request<string>("/metrics"),

  // ─── Real Tasks ───
  signup: (email: string, password: string, name: string) =>
    request<{ access_token: string; user: Record<string, string> }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  loginWithEmail: (email: string, password: string) =>
    request<{ access_token: string; user: Record<string, string> }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  submitRealTask: (token: string, input: string) =>
    request<{ task_id: string; status: string }>("/tasks/real", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ input }),
    }),

  getRealTask: (token: string, taskId: string) =>
    request<Record<string, unknown>>(`/tasks/real/${taskId}`, {
      headers: authHeaders(token),
    }),

  listRealTasks: (token: string, status?: string, limit = 20) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    qs.set("limit", String(limit));
    return request<{ tasks: Record<string, unknown>[] }>(`/tasks/real?${qs}`, {
      headers: authHeaders(token),
    });
  },

  deleteRealTask: (token: string, taskId: string) =>
    request<{ deleted: number; task_id: string }>(`/tasks/real/${taskId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  clearTaskHistory: (token: string, status = "completed,failed") =>
    request<{ deleted: number; statuses: string[] }>(
      `/tasks/real?status=${encodeURIComponent(status)}`,
      {
        method: "DELETE",
        headers: authHeaders(token),
      }
    ),

  cleanupPendingTasks: (token: string, olderThanHours = 24) =>
    request<{ deleted: number; older_than_hours: number; statuses: string[] }>(
      `/tasks/real/pending?older_than_hours=${olderThanHours}`,
      {
        method: "DELETE",
        headers: authHeaders(token),
      }
    ),

  getTaskLogs: (token: string, taskId: string) =>
    request<{ logs: Record<string, unknown>[] }>(`/tasks/real/${taskId}/logs`, {
      headers: authHeaders(token),
    }),

  // ─── Marketplace Deploy ───
  deployAgent: (token: string, agentId: string, config: Record<string, unknown> = {}) =>
    request<{ status: string; deployment_id: string; agent_id: string; agent_name: string }>(
      "/marketplace/deploy",
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ agent_id: agentId, config }),
      }
    ),

  listDeployedAgents: (token: string) =>
    request<{ deployed: Record<string, unknown>[] }>("/marketplace/deployed", {
      headers: authHeaders(token),
    }),

  undeployAgent: (token: string, deploymentId: string) =>
    request(`/marketplace/deploy/${deploymentId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  // ─── Observatory ───
  getTraces: (token: string, status?: string, limit = 50) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    qs.set("limit", String(limit));
    return request<{ traces: Record<string, unknown>[]; count: number }>(
      `/observatory/traces?${qs}`,
      { headers: authHeaders(token) }
    );
  },

  getTrace: (token: string, traceId: string) =>
    request<{ trace: Record<string, unknown> }>(`/observatory/traces/${traceId}`, {
      headers: authHeaders(token),
    }),

  getObservatoryStats: (token: string) =>
    request<{ stats: Record<string, unknown> }>("/observatory/stats", {
      headers: authHeaders(token),
    }),

  // ─── Platform Agents (Real Agent Marketplace) ───
  createPlatformAgent: (token: string, data: Record<string, unknown>) =>
    request<{ status: string; agent: Record<string, unknown> }>("/platform/agents", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  listPlatformAgents: (token: string, params?: {
    category?: string;
    agent_type?: string;
    search?: string;
    mine_only?: boolean;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      });
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ agents: Record<string, unknown>[]; count: number }>(
      `/platform/agents${suffix}`,
      { headers: authHeaders(token) }
    );
  },

  listPublicAgents: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      });
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<{ agents: Record<string, unknown>[]; count: number }>(
      `/platform/agents/public${suffix}`
    );
  },

  getPlatformAgent: (agentId: string) =>
    request<{ agent: Record<string, unknown> }>(`/platform/agents/${agentId}`),

  updatePlatformAgent: (token: string, agentId: string, data: Record<string, unknown>) =>
    request<{ status: string; agent: Record<string, unknown> }>(`/platform/agents/${agentId}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  deletePlatformAgent: (token: string, agentId: string) =>
    request(`/platform/agents/${agentId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  executePlatformAgent: (token: string, agentId: string, input: string) =>
    request<Record<string, unknown>>(`/platform/agents/${agentId}/execute`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ input }),
    }),

  listPlatformRuns: (token: string, agentId?: string, limit = 20) => {
    const qs = new URLSearchParams();
    if (agentId) qs.set("agent_id", agentId);
    qs.set("limit", String(limit));
    return request<{ runs: Record<string, unknown>[]; count: number }>(
      `/platform/runs?${qs}`,
      { headers: authHeaders(token) }
    );
  },

  getPlatformRun: (token: string, runId: string) =>
    request<{ run: Record<string, unknown> }>(`/platform/runs/${runId}`, {
      headers: authHeaders(token),
    }),

  getMLTools: () =>
    request<{ tools: Record<string, unknown>[]; count: number }>("/platform/ml-tools"),
};
