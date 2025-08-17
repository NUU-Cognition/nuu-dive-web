// PDF structure-based extraction

import { DocumentStructure, ExtractionLevel } from './types';

export class PDFExtractor {
  private static instance: PDFExtractor;
  
  static getInstance(): PDFExtractor {
    if (!PDFExtractor.instance) {
      PDFExtractor.instance = new PDFExtractor();
    }
    return PDFExtractor.instance;
  }

  async extractFromUrl(url: string, level: ExtractionLevel, timeout = 60000): Promise<{
    content: string;
    metadata: any;
  }> {
    if (level === 'none') {
      return {
        content: `PDF Document: ${url}\n\nNote: No content extraction was requested for this PDF.`,
        metadata: { pageCount: 0, extractedPages: 0, processingTime: 0 }
      };
    }

    const startTime = Date.now();

    try {
      // First, do a HEAD request to check file size before downloading
      if (level === 'basic') {
        try {
          const headResponse = await fetch(url, { 
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PDFExtractor/1.0)' }
          });
          
          const contentLength = headResponse.headers.get('content-length');
          if (contentLength) {
            const fileSizeBytes = parseInt(contentLength);
            const fileSizeMB = fileSizeBytes / (1024 * 1024);
            
            console.log(`PDF size: ${fileSizeMB.toFixed(1)}MB`);
            
            // For basic extraction, skip large PDFs to avoid timeouts
            if (fileSizeMB > 20) {
              console.warn(`Large PDF detected: ${fileSizeMB.toFixed(1)}MB, skipping basic extraction to avoid timeout`);
              return {
                content: `# ${url.split('/').pop() || 'PDF Document'}\n\n## Document Information\n\n- **Size**: ${fileSizeMB.toFixed(1)}MB\n- **Source**: [View PDF](${url})\n- **Note**: File too large for basic extraction. Use full extraction for content analysis.\n\n## Recommendation\n\nThis PDF is quite large (${fileSizeMB.toFixed(1)}MB). For better results, try using **Full Extraction** which uses advanced analysis to extract the document structure and key sections.`,
                metadata: { 
                  pageCount: 0, 
                  extractedPages: 0, 
                  processingTime: Date.now() - startTime,
                  skippedReason: 'file_too_large_for_basic',
                  fileSizeMB 
                }
              };
            }
          }
        } catch (headError) {
          console.warn('Could not check file size with HEAD request, proceeding with download');
        }
      }

      // Fetch PDF with timeout
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
        throw new Error(`Failed to fetch PDF: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Use pdf2json for extraction
      const PDFParser = (await import('pdf2json')).default;
      
      const extractedData = await Promise.race([
        new Promise<{text: string; structure: any}>((resolve, reject) => {
          const pdfParser = new PDFParser();
          
          pdfParser.on('pdfParser_dataError', (errData: any) => {
            reject(new Error(errData.parserError || 'PDF parsing failed'));
          });
          
          pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
            try {
              const result = this.extractStructuredContent(pdfData, level);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          });
          
          pdfParser.parseBuffer(buffer);
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`PDF parsing timeout after ${timeout}ms`));
          }, Math.min(timeout, 120000)); // Max 2 minutes for PDF parsing
        })
      ]);

      const processingTime = Date.now() - startTime;

      // Apply level-based filtering
      const filteredContent = this.applyExtractionLevel(extractedData.text, extractedData.structure, level);

      return {
        content: `# ${extractedData.structure.title || 'PDF Document'}\n\n**Source:** ${url}\n\n---\n\n${filteredContent}`,
        metadata: {
          pageCount: extractedData.structure.pageCount || 0,
          extractedPages: level === 'basic' ? Math.min(5, extractedData.structure.pageCount || 0) : maxPages,
          fileSize: buffer.length,
          title: extractedData.structure.title || 'PDF Document',
          processingTime
        }
      };

    } catch (error) {
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractStructuredContent(pdfData: any, level: ExtractionLevel): {text: string; structure: any} {
    let allText = '';
    let pageCount = 0;
    const headings: Array<{text: string; page: number; fontSize: number}> = [];
    const sections: Array<{heading?: string; content: string; page: number}> = [];

    if (pdfData.Pages) {
      pageCount = pdfData.Pages.length;
      
      // Limit pages based on extraction level and file size for performance
      let maxPages;
      if (level === 'basic') {
        maxPages = Math.min(5, pageCount); // Extract first 5 pages for basic
      } else {
        // For full extraction, be more generous but still reasonable
        maxPages = Math.min(25, pageCount);
      }
      
      for (let i = 0; i < maxPages; i++) {
        const page = pdfData.Pages[i];
        let pageText = '';
        
        if (page.Texts) {
          // Group texts by line and analyze formatting
          const textsByLine = this.groupTextsByLine(page.Texts);
          
          for (const lineTexts of textsByLine) {
            const lineText = lineTexts.map(t => this.decodeText(t.text)).join(' ');
            const avgFontSize = lineTexts.reduce((sum, t) => sum + (t.fontSize || 12), 0) / lineTexts.length;
            
            // Detect headings by font size and formatting
            if (this.isHeading(lineText, avgFontSize, lineTexts)) {
              headings.push({
                text: lineText,
                page: i + 1,
                fontSize: avgFontSize
              });
            }
            
            pageText += lineText + '\n';
          }
        }
        
        allText += pageText;
        
        // Create page section
        sections.push({
          content: pageText,
          page: i + 1
        });
      }
    }

    return {
      text: allText.trim(),
      structure: {
        pageCount,
        headings,
        sections,
        title: this.extractTitle(headings, allText)
      }
    };
  }

  private groupTextsByLine(texts: any[]): Array<Array<{text: string; fontSize?: number; fontFace?: string}>> {
    const lineGroups: Array<Array<{text: string; fontSize?: number; fontFace?: string; y: number}>> = [];
    
    for (const textItem of texts) {
      if (textItem.R) {
        for (const run of textItem.R) {
          if (run.T) {
            const textData = {
              text: run.T,
              fontSize: run.TS?.[1], // Font size
              fontFace: run.TS?.[0], // Font face
              y: textItem.y || 0
            };
            
            // Find or create line group based on y-position
            let lineGroup = lineGroups.find(group => 
              Math.abs(group[0].y - textData.y) < 0.5 // Tolerance for same line
            );
            
            if (!lineGroup) {
              lineGroup = [];
              lineGroups.push(lineGroup);
            }
            
            lineGroup.push(textData);
          }
        }
      }
    }
    
    // Sort lines by y-position (top to bottom)
    lineGroups.sort((a, b) => b[0].y - a[0].y);
    
    return lineGroups;
  }

  private isHeading(text: string, fontSize: number, textItems: any[]): boolean {
    // Heading detection heuristics
    const trimmedText = text.trim();
    
    // Skip very short or very long text
    if (trimmedText.length < 3 || trimmedText.length > 100) return false;
    
    // Check for common heading patterns
    const headingPatterns = [
      /^chapter\s+\d+/i,
      /^\d+\.\s+/,
      /^\d+\.\d+\s+/,
      /^[A-Z][A-Z\s]{2,20}$/,
      /^(introduction|overview|summary|conclusion|background|methodology|results|discussion)/i
    ];
    
    const matchesPattern = headingPatterns.some(pattern => pattern.test(trimmedText));
    
    // Check font size (assuming headings are larger)
    const isLargerFont = fontSize > 13;
    
    // Check if text is bold or different font
    const isBold = textItems.some(item => 
      item.fontFace && (item.fontFace.includes('Bold') || item.fontFace.includes('bold'))
    );
    
    return matchesPattern || (isLargerFont && isBold) || (isLargerFont && trimmedText.length < 50);
  }

  private extractTitle(headings: any[], allText: string): string {
    // Try to find title from first heading or document start
    if (headings.length > 0) {
      const firstHeading = headings[0];
      if (firstHeading.page === 1 && firstHeading.text.length < 100) {
        return firstHeading.text;
      }
    }
    
    // Fallback: use first line of document
    const firstLine = allText.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100) {
      return firstLine;
    }
    
    return 'PDF Document';
  }

  private applyExtractionLevel(text: string, structure: any, level: ExtractionLevel): string {
    if (level === 'basic') {
      // Basic: Title + headings + first few sections
      let result = '';
      
      if (structure.title) {
        result += `## ${structure.title}\n\n`;
      }
      
      // Add main headings
      if (structure.headings && structure.headings.length > 0) {
        result += '## Document Structure\n\n';
        structure.headings.slice(0, 10).forEach((heading: any) => {
          result += `- **${heading.text}** (Page ${heading.page})\n`;
        });
        result += '\n';
      }
      
      // Add meaningful content from first 5 pages
      const limitedText = this.formatAsMarkdown(text.substring(0, 6000));
      result += '## Content from First 5 Pages\n\n' + limitedText;
      
      if (text.length > 6000) {
        result += '\n\n---\n*Content shows first 5 pages only. Use full extraction for complete document structure.*';
      }
      
      return result;
      
    } else if (level === 'full') {
      // Full: Structured content with headings
      let result = '';
      
      if (structure.title) {
        result += `## ${structure.title}\n\n`;
      }
      
      // Organize content by sections with headings
      if (structure.headings && structure.headings.length > 0) {
        let lastPos = 0;
        
        for (const heading of structure.headings) {
          // Add content before this heading
          if (lastPos < text.length) {
            const sectionText = text.substring(lastPos, text.indexOf(heading.text, lastPos));
            if (sectionText.trim()) {
              result += this.formatAsMarkdown(sectionText.trim()) + '\n\n';
            }
          }
          
          // Add heading with proper markdown level
          result += `### ${heading.text}\n\n`;
          lastPos = text.indexOf(heading.text, lastPos) + heading.text.length;
        }
        
        // Add remaining content
        if (lastPos < text.length) {
          result += this.formatAsMarkdown(text.substring(lastPos).trim());
        }
      } else {
        // No headings, return full text with reasonable length limit and markdown formatting
        const contentToFormat = text.substring(0, 15000);
        result = this.formatAsMarkdown(contentToFormat);
        if (text.length > 15000) {
          result += '\n\n---\n*Content truncated - extracted from first ' + structure.sections.length + ' pages*';
        }
      }
      
      return result;
    }
    
    return text;
  }

  private decodeText(encodedText: string): string {
    try {
      return decodeURIComponent(encodedText);
    } catch {
      return encodedText;
    }
  }

  private formatAsMarkdown(text: string): string {
    return text
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      // Format paragraphs
      .split('\n\n')
      .map(paragraph => paragraph.trim())
      .filter(paragraph => paragraph.length > 0)
      .join('\n\n');
  }
}