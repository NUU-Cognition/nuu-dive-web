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
    const body = await req.json().catch(() => ({} as any));
    const { title, description, initialConcept } = body;
    
    if (!title) {
      return withCorsJson({ error: "Title is required" }, origin, { status: 400 });
    }
    
    // For dev mode, create a simple dive URL without going through Convex
    if (allowDevNoAuth) {
      // Generate a simple dive ID
      const diveId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create the dive URL
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      let diveUrl = `${baseUrl}/d/${diveId}?fromExtension=true&title=${encodeURIComponent(title)}`;
      
      if (initialConcept) {
        const conceptParams = new URLSearchParams({
          conceptTitle: initialConcept.title || title,
          conceptSnippet: initialConcept.snippet || "",
          sourceUrl: initialConcept.sourceUrl || "",
          sourceTitle: initialConcept.sourceTitle || "",
        });
        diveUrl += `&${conceptParams.toString()}`;
      }
      
      return withCorsJson({
        diveId,
        url: diveUrl,
        title,
        description,
      }, origin);
    }
    
    // TODO: Full implementation would create dive and concept in Convex
    // For now, return dev mode response
    return withCorsJson({ error: "Convex integration not implemented yet" }, origin, { status: 501 });
    
  } catch (error) {
    console.error("Failed to create dive:", error);
    return withCorsJson(
      { error: "Failed to create dive" },
      origin,
      { status: 500 }
    );
  }
}