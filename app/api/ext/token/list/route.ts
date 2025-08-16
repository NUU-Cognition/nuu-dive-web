import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withCorsJson, corsPreflight } from "@/lib/cors";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req.headers.get("origin"));
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  
  // Check auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return withCorsJson({ error: "Unauthorized" }, origin, { status: 401 });
  }
  
  try {
    const tokens = await convexClient.query(api.extTokens.list, {});
    
    return withCorsJson(
      tokens.map(({ _id, label, createdAt, lastUsedAt, revokedAt }) => ({
        id: _id,
        label,
        createdAt,
        lastUsedAt,
        revokedAt,
      })),
      origin
    );
  } catch (error) {
    console.error("Failed to list tokens:", error);
    return withCorsJson(
      { error: "Failed to list tokens" }, 
      origin, 
      { status: 500 }
    );
  }
}