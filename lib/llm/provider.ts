export type StreamChunk = { 
  token: string;
  done?: boolean;
};

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMStream = AsyncGenerator<StreamChunk, { 
  fullText: string;
  tokenCount: number;
}>;

export type LLMAdapter = {
  stream: (args: {
    system?: string;
    contextMessages: LLMMessage[];
    user: string;
    temperature?: number;
    maxTokens?: number;
  }) => LLMStream;
};

export interface LLMConfig {
  provider: "openai" | "anthropic" | "mock";
  apiKey?: string;
  model?: string;
  endpoint?: string;
}