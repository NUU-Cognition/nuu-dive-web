// Enhanced error handling and categorization for content extraction

export enum ExtractionErrorType {
  NETWORK_ERROR = 'network_error',
  CONTENT_TYPE_ERROR = 'content_type_error',
  SIZE_LIMIT_ERROR = 'size_limit_error',
  TIMEOUT_ERROR = 'timeout_error',
  PARSING_ERROR = 'parsing_error',
  PERMISSION_ERROR = 'permission_error',
  JAVASCRIPT_HEAVY = 'javascript_heavy',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface CategorizedError {
  type: ExtractionErrorType;
  message: string;
  originalError?: Error;
  isRetryable: boolean;
  suggestedAction?: string;
}

export class ExtractionErrorHandler {
  static categorizeError(error: unknown, url?: string): CategorizedError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Network-related errors
    if (errorMessage.includes('fetch') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      return {
        type: ExtractionErrorType.NETWORK_ERROR,
        message: 'Failed to connect to the website. Please check your internet connection and try again.',
        originalError: error instanceof Error ? error : undefined,
        isRetryable: true,
        suggestedAction: 'Check internet connection and try again'
      };
    }
    
    // Content type errors
    if (errorMessage.includes('Invalid content type') || errorMessage.includes('Expected HTML')) {
      return {
        type: ExtractionErrorType.CONTENT_TYPE_ERROR,
        message: 'This URL does not contain extractable content. Only HTML pages and PDF documents are supported.',
        originalError: error instanceof Error ? error : undefined,
        isRetryable: false,
        suggestedAction: 'Verify the URL points to a webpage or PDF document'
      };
    }
    
    // Size limit errors
    if (errorMessage.includes('too large') || errorMessage.includes('size limit') || errorMessage.includes('MB limit')) {
      return {
        type: ExtractionErrorType.SIZE_LIMIT_ERROR,
        message: 'The document is too large to extract. Large documents are saved as references instead.',
        originalError: error instanceof Error ? error : undefined,
        isRetryable: false,
        suggestedAction: 'Document saved as reference - you can still discuss it in conversations'
      };
    }
    
    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('aborted') || errorMessage.includes('signal')) {
      return {
        type: ExtractionErrorType.TIMEOUT_ERROR,
        message: 'Content extraction timed out. The website may be slow or the document complex.',
        originalError: error instanceof Error ? error : undefined,
        isRetryable: true,
        suggestedAction: 'Try again or use a different extraction level'
      };
    }
    
    // Parsing errors
    if (errorMessage.includes('parse') || errorMessage.includes('invalid') || errorMessage.includes('malformed')) {
      return {
        type: ExtractionErrorType.PARSING_ERROR,
        message: 'Unable to parse the document content. The format may be corrupted or unsupported.',
        originalError: error instanceof Error ? error : undefined,
        isRetryable: false,
        suggestedAction: 'Try a different document or check if the URL is accessible'
      };
    }
    
    // Permission/access errors
    if (errorMessage.includes('403') || errorMessage.includes('401') || errorMessage.includes('Forbidden') || errorMessage.includes('Unauthorized')) {
      return {
        type: ExtractionErrorType.PERMISSION_ERROR,
        message: 'Access denied to this content. The website may require authentication or block automated access.',
        originalError: error instanceof Error ? error : undefined,
        isRetryable: false,
        suggestedAction: 'Try accessing the website directly in your browser first'
      };
    }
    
    // JavaScript-heavy pages
    if (errorMessage.includes('JavaScript-heavy') || errorMessage.includes('very little content')) {
      return {
        type: ExtractionErrorType.JAVASCRIPT_HEAVY,
        message: 'This page relies heavily on JavaScript. Basic content was extracted, but some information may be missing.',
        originalError: error instanceof Error ? error : undefined,
        isRetryable: false,
        suggestedAction: 'Page saved as reference - you can still discuss it in conversations'
      };
    }
    
    // Default unknown error
    return {
      type: ExtractionErrorType.UNKNOWN_ERROR,
      message: `Extraction failed: ${errorMessage}`,
      originalError: error instanceof Error ? error : undefined,
      isRetryable: true,
      suggestedAction: 'Try again or contact support if the issue persists'
    };
  }
  
  static shouldRetry(error: CategorizedError, attemptCount: number): boolean {
    if (attemptCount >= 3) return false;
    return error.isRetryable;
  }
  
  static getRetryDelay(attemptCount: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, attemptCount), 4000);
  }
}