"use client";

import { useAuth } from "@/lib/auth-context";
import { Brain, Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Brain className="w-6 h-6 text-indigo-400" />
        </div>
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
        <p className="text-xs text-muted-foreground">Loading Orkestron...</p>
      </div>
    );
  }

  return <>{children}</>;
}
