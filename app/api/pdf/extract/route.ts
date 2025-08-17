// Server-only API endpoint for PDF extraction
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// In-memory cache for PDF content
const pdfCache = new Map<string, { content: string; metadata: any; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function extractPDFFromUrl(url: string, level: 'basic' | 'full'): Promise<{
  success: boolean;
  content?: string;
  metadata?: any;
  error?: string;
}> {
  // Check cache first
  const cacheKey = `${url}:${level}`;
  const cached = pdfCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return {
      success: true,
      content: cached.content,
      metadata: cached.metadata
    };
  }

  try {
    // Add timeout based on extraction level
    const timeout = level === 'basic' ? 15000 : 45000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PDFExtractor/1.0)'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Use pdf2json for extraction (server-side only)
    const PDFParser = (await import('pdf2json')).default;
    
    const data = await new Promise<{text: string; numpages: number}>((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        reject(new Error(errData.parserError));
      });
      
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          // Extract text from all pages
          let allText = '';
          let pageCount = 0;
          
          if (pdfData.Pages) {
            pageCount = pdfData.Pages.length;
            
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const textItem of page.Texts) {
                  if (textItem.R) {
                    for (const run of textItem.R) {
                      if (run.T) {
                        // Decode URI component to get actual text
                        allText += decodeURIComponent(run.T) + ' ';
                      }
                    }
                  }
                }
              }
              allText += '\n';
            }
          }
          
          resolve({
            text: allText.trim(),
            numpages: pageCount
          });
        } catch (error) {
          reject(error);
        }
      });
      
      // Parse the buffer
      pdfParser.parseBuffer(buffer);
    });
    
    // Apply extraction level limits
    const maxLength = level === 'basic' ? 3000 : 8000;
    let extractedContent = data.text;
    
    // Truncate if needed
    if (extractedContent.length > maxLength) {
      extractedContent = extractedContent.substring(0, maxLength);
      const lastPeriod = extractedContent.lastIndexOf('.');
      if (lastPeriod > maxLength * 0.8) {
        extractedContent = extractedContent.substring(0, lastPeriod + 1);
      }
      extractedContent += '\n\n[Content truncated...]';
    }
    
    const result = {
      content: `PDF Content from ${url}:\n\n${extractedContent}`,
      metadata: {
        pageCount: data.numpages || 0,
        extractedPages: level === 'basic' ? Math.min(5, data.numpages || 0) : Math.min(20, data.numpages || 0),
        fileSize: buffer.length,
        title: 'PDF Document'
      }
    };
    
    // Cache the result
    pdfCache.set(cacheKey, {
      ...result,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      ...result
    };
    
  } catch (error) {
    console.error('PDF extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function POST(req: NextRequest) {
  console.log('PDF extraction API called');
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log('PDF extraction: No session');
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { url, level } = body;
    console.log('PDF extraction request:', { url, level });

    if (!url || !level) {
      return new NextResponse("Missing url or level", { status: 400 });
    }

    if (level === 'none') {
      return NextResponse.json({
        success: true,
        content: `PDF Document: ${url}\n\nNote: No content extraction was requested for this PDF.`,
        metadata: { pageCount: 0, extractedPages: 0 }
      });
    }

    const result = await extractPDFFromUrl(url, level);
    return NextResponse.json(result);

  } catch (error) {
    console.error('PDF extraction API error:', error);
    return new NextResponse(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}