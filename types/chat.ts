export interface Message {
  _id: string;
  role: "system" | "user" | "assistant" | "note";
  content: string;
  parentMessageId?: string;
  depth: number;
  createdAt: number;
  tokenCount?: number;
  deletedAt?: number;
}

export interface Attachment {
  type: "url" | "pdf" | "upload";
  url?: string;
  title?: string;
  content?: string;
}

export interface InclusionOverride {
  includeIds?: string[];
  excludeIds?: string[];
}

export interface StreamMessage {
  type: "text" | "error" | "done";
  content?: string;
  error?: string;
}

export interface ChatContext {
  messages: Message[];
  attachments?: Attachment[];
  inclusionOverrides?: InclusionOverride;
}