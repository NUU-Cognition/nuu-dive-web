import { LLMMessage } from "../llm/provider";

interface Message {
  _id: string;
  role: "system" | "user" | "assistant" | "note";
  content: string;
  parentMessageId?: string;
  depth: number;
}

interface Attachment {
  type: "url" | "pdf" | "upload";
  url?: string;
  title?: string;
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
  maxTokens = 4000,
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

  // Build system prompt
  const system = `You are a helpful AI assistant that helps users explore concepts and ideas through branching conversations. 
Always cite sources when available using [Source Name](url) format.
Provide clear, structured responses using markdown formatting.`;

  // Convert messages to LLM format
  const contextMessages: LLMMessage[] = filteredMessages
    .filter((m) => m.role !== "note") // Notes are for context, not conversation
    .map((m) => ({
      role: m.role === "note" ? "system" : m.role as "system" | "user" | "assistant",
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