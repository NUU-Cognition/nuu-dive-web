import { NextResponse } from "next/server";

const allowed = (process.env.EXT_ALLOWED_ORIGINS ?? "chrome-extension://*, http://localhost:3000")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

export function corsHeaders(origin?: string | null) {
  // Check if origin matches any allowed pattern
  let allowOrigin = "";
  if (origin) {
    for (const pattern of allowed) {
      if (pattern.includes("*")) {
        // Simple wildcard matching for chrome-extension://*
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        if (regex.test(origin)) {
          allowOrigin = origin;
          break;
        }
      } else if (pattern === origin) {
        allowOrigin = origin;
        break;
      }
    }
  }
  
  // Fallback to first allowed origin if no match
  if (!allowOrigin && allowed.length > 0) {
    allowOrigin = allowed[0].replace(/\*/g, "");
  }
  
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function withCorsJson(data: any, origin?: string | null, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export function corsPreflight(origin?: string | null) {
  const res = new NextResponse(null, { status: 204 });
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}