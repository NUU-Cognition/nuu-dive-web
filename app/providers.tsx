"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";
import { type ReactNode, useMemo } from "react";

const convexUrl = process.env["NEXT_PUBLIC_CONVEX_URL"];

export function Providers({ children }: { children: ReactNode }) {
  if (!convexUrl) {
    console.error(
      "NEXT_PUBLIC_CONVEX_URL is not set. Convex hooks require a provider; using a local placeholder client. " +
        "Run `npx convex dev` and set NEXT_PUBLIC_CONVEX_URL in .env.local."
    );
  }
  // Always provide a Convex client so hooks don't crash; the placeholder URL avoids immediate runtime throws.
  const convex = useMemo(
    () => new ConvexReactClient(convexUrl ?? "http://127.0.0.1:3210"),
    []
  );
  
  return (
    <SessionProvider>
      <ConvexProvider client={convex}>
        {children}
      </ConvexProvider>
    </SessionProvider>
  );
}