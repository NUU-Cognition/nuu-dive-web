// HTML parsing and content extraction

import { HTMLParseResult, DocumentStructure } from './types';

export class HTMLParser {
  private static instance: HTMLParser;
  
  static getInstance(): HTMLParser {
    if (!HTMLParser.instance) {
      HTMLParser.instance = new HTMLParser();
    }
    return HTMLParser.instance;
  }

  async parseFromUrl(url: string, timeout = 10000): Promise<HTMLParseResult> {
    try {
      // Step 1: HEAD request to check content type and size (optimization)
      const headResponse = await fetch(url, { 
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/1.0)'
        }
      });

      const contentType = headResponse.headers.get('content-type') || '';
      const contentLength = headResponse.headers.get('content-length');
      
      // Enhanced content type validation
      if (!this.isValidContentType(contentType)) {
        throw new Error(`Invalid content type: ${contentType}. Expected HTML or text content.`);
      }
      
      // Check content size (optional - some servers don't provide content-length)
      if (contentLength) {
        const sizeInMB = parseInt(contentLength) / (1024 * 1024);
        if (sizeInMB > 50) {
          throw new Error(`Content too large: ${sizeInMB.toFixed(1)}MB. Maximum supported size is 50MB.`);
        }
      }

      // Step 2: Full request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Step 3: Check if we got meaningful content
      const initialParse = this.parseHTML(html);
      
      // If we got very little content, might be a JavaScript-heavy site
      if (initialParse.mainContent.length < 100) {
        console.warn('Very little content extracted, page might be JavaScript-heavy');
        // Note: In a real implementation, this is where we'd trigger Selenium fallback
        // For now, we'll return what we have with a warning
        initialParse.metadata.lowContent = true;
      }

      return initialParse;
    } catch (error) {
      throw new Error(`Failed to fetch HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  parseHTML(html: string): HTMLParseResult {
    // Use a simple regex-based parser for server-side compatibility
    const result: HTMLParseResult = {
      mainContent: '',
      headings: [],
      links: [],
      images: [],
      metadata: {}
    };

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.title = this.cleanText(titleMatch[1]);
    }

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=['"]description['"][^>]*content=['"]([^'"]+)['"][^>]*>/i);
    if (descMatch) {
      result.metadata.description = this.cleanText(descMatch[1]);
    }

    // Extract headings (h1-h6)
    const headingRegex = /<h([1-6])[^>]*>([^<]+)<\/h[1-6]>/gi;
    let headingMatch;
    while ((headingMatch = headingRegex.exec(html)) !== null) {
      result.headings.push({
        level: parseInt(headingMatch[1]),
        text: this.cleanText(headingMatch[2])
      });
    }

    // Extract main content (remove non-content elements more aggressively)
    let cleanedHTML = html
      // Remove scripts, styles, and metadata
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove navigation and structural elements
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      // Remove form elements and ads
      .replace(/<form[\s\S]*?<\/form>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      // Remove common ad/tracking divs and unwanted content
      .replace(/<div[^>]*class=['"][^'"]*(?:ad|advertisement|sidebar|widget|popup|modal|cookie|banner|social|share|menu|breadcrumb)[^'"]*['"][^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*id=['"][^'"]*(?:ad|advertisement|sidebar|widget|popup|modal|cookie|banner|social|share|menu|breadcrumb)[^'"]*['"][^>]*>[\s\S]*?<\/div>/gi, '')
      // Remove SVG icons and decorative elements
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<img[^>]*(?:icon|logo|banner)[^>]*>/gi, '')
      // Remove video and audio elements
      .replace(/<video[\s\S]*?<\/video>/gi, '')
      .replace(/<audio[\s\S]*?<\/audio>/gi, '')
      // Remove common non-content elements
      .replace(/<(?:button|input|select|textarea)[\s\S]*?>/gi, '');

    // Try to find main content area
    const mainContentRegex = /<(?:main|article|div[^>]*class=['"][^'"]*(?:content|main|article)[^'"]*['"])[^>]*>([\s\S]*?)<\/(?:main|article|div)>/i;
    const mainMatch = cleanedHTML.match(mainContentRegex);
    
    if (mainMatch) {
      cleanedHTML = mainMatch[1];
    }

    // Extract text content
    result.mainContent = this.extractTextContent(cleanedHTML);

    // Extract links
    const linkRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      result.links.push({
        href: linkMatch[1],
        text: this.cleanText(linkMatch[2])
      });
    }

    // Extract images
    const imgRegex = /<img[^>]*src=['"]([^'"]+)['"][^>]*(?:alt=['"]([^'"]+)['"])?[^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      result.images.push({
        src: imgMatch[1],
        alt: imgMatch[2] ? this.cleanText(imgMatch[2]) : undefined
      });
    }

    return result;
  }

  structureContent(parsed: HTMLParseResult): DocumentStructure {
    const structure: DocumentStructure = {
      title: parsed.title,
      headings: parsed.headings.map((h, index) => ({
        ...h,
        position: index
      })),
      sections: [],
      metadata: {
        wordCount: 0,
        estimatedReadTime: 0
      }
    };

    // Split content into sections based on headings
    const content = parsed.mainContent;
    const words = content.split(/\s+/).length;
    structure.metadata.wordCount = words;
    structure.metadata.estimatedReadTime = Math.ceil(words / 200); // 200 words per minute

    // Create sections based on headings
    if (parsed.headings.length === 0) {
      // No headings, treat as single section
      structure.sections.push({
        content: content,
        importance: 8
      });
    } else {
      // Split by headings
      let currentSection = '';
      let currentHeading = '';
      
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Check if this line matches a heading
        const isHeading = parsed.headings.some(h => 
          this.normalizeText(h.text) === this.normalizeText(trimmedLine)
        );

        if (isHeading) {
          // Save previous section if it has content
          if (currentSection.trim()) {
            structure.sections.push({
              heading: currentHeading,
              content: currentSection.trim(),
              importance: this.calculateImportance(currentHeading, currentSection)
            });
          }
          currentHeading = trimmedLine;
          currentSection = '';
        } else {
          currentSection += line + '\n';
        }
      }

      // Add final section
      if (currentSection.trim()) {
        structure.sections.push({
          heading: currentHeading,
          content: currentSection.trim(),
          importance: this.calculateImportance(currentHeading, currentSection)
        });
      }
    }

    return structure;
  }

  private extractTextContent(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private cleanText(text: string): string {
    return text
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  }

  private calculateImportance(heading: string, content: string): number {
    let importance = 5; // Base importance

    // Higher importance for longer content
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 100) importance += 2;
    if (wordCount > 500) importance += 1;

    // Higher importance for certain keywords in headings
    const importantKeywords = ['introduction', 'overview', 'summary', 'conclusion', 'key', 'important', 'main'];
    const lowerHeading = heading.toLowerCase();
    
    for (const keyword of importantKeywords) {
      if (lowerHeading.includes(keyword)) {
        importance += 1;
        break;
      }
    }

    return Math.min(10, Math.max(1, importance));
  }

  private isValidContentType(contentType: string): boolean {
    const validTypes = [
      'text/html',
      'text/plain',
      'application/xhtml+xml',
      'text/xml',
      'application/xml'
    ];
    
    return validTypes.some(type => contentType.toLowerCase().includes(type));
  }

  generateStructuredMarkdown(parsed: HTMLParseResult): string {
    const lines: string[] = [];
    
    // Add title if available
    if (parsed.title) {
      lines.push(`# ${parsed.title}`);
      lines.push('');
    }
    
    // Add meta description if available
    if (parsed.metadata.description) {
      lines.push('## Page Overview');
      lines.push(parsed.metadata.description);
      lines.push('');
    }
    
    // Add structured outline from headings
    if (parsed.headings.length > 0) {
      lines.push('## Page Structure');
      lines.push('');
      
      parsed.headings.forEach(heading => {
        // Convert heading levels to markdown (h1->##, h2->###, etc.)
        const markdownLevel = '#'.repeat(heading.level + 1);
        lines.push(`${markdownLevel} ${heading.text}`);
      });
      lines.push('');
    }
    
    // Add important links if available
    const importantLinks = parsed.links
      ?.filter(link => link.text && link.text.length > 3)
      .slice(0, 10); // Limit to top 10 links
      
    if (importantLinks && importantLinks.length > 0) {
      lines.push('## Important Links');
      importantLinks.forEach(link => {
        lines.push(`- [${link.text}](${link.href})`);
      });
      lines.push('');
    }
    
    // Add a brief content summary
    if (parsed.mainContent) {
      const wordCount = parsed.mainContent.split(/\s+/).length;
      const readTime = Math.ceil(wordCount / 200);
      
      lines.push('## Content Summary');
      lines.push(`- Word count: ~${wordCount} words`);
      lines.push(`- Estimated read time: ${readTime} minute${readTime !== 1 ? 's' : ''}`);
      
      // Add first paragraph as preview
      const firstParagraph = parsed.mainContent.split('\n')[0]?.trim();
      if (firstParagraph && firstParagraph.length > 50) {
        lines.push(`- Preview: ${firstParagraph.substring(0, 200)}${firstParagraph.length > 200 ? '...' : ''}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private isJavaScriptHeavy(html: string): boolean {
    // Check for indicators of JavaScript-heavy pages
    const jsIndicators = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /document\.createElement/gi,
      /innerHTML/gi,
      /react/gi,
      /angular/gi,
      /vue/gi
    ];
    
    let jsScore = 0;
    for (const indicator of jsIndicators) {
      const matches = html.match(indicator);
      if (matches) {
        jsScore += matches.length;
      }
    }
    
    // If we have a high ratio of JS to content, consider it JS-heavy
    const contentLength = this.extractTextContent(html).length;
    return jsScore > 10 && (jsScore / Math.max(contentLength, 1)) > 0.1;
  }
}