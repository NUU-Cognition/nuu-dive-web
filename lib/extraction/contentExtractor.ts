// Main content extraction orchestrator

import { ExtractionRequest, ExtractionResult, ContentType } from './types';
import { HTMLParser } from './htmlParser';
import { PDFExtractor } from './pdfExtractor';
import { ExtractionErrorHandler } from './errorHandler';
import { GeminiExtractor } from './geminiExtractor';

export class ContentExtractor {
  private static instance: ContentExtractor;
  private htmlParser: HTMLParser;
  private pdfExtractor: PDFExtractor;
  private geminiExtractor: GeminiExtractor | null = null;

  constructor() {
    this.htmlParser = HTMLParser.getInstance();
    this.pdfExtractor = PDFExtractor.getInstance();
    
    // Initialize Gemini extractor if API key is available
    try {
      this.geminiExtractor = GeminiExtractor.getInstance();
      console.log('🤖 [EXTRACTOR] Gemini extractor available');
    } catch (error) {
      console.warn('⚠️ [EXTRACTOR] Gemini extractor not available:', error.message);
      this.geminiExtractor = null;
    }
  }

  static getInstance(): ContentExtractor {
    if (!ContentExtractor.instance) {
      ContentExtractor.instance = new ContentExtractor();
    }
    return ContentExtractor.instance;
  }

  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    const startTime = Date.now();
    console.log('🔍 [EXTRACTOR] Starting extraction for:', request.url);
    console.log('🔍 [EXTRACTOR] Level:', request.level);
    console.log('🔍 [EXTRACTOR] Timeout:', request.timeout);

    try {
      // Auto-detect content type if not provided
      console.log('🔍 [EXTRACTOR] Detecting content type...');
      const contentType = request.type || await this.detectContentType(request.url);
      console.log('🔍 [EXTRACTOR] Detected content type:', contentType);
      
      // Set appropriate timeout and length limits based on extraction level
      const timeout = request.timeout || (request.level === 'basic' ? 10000 : 20000);
      const maxLength = request.maxLength || (request.level === 'basic' ? 3000 : 8000);

      let result: { content: string; metadata: any };

      if (contentType === 'pdf') {
        console.log('📄 [EXTRACTOR] Processing PDF document...');
        
        // Determine if we should use Gemini based on various factors
        const shouldUseGemini = this.shouldUseGeminiForPdf(request.url, request.level);
        
        if (shouldUseGemini && this.geminiExtractor) {
          console.log('🤖 [EXTRACTOR] Using Gemini for PDF extraction...');
          try {
            const geminiResult = await this.geminiExtractor.extractFromUrl(request.url, request.level);
            if (geminiResult.success) {
              result = {
                content: geminiResult.content,
                metadata: geminiResult.metadata
              };
              console.log('✅ [EXTRACTOR] Gemini PDF extraction successful, content length:', result.content.length);
            } else {
              throw new Error(geminiResult.metadata.error || 'Gemini extraction failed');
            }
          } catch (geminiError) {
            console.warn('⚠️ [EXTRACTOR] Gemini extraction failed, falling back to traditional PDF extraction:', geminiError);
            // Fallback to traditional PDF extraction
            result = await this.pdfExtractor.extractFromUrl(request.url, request.level, timeout);
            console.log('📄 [EXTRACTOR] Fallback PDF extraction completed, content length:', result.content.length);
          }
        } else {
          console.log('📄 [EXTRACTOR] Using traditional PDF extraction...');
          result = await this.pdfExtractor.extractFromUrl(request.url, request.level, timeout);
          console.log('📄 [EXTRACTOR] PDF extraction completed, content length:', result.content.length);
        }
      } else {
        console.log('🌐 [EXTRACTOR] Processing HTML/URL content...');
        const parsed = await this.htmlParser.parseFromUrl(request.url, timeout);
        console.log('🌐 [EXTRACTOR] HTML parsed, main content length:', parsed.mainContent.length);
        
        // Generate structured markdown outline (similar to Gemini's output for PDFs)
        const structuredMarkdown = this.htmlParser.generateStructuredMarkdown(parsed);
        console.log('🌐 [EXTRACTOR] Generated structured markdown, length:', structuredMarkdown.length);
        
        result = {
          content: structuredMarkdown,
          metadata: {
            title: parsed.title,
            type: 'html' as ContentType,
            headingsCount: parsed.headings.length,
            processingTime: Date.now() - startTime
          }
        };
        console.log('🌐 [EXTRACTOR] HTML extraction completed, final content length:', result.content.length);
      }

      const processingTime = Date.now() - startTime;

      const finalResult = {
        success: true,
        content: result.content,
        metadata: {
          ...result.metadata,
          type: contentType,
          length: result.content.length,
          processingTime
        }
      };
      
      console.log('✅ [EXTRACTOR] Extraction successful!');
      console.log('✅ [EXTRACTOR] Final content length:', finalResult.content.length);
      console.log('✅ [EXTRACTOR] Processing time:', processingTime, 'ms');
      
      return finalResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const categorizedError = ExtractionErrorHandler.categorizeError(error, request.url);
      
      return {
        success: false,
        error: categorizedError.message,
        metadata: {
          type: request.type || await this.detectContentType(request.url),
          length: 0,
          processingTime,
          errorType: categorizedError.type,
          isRetryable: categorizedError.isRetryable,
          suggestedAction: categorizedError.suggestedAction
        }
      };
    }
  }

  async detectContentType(url: string): Promise<ContentType> {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // Direct file extension detection
      if (pathname.endsWith('.pdf')) {
        return 'pdf';
      }
      
      // Other document types that should be treated as URLs
      if (pathname.match(/\.(doc|docx|xls|xlsx|ppt|pptx|txt|rtf)$/)) {
        return 'url'; // These will be handled as download links
      }
      
      // PDF detection in various URL patterns
      if (url.includes('.pdf') || 
          url.includes('/pdf/') || 
          url.includes('filetype=pdf') ||
          url.includes('type=pdf') ||
          pathname.includes('pdf')) {
        return 'pdf';
      }
      
      // Enhanced detection with HEAD request for ambiguous URLs
      try {
        const headResponse = await fetch(url, { 
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/1.0)'
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout for HEAD request
        });
        
        const contentType = headResponse.headers.get('content-type') || '';
        
        if (contentType.includes('application/pdf')) {
          return 'pdf';
        }
        
        if (contentType.includes('text/html') || 
            contentType.includes('text/plain') ||
            contentType.includes('application/xhtml+xml')) {
          return 'url';
        }
      } catch (headError) {
        // HEAD request failed, continue with URL analysis
        console.warn('HEAD request failed for content type detection:', headError);
      }
      
      // Default to URL for web content
      return 'url';
    } catch {
      return 'url';
    }
  }

  private extractFromStructure(structure: any, level: string, maxLength: number): { content: string; metadata: any } {
    let content = '';
    
    if (level === 'basic') {
      // Basic: Title + key headings + summary
      if (structure.title) {
        content += `# ${structure.title}\n\n`;
      }
      
      // Add main headings for structure overview
      if (structure.headings && structure.headings.length > 0) {
        content += '## Document Structure:\n';
        structure.headings.slice(0, 8).forEach((heading: any) => {
          content += `${'#'.repeat(heading.level + 1)} ${heading.text}\n`;
        });
        content += '\n';
      }
      
      // Add high-importance sections only
      const importantSections = structure.sections
        .filter((section: any) => section.importance >= 7)
        .slice(0, 3);
      
      if (importantSections.length > 0) {
        content += '## Key Content:\n\n';
        for (const section of importantSections) {
          if (section.heading) {
            content += `### ${section.heading}\n`;
          }
          content += `${section.content.substring(0, 500)}\n\n`;
        }
      }
      
    } else if (level === 'full') {
      // Full: Complete structured content
      if (structure.title) {
        content += `# ${structure.title}\n\n`;
      }
      
      // Add all sections with their headings
      for (const section of structure.sections) {
        if (section.heading) {
          content += `## ${section.heading}\n\n`;
        }
        content += `${section.content}\n\n`;
      }
    }
    
    // Apply length limit
    if (content.length > maxLength) {
      content = content.substring(0, maxLength);
      const lastPeriod = content.lastIndexOf('.');
      if (lastPeriod > maxLength * 0.8) {
        content = content.substring(0, lastPeriod + 1);
      }
      content += '\n\n[Content truncated...]';
    }
    
    return {
      content,
      metadata: {
        wordCount: structure.metadata.wordCount,
        estimatedReadTime: structure.metadata.estimatedReadTime,
        sectionsExtracted: structure.sections.length
      }
    };
  }

  private shouldUseGeminiForPdf(url: string, level: string): boolean {
    // New hybrid strategy:
    // - Basic extraction: Traditional PDF parsing (first 5 pages) - fast and reliable
    // - Full extraction: Gemini analysis for structure/headings - comprehensive
    
    if (!this.geminiExtractor) {
      console.log('🤖 [EXTRACTOR] Gemini not available, using traditional extraction');
      return false;
    }
    
    // Use Gemini ONLY for full extraction (structure analysis)
    // Use traditional PDF parsing for basic extraction (first 5 pages)
    const useGemini = level === 'full';
    
    if (useGemini) {
      console.log('🤖 [EXTRACTOR] Using Gemini for full extraction (document structure analysis)');
    } else {
      console.log('🤖 [EXTRACTOR] Using traditional PDF extraction for basic extraction (first 5 pages)');
    }
    
    return useGemini;
  }
}

// Export singleton instance
export const contentExtractor = ContentExtractor.getInstance();