"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function OAuthCallbackPage({ params }: { params: { provider: string } }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  const providerLabel = useMemo(() => {
    if (params.provider === "google") return "Google";
    if (params.provider === "github") return "GitHub";
    return "OAuth";
  }, [params.provider]);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onOAuthError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setError(detail?.message || "Authentication failed. Please try again.");
    };

    window.addEventListener("orkestron:auth:oauth-error", onOAuthError);

    const timeoutId = window.setTimeout(() => {
      if (!isAuthenticated) {
        setError((prev) => prev || "Authentication timed out. Please try again.");
      }
    }, 15000);

    return () => {
      window.removeEventListener("orkestron:auth:oauth-error", onOAuthError);
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-xl font-medium">
          {error ? `Could not authenticate with ${providerLabel}` : `Authenticating with ${providerLabel}...`}
        </div>
        <p className="mt-3 text-sm text-white/70">
          {error
            ? error
            : isLoading
            ? "Completing secure sign-in. This should only take a few seconds."
            : "Waiting for authentication result..."}
        </p>

        {error ? (
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Back to Login
            </Link>
            <Link
              href="/"
              className="rounded-md border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
            >
              Home
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
