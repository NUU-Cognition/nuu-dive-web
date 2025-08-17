import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withCorsJson, corsPreflight } from "@/lib/cors";
import { generateToken } from "@/lib/pat";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const convexClient = new ConvexHttpClient(process.env["NEXT_PUBLIC_CONVEX_URL"]!);
const SALT = process.env["EXT_TOKEN_SALT"] ?? "default-dev-salt-change-in-production";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  
  // Check auth (with dev bypass)
  const session = await getServerSession(authOptions);
  const allowDevNoAuth = process.env.ALLOW_DEV_NO_AUTH === "1";
  
  if (!allowDevNoAuth && !session?.user?.email) {
    return withCorsJson({ error: "Unauthorized" }, origin, { status: 401 });
  }
  
  // For dev mode without auth, create a dummy user email
  const userEmail = session?.user?.email || "dev@localhost.com";
  
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const label = (body?.label as string) || "Chrome Extension";
    const token = generateToken();
    
    // Store token in Convex (skip for dev mode)
    if (!allowDevNoAuth) {
      await convexClient.mutation(api.extTokens.create, { 
        label, 
        token, 
        salt: SALT 
      });
    }
    
    return withCorsJson({ 
      token, 
      label, 
      createdAt: Date.now() 
    }, origin);
  } catch (error) {
    console.error("Failed to create token:", error);
    return withCorsJson(
      { error: "Failed to create token" }, 
      origin, 
      { status: 500 }
    );
  }
}