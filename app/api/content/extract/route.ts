// New modular content extraction API
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes - maximum allowed by Vercel

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { contentExtractor } from "@/lib/extraction/contentExtractor";
import type { ExtractionRequest, ExtractionLevel } from "@/lib/extraction/types";

// In-memory cache for content extraction
const extractionCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Problematic URLs that consistently fail - skip extraction for these
const problematicUrls = new Set<string>();
const PROBLEMATIC_URL_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  console.log('🔧 [SERVER] Content extraction API called');
  
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log('Content extraction: No session');
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { url, level }: { url: string; level: ExtractionLevel } = body;
    
    console.log('🔧 [SERVER] Extraction request:', { url, level });

    if (!url || !level) {
      return new NextResponse("Missing url or level", { status: 400 });
    }

    if (!['none', 'basic', 'full'].includes(level)) {
      return new NextResponse("Invalid extraction level", { status: 400 });
    }

    // Check if this URL is known to be problematic (but allow retry if force=true)
    const forceRetry = req.nextUrl.searchParams.get('force') === 'true';
    if (problematicUrls.has(url) && !forceRetry) {
      console.log('⚠️ [SERVER] Skipping extraction for problematic URL (use ?force=true to retry)');
      const fallbackResult = {
        success: true,
        content: `Document: ${url}\n\nNote: Content extraction was skipped due to previous failures. You can view the document directly at the link above.`,
        metadata: {
          type: url.includes('.pdf') ? 'pdf' : 'url',
          length: 0,
          processingTime: 1,
          extractionSkipped: true
        }
      };
      return NextResponse.json(fallbackResult);
    }
    
    // Clear from problematic list if we're force retrying
    if (forceRetry && problematicUrls.has(url)) {
      problematicUrls.delete(url);
      console.log('🔄 [SERVER] Cleared URL from problematic list for force retry');
    }

    // Check cache first
    const cacheKey = `${url}:${level}`;
    const cached = extractionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('📦 [SERVER] Returning cached result');
      return NextResponse.json(cached.result);
    }

    // Perform extraction with reasonable timeouts
    const extractionRequest: ExtractionRequest = {
      url,
      level,
      timeout: level === 'basic' ? 30000 : 90000, // 30s for basic, 90s for full (headings only)
      maxLength: level === 'basic' ? 4000 : 8000  // Reduced since we're only extracting headings
    };

    console.log('🚀 [SERVER] Starting extraction with request:', extractionRequest);
    const startTime = Date.now();
    const result = await contentExtractor.extract(extractionRequest);
    const totalTime = Date.now() - startTime;
    console.log('🏁 [SERVER] Extraction completed in', totalTime, 'ms');
    
    // Cache successful results
    if (result.success) {
      console.log('✅ [SERVER] Caching successful result');
      extractionCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
    } else {
      // Mark URL as problematic if extraction failed
      console.log('❌ [SERVER] Marking URL as problematic due to extraction failure');
      problematicUrls.add(url);
      // Remove from problematic list after cache duration
      setTimeout(() => {
        problematicUrls.delete(url);
      }, PROBLEMATIC_URL_CACHE_DURATION);
    }

    console.log('📈 [SERVER] Content extraction completed:', {
      success: result.success,
      contentLength: result.content?.length || 0,
      processingTime: result.metadata?.processingTime || 0,
      totalServerTime: totalTime,
      errorType: result.metadata?.errorType,
      isRetryable: result.metadata?.isRetryable
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Content extraction API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      metadata: {
        type: 'unknown' as const,
        length: 0,
        processingTime: 0
      }
    }, { status: 500 });
  }
}

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of extractionCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      extractionCache.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes