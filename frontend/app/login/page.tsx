"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Github, Mail, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { loginWithGoogle, loginWithGithub, loginWithCredentials, isAuthenticated } = useAuth();
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [tenantId, setTenantId] = useState("default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.replace("/dashboard");
    return null;
  }

  async function handleCredentialLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) return;
    setLoading(true);
    setError("");
    try {
      await loginWithCredentials(userId.trim(), tenantId.trim());
      router.push("/dashboard");
    } catch {
      setError("Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/[0.02] via-transparent to-transparent" />

      <div className="relative w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <Brain className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight font-display">Sign in to Orkestron</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Autonomous infrastructure orchestrator</p>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-2.5 mb-6">
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-sm font-medium"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button
            onClick={loginWithGithub}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-sm font-medium"
          >
            <Github className="w-4 h-4" />
            Continue with GitHub
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/[0.06]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">or sign in with credentials</span>
          </div>
        </div>

        {/* Credential form */}
        <form onSubmit={handleCredentialLogin} className="space-y-3">
          <div>
            <label htmlFor="userId" className="block text-xs font-medium text-muted-foreground mb-1.5">
              User ID
            </label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. alice"
              className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-colors"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="tenantId" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Tenant ID
            </label>
            <input
              id="tenantId"
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="default"
              className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !userId.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Sign In <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-muted-foreground/50 mt-6">
          Orkestron v0.8.0 — Autonomous AI Orchestration Platform
        </p>
      </div>
    </div>
  );
}
