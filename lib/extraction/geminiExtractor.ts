// Gemini-based content extraction for robust document processing
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ExtractionLevel } from './types';

export interface GeminiExtractionResult {
  success: boolean;
  content: string;
  metadata: {
    fileSize?: number;
    processingTime: number;
    geminiModel: string;
    extractionMethod: 'gemini';
    error?: string;
  };
}

export class GeminiExtractor {
  private static instance: GeminiExtractor;
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  
  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is required');
    }
    
    console.log('🤖 [GEMINI] Initializing Gemini extractor with File API...');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.fileManager = new GoogleAIFileManager(apiKey);
    console.log('🤖 [GEMINI] Gemini extractor initialized successfully');
  }
  
  static getInstance(): GeminiExtractor {
    if (!GeminiExtractor.instance) {
      GeminiExtractor.instance = new GeminiExtractor();
    }
    return GeminiExtractor.instance;
  }

  async extractFromUrl(url: string, level: ExtractionLevel = 'full'): Promise<GeminiExtractionResult> {
    const startTime = Date.now();
    let tempFilePath: string | null = null;
    let uploadedFile: any = null;

    console.log('🚀 [GEMINI] Starting Gemini extraction with File API...');
    console.log('🚀 [GEMINI] URL:', url);
    console.log('🚀 [GEMINI] Level:', level);

    try {
      // Step 1: Download the file
      console.log('⬇️ [GEMINI] Step 1: Downloading file from URL...');
      const { filePath, fileSize } = await this.downloadFile(url);
      tempFilePath = filePath;
      console.log('✅ [GEMINI] File downloaded successfully');
      console.log('📁 [GEMINI] File size:', (fileSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('📁 [GEMINI] Temp file path:', tempFilePath);

      // Step 2: Upload to Gemini File API
      console.log('☁️ [GEMINI] Step 2: Uploading file to Gemini File API...');
      uploadedFile = await this.uploadFileToGemini(tempFilePath, url);
      console.log('✅ [GEMINI] File uploaded to Gemini successfully');
      console.log('🆔 [GEMINI] Gemini file URI:', uploadedFile.uri);

      // Step 3: Wait for processing if needed
      console.log('⏳ [GEMINI] Step 3: Waiting for file processing...');
      await this.waitForFileProcessing(uploadedFile.name);
      console.log('✅ [GEMINI] File processing completed');

      // Step 4: Generate content using Gemini
      console.log('🧠 [GEMINI] Step 4: Generating content with Gemini...');
      const extractedContent = await this.generateContentWithGemini(uploadedFile, level);
      console.log('✅ [GEMINI] Content generated successfully');
      console.log('📝 [GEMINI] Generated content length:', extractedContent.length, 'characters');

      const processingTime = Date.now() - startTime;
      console.log('🏁 [GEMINI] Extraction completed successfully in', processingTime, 'ms');

      return {
        success: true,
        content: extractedContent,
        metadata: {
          fileSize,
          processingTime,
          geminiModel: 'gemini-1.5-flash-latest',
          extractionMethod: 'gemini'
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('❌ [GEMINI] Extraction failed:', errorMessage);
      console.error('❌ [GEMINI] Error details:', error);
      console.error('❌ [GEMINI] Failed after', processingTime, 'ms');

      return {
        success: false,
        content: '',
        metadata: {
          processingTime,
          geminiModel: 'gemini-1.5-flash-latest',
          extractionMethod: 'gemini',
          error: errorMessage
        }
      };

    } finally {
      // Step 5: Cleanup
      console.log('🧹 [GEMINI] Step 5: Cleaning up resources...');
      
      // Delete temporary file
      if (tempFilePath && existsSync(tempFilePath)) {
        try {
          unlinkSync(tempFilePath);
          console.log('✅ [GEMINI] Temporary file deleted:', tempFilePath);
        } catch (cleanupError) {
          console.error('⚠️ [GEMINI] Failed to delete temporary file:', cleanupError);
        }
      }

      // Delete uploaded file from Gemini (optional - files auto-delete after 48h)
      if (uploadedFile) {
        try {
          await this.fileManager.deleteFile(uploadedFile.name);
          console.log('✅ [GEMINI] Uploaded file deleted from Gemini');
        } catch (cleanupError) {
          console.warn('⚠️ [GEMINI] Failed to delete uploaded file from Gemini:', cleanupError);
        }
      }
      
      console.log('🧹 [GEMINI] Cleanup completed');
    }
  }

  private async downloadFile(url: string): Promise<{ filePath: string; fileSize: number }> {
    console.log('⬇️ [GEMINI] Starting file download...');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DiveContentExtractor/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: HTTP ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const fileSize = contentLength ? parseInt(contentLength) : 0;
    
    console.log('⬇️ [GEMINI] Download response received, size:', fileSize, 'bytes');

    // Generate unique filename
    const timestamp = Date.now();
    const urlParts = new URL(url);
    const filename = urlParts.pathname.split('/').pop() || 'document';
    const tempFilePath = join(tmpdir(), `gemini_${timestamp}_${filename}`);

    console.log('⬇️ [GEMINI] Saving to temp file:', tempFilePath);

    // Download and save file
    const buffer = await response.arrayBuffer();
    writeFileSync(tempFilePath, Buffer.from(buffer));
    
    console.log('✅ [GEMINI] File saved successfully');
    
    return { filePath: tempFilePath, fileSize: buffer.byteLength };
  }

  private async uploadFileToGemini(filePath: string, originalUrl: string): Promise<any> {
    console.log('☁️ [GEMINI] Uploading file to Gemini File API...');
    
    // Extract display name from URL
    const displayName = new URL(originalUrl).pathname.split('/').pop() || 'document';
    
    console.log('☁️ [GEMINI] Display name:', displayName);
    console.log('☁️ [GEMINI] Mime type:', this.getMimeType(filePath));
    
    const uploadResponse = await this.fileManager.uploadFile(filePath, {
      mimeType: this.getMimeType(filePath),
      displayName: displayName
    });

    console.log('✅ [GEMINI] File uploaded, name:', uploadResponse.file.name);
    console.log('✅ [GEMINI] File URI:', uploadResponse.file.uri);
    
    return uploadResponse.file;
  }

  private async waitForFileProcessing(fileName: string): Promise<void> {
    console.log('⏳ [GEMINI] Checking file processing status...');
    
    let file = await this.fileManager.getFile(fileName);
    console.log('📋 [GEMINI] Initial file state:', file.state);
    
    while (file.state === 'PROCESSING') {
      console.log('⏳ [GEMINI] File still processing, waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      file = await this.fileManager.getFile(fileName);
      console.log('📋 [GEMINI] Current file state:', file.state);
    }
    
    if (file.state === 'FAILED') {
      throw new Error('File processing failed in Gemini');
    }
    
    console.log('✅ [GEMINI] File processing completed, state:', file.state);
  }

  private async generateContentWithGemini(file: any, level: ExtractionLevel): Promise<string> {
    console.log('🧠 [GEMINI] Initializing Gemini model...');
    
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    
    const prompt = this.createExtractionPrompt(level);
    console.log('🧠 [GEMINI] Using prompt for level:', level);
    console.log('🧠 [GEMINI] Prompt preview:', prompt.substring(0, 200) + '...');
    console.log('🧠 [GEMINI] File URI for request:', file.uri);
    console.log('🧠 [GEMINI] Sending request to Gemini with uploaded file...');
    
    // Create proper file reference format for generateContent
    console.log('📋 [GEMINI] File details:', { name: file.name, mimeType: file.mimeType, uri: file.uri, state: file.state });
    
    // Verify file is ready for use
    if (file.state !== 'ACTIVE') {
      throw new Error(`File is not ready for use. Current state: ${file.state}`);
    }
    
    // Create proper file reference format for generateContent (revert to working format)
    const fileData = {
      fileData: {
        mimeType: file.mimeType,
        fileUri: file.uri
      }
    };
    
    // Simple direct API call - no timeout wrapper, let Gemini take as long as it needs
    console.log('🚀 [GEMINI] Calling model.generateContent...');
    const result = await model.generateContent([prompt, fileData]);
    console.log('✅ [GEMINI] model.generateContent returned, getting response...');
    
    const response = await result.response;
    console.log('✅ [GEMINI] Response object obtained, extracting text...');
    
    const text = response.text();
    console.log('✅ [GEMINI] Text extracted successfully');
    console.log('📝 [GEMINI] Generated text length:', text.length, 'characters');
    console.log('📝 [GEMINI] Content preview:', text.substring(0, 300) + '...');
    
    return text;
  }

  private createExtractionPrompt(level: ExtractionLevel): string {
    if (level === 'basic') {
      // This shouldn't be called for basic extraction, but provide a fallback
      return `Please provide a brief structural overview of this document, including:
- Document title
- Main section headings
- Key topics covered

Keep the response concise (under 2000 characters).`;
    } else {
      // Full extraction focuses on comprehensive structure and navigation
      return `You are an expert document analyzer. Please analyze this PDF document and create a comprehensive structural overview that will help users navigate and understand the document.

Your task is to extract:
1. **Document Title** - The main title of the document
2. **Document Overview** - A brief 2-3 sentence summary of what this document covers
3. **Complete Table of Contents** - All headings, subheadings, and sections with their hierarchical structure
4. **Key Sections Summary** - For each major section, provide a 1-2 sentence description of what it covers
5. **Important Topics/Concepts** - List the main topics, concepts, or subjects discussed
6. **Document Metadata** - Any important information like authors, publication info, etc.

Please format your response in clean Markdown with:
- # for the document title
- ## for major sections like "Overview", "Table of Contents", "Key Sections", etc.
- ### for subsections and chapter/section titles
- **bold** for important terms
- Bullet points for lists
- Clear hierarchical structure that mirrors the document

This will serve as a comprehensive navigation guide for the document. Focus on structure and organization rather than detailed content extraction.`;
    }
  }

  private getMimeType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'rtf': 'application/rtf',
      'html': 'text/html',
      'htm': 'text/html'
    };
    
    return mimeTypes[extension || ''] || 'application/octet-stream';
  }
}

// Export singleton instance
export const geminiExtractor = GeminiExtractor.getInstance();