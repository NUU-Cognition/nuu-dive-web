import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { randomFillSync } from "crypto";

const SALT = process.env["EXT_TOKEN_SALT"] ?? "default-dev-salt-change-in-production";

// Initialize Convex client for server-side use
const convexClient = new ConvexHttpClient(process.env["NEXT_PUBLIC_CONVEX_URL"]!);

export async function resolveUserIdFromPAT(token?: string) {
  if (!token || !SALT) return null;
  
  try {
    const result = await convexClient.query(api.extTokens.resolveUserByToken, { 
      token, 
      salt: SALT 
    });
    return result?.userId ?? null;
  } catch (error) {
    console.error("Failed to resolve PAT:", error);
    return null;
  }
}

export async function touchPAT(token: string) {
  if (!SALT) return;
  
  try {
    await convexClient.mutation(api.extTokens.touch, { 
      token, 
      salt: SALT 
    });
  } catch (error) {
    console.error("Failed to touch PAT:", error);
  }
}

export function parseBearer(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  
  const [scheme, value] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  
  return value;
}

export function generateToken(): string {
  // Generate a secure random token
  const randomBytes = new Uint8Array(32);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    // Server-side
    randomFillSync(randomBytes);
  }
  
  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  
  return `dive_ext_${base64}`;
}