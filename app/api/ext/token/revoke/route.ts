import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withCorsJson, corsPreflight } from "@/lib/cors";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";

const convexClient = new ConvexHttpClient(process.env["NEXT_PUBLIC_CONVEX_URL"]!);

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  
  // Check auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return withCorsJson({ error: "Unauthorized" }, origin, { status: 401 });
  }
  
  try {
    const { tokenId } = await req.json();
    if (!tokenId) {
      return withCorsJson({ error: "Token ID required" }, origin, { status: 400 });
    }
    
    await convexClient.mutation(api.extTokens.revoke, { 
      tokenId: tokenId as Id<"extensionTokens"> 
    });
    
    return withCorsJson({ success: true }, origin);
  } catch (error) {
    console.error("Failed to revoke token:", error);
    return withCorsJson(
      { error: "Failed to revoke token" }, 
      origin, 
      { status: 500 }
    );
  }
}