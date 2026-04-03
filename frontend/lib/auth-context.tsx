"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  provider: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  loginWithGoogle: () => void;
  loginWithGithub: () => void;
  loginWithCredentials: (userId: string, tenantId: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (
    email: string,
    password: string,
    name: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STORAGE_KEY = "orkestron_auth";

function getStoredAuth(): { accessToken: string; refreshToken: string; user: User } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeAuth(data: { accessToken: string; refreshToken: string; user: User }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  // Initialize from storage
  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      setState({
        user: stored.user,
        accessToken: stored.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      setRefreshToken(stored.refreshToken);
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const stateParam = params.get("state");
    const provider = window.location.pathname.includes("google")
      ? "google"
      : window.location.pathname.includes("github")
      ? "github"
      : null;

    if (code && stateParam && provider) {
      void handleOAuthCallback(provider, code, stateParam);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Handle unauthorized event from API client
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleUnauthorized = () => {
      clearAuth();
      setRefreshToken(null);
      setState({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    };
    window.addEventListener("orkestron:auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("orkestron:auth:unauthorized", handleUnauthorized);
  }, []);

  async function handleOAuthCallback(provider: string, code: string, state: string) {
    try {
      const res = await fetch(`${API_URL}/auth/oauth/${provider}/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "OAuth callback failed");
      }

      const data = await res.json();
      const authData = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
      };

      storeAuth(authData);
      setRefreshToken(data.refresh_token);
      setState({
        user: data.user,
        accessToken: data.access_token,
        isAuthenticated: true,
        isLoading: false,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("orkestron:auth:oauth-success"));
      }
    } catch (err) {
      console.error("OAuth callback error:", err);
      if (typeof window !== "undefined") {
        const message =
          err instanceof Error ? err.message : "OAuth callback failed";
        window.dispatchEvent(
          new CustomEvent("orkestron:auth:oauth-error", {
            detail: { message },
          }),
        );
      }
      setState((s) => ({ ...s, isLoading: false }));
    }
  }

  const loginWithGoogle = useCallback(async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback/google`;
      const res = await fetch(
        `${API_URL}/auth/oauth/google/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      const data = await res.json();
      window.location.href = data.authorize_url;
    } catch (err) {
      console.error("Google login error:", err);
    }
  }, []);

  const loginWithGithub = useCallback(async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback/github`;
      const res = await fetch(
        `${API_URL}/auth/oauth/github/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      const data = await res.json();
      window.location.href = data.authorize_url;
    } catch (err) {
      console.error("GitHub login error:", err);
    }
  }, []);

  const loginWithCredentials = useCallback(
    async (userId: string, tenantId: string) => {
      try {
        const res = await fetch(`${API_URL}/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            tenant_id: tenantId,
            roles: ["user"],
            permissions: ["submit_task", "view_workflows", "view_billing"],
          }),
        });

        if (!res.ok) throw new Error("Authentication failed");

        const data = await res.json();
        const user: User = {
          id: userId,
          email: `${userId}@orkestron.ai`,
          name: userId,
          avatar: "",
          provider: "local",
        };

        const authData = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || "",
          user,
        };

        storeAuth(authData);
        setRefreshToken(data.refresh_token || null);
        setState({
          user,
          accessToken: data.access_token,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (err) {
        console.error("Login error:", err);
        throw err;
      }
    },
    []
  );

  const signupWithEmail = useCallback(
    async (email: string, password: string, name: string) => {
      try {
        const res = await fetch(`${API_URL}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Signup failed");
        }

        const data = await res.json();
        const user: User = data.user;

        const authData = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || "",
          user,
        };

        storeAuth(authData);
        setRefreshToken(data.refresh_token || null);
        setState({
          user,
          accessToken: data.access_token,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (err) {
        console.error("Signup error:", err);
        throw err;
      }
    },
    [],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Invalid email or password");
        }

        const data = await res.json();
        const user: User = data.user;

        const authData = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || "",
          user,
        };

        storeAuth(authData);
        setRefreshToken(data.refresh_token || null);
        setState({
          user,
          accessToken: data.access_token,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (err) {
        console.error("Email login error:", err);
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    if (refreshToken) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        // Ignore — we clear locally regardless
      }
    }
    clearAuth();
    setRefreshToken(null);
    setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, [refreshToken]);

  const getToken = useCallback(() => state.accessToken, [state.accessToken]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        loginWithGoogle,
        loginWithGithub,
        loginWithCredentials,
        loginWithEmail,
        signupWithEmail,
        logout,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
