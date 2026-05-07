"use client";

import { AuthProvider } from "@/lib/auth-context";
import { BackendStartingBanner } from "@/components/backend-starting-banner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <BackendStartingBanner />
      {children}
    </AuthProvider>
  );
}
