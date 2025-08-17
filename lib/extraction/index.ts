// Modular content extraction system
// Export all the extraction components

export * from './types';
export { HTMLParser } from './htmlParser';
export { PDFExtractor } from './pdfExtractor';
export { ContentExtractor, contentExtractor } from './contentExtractor';
export { ExtractionErrorHandler, ExtractionErrorType } from './errorHandler';
export { GeminiExtractor, geminiExtractor } from './geminiExtractor';

// Re-export the main extractor instance for convenience
export default contentExtractor;