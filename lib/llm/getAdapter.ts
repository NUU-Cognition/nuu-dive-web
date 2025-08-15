import { LLMAdapter } from "./provider";
import { openaiAdapter } from "./openaiAdapter";
import { mockAdapter } from "./mockAdapter";

export function getLLM(): LLMAdapter {
  const provider = process.env.LLM_PROVIDER || "mock";
  
  switch (provider) {
    case "openai":
      return openaiAdapter;
    case "mock":
    default:
      return mockAdapter;
  }
}