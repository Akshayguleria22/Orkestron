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
const AUTH_STORAGE_KEY = "orkestron_auth";
const GUEST_STORAGE_KEY = "orkestron_guest_id";

function createGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `guest-${crypto.randomUUID()}`;
  }
  return `guest-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function getStoredGuestId(): string | null {
  if (typeof window === "undefined") return null;
  const guestId = localStorage.getItem(GUEST_STORAGE_KEY);
  return guestId || null;
}

function storeGuestId(guestId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_STORAGE_KEY, guestId);
}

function buildGuestUser(guestId: string): User {
  return {
    id: guestId,
    email: `${guestId}@guest.orkestron`,
    name: "Guest",
    avatar: "",
    provider: "guest",
  };
}

function getLegacyUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: User };
    return parsed?.user?.id || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });
  // Initialize guest session + warm backend on load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const legacyId = getLegacyUserId();
    const storedGuestId = getStoredGuestId();
    const guestId = storedGuestId || legacyId || createGuestId();
    storeGuestId(guestId);
    setState({
      user: buildGuestUser(guestId),
      accessToken: null,
      isAuthenticated: true,
      isLoading: false,
    });
    void fetch(`${API_URL}/health`).catch(() => undefined);
  }, []);

  const loginWithGoogle = useCallback(() => undefined, []);

  const loginWithGithub = useCallback(() => undefined, []);

  const loginWithCredentials = useCallback(async () => undefined, []);

  const signupWithEmail = useCallback(async () => undefined, []);

  const loginWithEmail = useCallback(async () => undefined, []);

  const logout = useCallback(async () => {
    if (typeof window === "undefined") return;
    const guestId = createGuestId();
    storeGuestId(guestId);
    setState({
      user: buildGuestUser(guestId),
      accessToken: null,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const getToken = useCallback(
    () => state.accessToken || "guest",
    [state.accessToken],
  );

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
