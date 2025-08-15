import { useState, useCallback } from "react";

interface StreamChatOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string, messageId: string) => void;
  onError?: (error: string) => void;
}

export function useStreamChat(options: StreamChatOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");

  const sendMessage = useCallback(
    async ({
      chatId,
      parentMessageId,
      userText,
      messages,
      inclusionOverride,
      attachments,
    }: {
      chatId: string;
      parentMessageId?: string;
      userText: string;
      messages: any[];
      inclusionOverride?: {
        includeIds?: string[];
        excludeIds?: string[];
      };
      attachments?: any[];
    }) => {
      setIsStreaming(true);
      setStreamedText("");

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId,
            parentMessageId,
            userText,
            messages,
            inclusionOverride,
            attachments,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

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
                setIsStreaming(false);
                return;
              }

              try {
                const parsed = JSON.parse(data);
                
                switch (parsed.type) {
                  case "token":
                    setStreamedText((prev) => prev + parsed.content);
                    options.onToken?.(parsed.content);
                    break;
                    
                  case "complete":
                    setStreamedText(parsed.content);
                    options.onComplete?.(parsed.content, parsed.messageId);
                    break;
                    
                  case "error":
                    throw new Error(parsed.error);
                }
              } catch (e) {
                console.error("Error parsing SSE:", e);
              }
            }
          }
        }
      } catch (error) {
        console.error("Stream chat error:", error);
        options.onError?.(
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [options]
  );

  return {
    sendMessage,
    isStreaming,
    streamedText,
  };
}