import type { LLMAdapter } from "./provider";

const MOCK_RESPONSES = [
  "I understand you're asking about {topic}. Let me explain this concept in detail.\n\n",
  "Based on the context provided, here are the key points:\n\n1. **First Point**: This is an important consideration\n2. **Second Point**: Another crucial aspect\n3. **Third Point**: Don't forget about this\n\n",
  "To summarize: This demonstrates the interconnected nature of the concepts we're discussing.",
];

export const mockAdapter: LLMAdapter = {
  async *stream() {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Build a mock response based on the query
    const response = MOCK_RESPONSES.join("");
    const words = response.split(" ");
    let fullText = "";

    // Stream words with realistic delays
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? " " : "");
      fullText += word;
      
      yield {
        token: word,
        done: i === words.length - 1,
      };

      // Simulate token generation delay
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 10));
    }

    return {
      fullText,
      tokenCount: words.length,
    };
  },
};