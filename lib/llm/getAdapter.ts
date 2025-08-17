import type { LLMAdapter } from "./provider";
import { openaiAdapter } from "./openaiAdapter";
import { mockAdapter } from "./mockAdapter";

/**
 * Choose a real provider by default when credentials exist.
 * - If LLM_PROVIDER=openai → OpenAI
 * - If LLM_PROVIDER=mock    → Mock
 * - If unset: prefer OpenAI when OPENAI_API_KEY is present, otherwise mock.
 */
export function getLLM(): LLMAdapter {
  const envProvider = process.env["LLM_PROVIDER"]?.toLowerCase();
  if (envProvider === "openai") return openaiAdapter;
  if (envProvider === "mock") return mockAdapter;

  if (process.env["OPENAI_API_KEY"]) {
    return openaiAdapter;
  }
  console.warn("[LLM] OPENAI_API_KEY not set. Falling back to mock adapter.");
  return mockAdapter;
}