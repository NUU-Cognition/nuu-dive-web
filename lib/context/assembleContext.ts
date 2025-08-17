import { type LLMMessage } from "../llm/provider";
import { summarizePDFForContext } from "../pdf/extractText";

interface Message {
  _id: string;
  role: "system" | "user" | "assistant" | "note";
  content: string;
  parentMessageId?: string;
  depth: number;
}

interface Attachment {
  type: "url" | "pdf" | "upload" | "extracted_content";
  url?: string;
  title?: string;
  content?: string;
  filename?: string;
}

interface ContextOptions {
  messages: Message[];
  includeIds?: string[];
  excludeIds?: string[];
  attachments?: Attachment[];
  maxTokens?: number;
}

export async function assembleContext({
  messages,
  includeIds,
  excludeIds,
  attachments = [],
}: ContextOptions): Promise<{
  system: string;
  contextMessages: LLMMessage[];
  citations: string[];
}> {
  // Filter messages based on inclusion/exclusion rules
  let filteredMessages = messages;
  
  if (excludeIds && excludeIds.length > 0) {
    filteredMessages = filteredMessages.filter(
      (m) => !excludeIds.includes(m._id)
    );
  }
  
  if (includeIds && includeIds.length > 0) {
    filteredMessages = filteredMessages.filter(
      (m) => includeIds.includes(m._id)
    );
  }

  // Check if we have inherited messages
  const inheritedMessages = filteredMessages.filter((m) => (m as Message & { isInherited?: boolean }).isInherited);
  
  // Find PDF URLs from attachments and messages
  const pdfUrls = new Set<string>();
  
  // Check attachments for PDFs
  attachments.forEach(a => {
    if (a.url?.includes('.pdf')) {
      pdfUrls.add(a.url);
    }
  });
  
  // Check messages for PDF references
  messages.forEach(m => {
    const urlMatches = m.content.match(/https?:\/\/[^\s]+\.pdf/g);
    if (urlMatches) {
      urlMatches.forEach(url => pdfUrls.add(url));
    }
  });

  // Check for extracted content in messages (stored in concept snippets)
  const extractedContents: string[] = [];
  
  // Look for content in messages that contain "--- Extracted Content ---" (new format) or "--- Extracted PDF Content ---" (legacy)
  console.log('🔍 [CONTEXT] Searching for extracted content in', messages.length, 'messages');
  
  messages.forEach(m => {
    console.log('🔍 [CONTEXT] Checking message:', m.role, m.content.substring(0, 100) + '...');
    
    if (m.content.includes('--- Extracted Content ---')) {
      console.log('✅ [CONTEXT] Found extracted content in message:', m._id);
      const contentMatch = m.content.match(/--- Extracted Content ---\n([\s\S]*)/);
      if (contentMatch && contentMatch[1]) {
        extractedContents.push(`Extracted Content:\n${contentMatch[1]}`);
        console.log('✅ [CONTEXT] Added extracted content, length:', contentMatch[1].length);
      }
    } else if (m.content.includes('--- Extracted PDF Content ---')) {
      console.log('✅ [CONTEXT] Found legacy PDF content in message:', m._id);
      const pdfContentMatch = m.content.match(/--- Extracted PDF Content ---\n([\s\S]*)/);
      if (pdfContentMatch && pdfContentMatch[1]) {
        extractedContents.push(`PDF Content:\n${pdfContentMatch[1]}`);
        console.log('✅ [CONTEXT] Added PDF content, length:', pdfContentMatch[1].length);
      }
    }
  });
  
  console.log('📊 [CONTEXT] Total extracted contents found:', extractedContents.length);
  
  // Check attachments for extracted content and document references
  if (attachments.length > 0) {
    for (const attachment of attachments) {
      if (attachment.type === 'extracted_content' && attachment.content) {
        // Direct extracted content from Gemini or other extractors
        console.log('✅ [CONTEXT] Found extracted content in attachments');
        extractedContents.push(attachment.content);
        console.log('✅ [CONTEXT] Added attachment extracted content, length:', attachment.content.length);
      } else if (attachment.type === 'pdf' && attachment.url) {
        // Just acknowledge the PDF exists
        extractedContents.push(`PDF Document Referenced: ${attachment.url}\n\nNote: PDF content may have been extracted and included in the conversation context above.`);
      } else if (attachment.type === 'url' && attachment.url) {
        // Acknowledge web content exists
        extractedContents.push(`Web Document Referenced: ${attachment.url}\n\nNote: Web content may have been extracted and included in the conversation context above.`);
      }
    }
  }
  
  // Build system prompt with both inheritance and extracted content context
  let system = `You are a helpful AI assistant that helps users explore concepts and ideas through branching conversations. 
Always cite sources when available using [Source Name](url) format.
Provide clear, structured responses using markdown formatting.`;

  if (inheritedMessages.length > 0) {
    system += `

IMPORTANT: This conversation includes inherited context from a related conversation. The first ${inheritedMessages.length} messages are from a previous conversation that spawned this concept-based discussion. Use this context to provide informed responses while clearly building on the established discussion.`;
  }

  if (extractedContents.length > 0) {
    console.log('📋 [CONTEXT] Adding extracted content to system prompt');
    console.log('📋 [CONTEXT] Content preview:', extractedContents[0]?.substring(0, 200) + '...');
    
    system += `

EXTRACTED CONTENT AVAILABLE: I have access to the following extracted content in this conversation:

${extractedContents.join('\n\n---\n\n')}

You can reference specific content from these documents when answering questions. Quote relevant sections and provide citations when available.`;
  } else {
    console.log('⚠️ [CONTEXT] No extracted content found in messages');
  }
  // Convert messages to LLM format - maintain conversation order
  const contextMessages: LLMMessage[] = filteredMessages
    .filter((m) => m.role !== "note") // Notes are for context, not conversation
    .map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

  // Add note messages as system context
  const noteMessages = filteredMessages.filter((m) => m.role === "note");
  if (noteMessages.length > 0) {
    const noteContext = noteMessages.map((m) => m.content).join("\n\n");
    contextMessages.unshift({
      role: "system",
      content: `Context from notes:\n${noteContext}`,
    });
  }

  // Build citations from attachments
  const citations = attachments
    .filter((a) => a.url || a.title)
    .map((a, i) => `[${a.title || `Source ${i + 1}`}](${a.url || "#"})`);

  // TODO: Implement token counting and truncation if needed
  // For now, we'll just return everything

  return {
    system,
    contextMessages,
    citations,
  };
}