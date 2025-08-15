"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export function Providers({ children }: { children: ReactNode }) {
  // If Convex isn't configured, render app without the provider to keep UI working
  if (!convexUrl) {
    console.warn("NEXT_PUBLIC_CONVEX_URL not set — Convex disabled. App will use local state only.");
    return <SessionProvider>{children}</SessionProvider>;
  }

  const convex = new ConvexReactClient(convexUrl);
  
  return (
    <SessionProvider>
      <ConvexProvider client={convex}>
        {children}
      </ConvexProvider>
    </SessionProvider>
  );
}