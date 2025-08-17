// Types for the modular extraction system

export type ExtractionLevel = 'none' | 'basic' | 'full';

export type ContentType = 'url' | 'pdf' | 'html';

export interface ExtractionRequest {
  url: string;
  level: ExtractionLevel;
  type?: ContentType; // Auto-detected if not provided
  maxLength?: number;
  timeout?: number;
}

export interface ExtractionResult {
  success: boolean;
  content?: string;
  metadata?: {
    title?: string;
    type: ContentType;
    length: number;
    pageCount?: number;
    extractedSections?: string[];
    processingTime: number;
    errorType?: string;
    isRetryable?: boolean;
  };
  error?: string;
}

export interface DocumentStructure {
  title?: string;
  headings: {
    level: number;
    text: string;
    position: number;
  }[];
  sections: {
    heading?: string;
    content: string;
    importance: number; // 1-10 scale
  }[];
  metadata: {
    wordCount: number;
    estimatedReadTime: number;
  };
}

export interface HTMLParseResult {
  title?: string;
  mainContent: string;
  headings: Array<{
    level: number;
    text: string;
  }>;
  links: Array<{
    text: string;
    href: string;
  }>;
  images: Array<{
    alt?: string;
    src: string;
  }>;
  metadata: {
    description?: string;
    keywords?: string[];
    lowContent?: boolean;
    errorType?: string;
    isRetryable?: boolean;
  };
}