import { LLMAdapter, LLMStream, LLMMessage } from "./provider";

export const openaiAdapter: LLMAdapter = {
  async *stream({
    system,
    contextMessages,
    user,
    temperature = 0.7,
    maxTokens = 4096
  }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const messages: LLMMessage[] = [];

    if (system) {
      messages.push({ role: "system", content: system });
    }

    messages.push(...contextMessages);
    messages.push({ role: "user", content: user });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let tokenCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return { fullText, tokenCount };
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              fullText += delta.content;
              tokenCount++;
              yield {
                token: delta.content,
                done: false,
              };
            }
          } catch (e) {
            console.error("Error parsing OpenAI stream:", e);
          }
        }
      }
    }

    return { fullText, tokenCount };
  },
};