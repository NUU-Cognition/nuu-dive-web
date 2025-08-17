// In-memory cache for PDF content (in production, use Redis or database)
const pdfCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Server-side PDF extraction using pdf-parse (Node.js compatible)
async function parsePdfFromUrl(url: string): Promise<string> {
  // Check cache first
  const cached = pdfCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached PDF content for: ${url}`);
    return cached.content;
  }

  try {
    console.log(`Fetching and parsing PDF: ${url}`);
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
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
    
    // Use pdf-parse for server-side extraction
    const pdf = await import('pdf-parse');
    const data = await pdf.default(buffer);
    
    // Cache the result
    pdfCache.set(url, {
      content: data.text,
      timestamp: Date.now()
    });
    
    console.log(`Successfully extracted ${data.text.length} characters from PDF`);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF from URL:', error);
    throw error;
  }
}

export interface PDFTextResult {
  text: string;
  pageCount: number;
  title?: string;
  error?: string;
}

export async function extractPDFText(url: string): Promise<PDFTextResult> {
  try {
    // Use server-side PDF parsing
    const text = await parsePdfFromUrl(url);
    
    // Estimate page count (rough approximation)
    const estimatedPageCount = Math.ceil(text.length / 3000); // ~3000 chars per page
    
    return {
      text,
      pageCount: estimatedPageCount,
      title: `PDF Document (${estimatedPageCount} pages)`,
    };
  } catch (error) {
    console.error('Failed to extract PDF text:', error);
    return {
      text: `[PDF Document from ${url}]\n\nError: Unable to extract text from this PDF. ${error instanceof Error ? error.message : 'Unknown error'}`,
      pageCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function summarizePDFForContext(url: string, maxLength: number = 1500): Promise<string> {
  try {
    // Add timeout for context assembly
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('PDF extraction timeout')), 15000); // 15 second timeout
    });
    
    const result = await Promise.race([
      extractPDFText(url),
      timeoutPromise
    ]);
    
    if (result.error || !result.text) {
      return `PDF Document: ${url} (text extraction failed: ${result.error || 'unknown error'})`;
    }
    
    const text = result.text;
    
    if (text.length <= maxLength) {
      return `PDF Content from ${url}:\n${text}`;
    }
    
    // Truncate if too long - try to end at a sentence
    let truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > maxLength * 0.8) {
      truncated = truncated.substring(0, lastPeriod + 1);
    }
    
    return `PDF Content from ${url}:\n${truncated}...\n\n[Content truncated for context - this is a ${result.pageCount}-page PDF document]`;
  } catch (error) {
    console.error('PDF summarization failed:', error);
    return `PDF Document: ${url} (extraction failed: ${error instanceof Error ? error.message : 'timeout or unknown error'})`;
  }
}