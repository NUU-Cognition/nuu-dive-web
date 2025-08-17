import { useState, useCallback, useRef, useEffect } from "react";

interface StreamChatOptions {
  onToken?: (token: string) => void;
  /**
   * Fired once the server has created the assistant message placeholder.
   * Includes the originating chat and the parent message this stream is branching from.
   */
  onStart?: (info: { messageId: string; chatId: string; parentMessageId?: string }) => void;
  /**
   * Fired when the stream completes. Includes the same anchoring metadata.
   */
  onComplete?: (info: { fullText: string; messageId: string; chatId: string; parentMessageId?: string }) => void;
  onError?: (error: string) => void;
}

export function useStreamChat(options: StreamChatOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);

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
      // Build idempotency key for this request
      const key = `${chatId}:${parentMessageId || "root"}:${userText}`;
      // If the exact same request is already in-flight, ignore
      if (isStreaming && inFlightKeyRef.current === key) return;

      // Cancel any previous stream
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
      inFlightKeyRef.current = key;

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
          signal: controllerRef.current.signal,
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
                // Stop reading immediately; onComplete will already have fired (or will soon).
                try {
                  await reader.cancel();
                } catch {}
                break;
              }

              try {
                const parsed = JSON.parse(data);
                
                switch (parsed.type) {
                  case "start":
                    if (parsed.messageId) {
                      const mid = String(parsed.messageId);
                      options.onStart?.({
                        messageId: mid,
                        chatId,
                        parentMessageId,
                      });
                    }
                    break;
                    
                  case "token":
                    setStreamedText((prev) => prev + parsed.content);
                    options.onToken?.(parsed.content);
                    break;
                    
                  case "complete":
                    setStreamedText(parsed.content);
                    options.onComplete?.({
                      fullText: parsed.content as string,
                      messageId: String(parsed.messageId),
                      chatId,
                      parentMessageId,
                    });
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
        if ((error as any)?.name !== "AbortError") {
          console.error("Stream chat error:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          
          // Provide user-friendly error messages
          let userMessage = errorMessage;
          if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
            userMessage = "Authentication required. Please sign in or set ALLOW_DEV_NO_AUTH=1 in development.";
          } else if (errorMessage.includes("OPENAI_API_KEY")) {
            userMessage = "OpenAI API key not configured. Please add OPENAI_API_KEY to .env.local";
          } else if (errorMessage.includes("404")) {
            userMessage = "Chat endpoint not found. Is the server running?";
          }
          
          options.onError?.(userMessage);
        }
      } finally {
        setIsStreaming(false);
        controllerRef.current = null;
        inFlightKeyRef.current = null;
      }
    },
    [options, isStreaming]
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightKeyRef.current = null;
    setIsStreaming(false);
  }, []);

  // Auto-cancel on unmount
  useEffect(() => cancel, [cancel]);

  return {
    sendMessage,
    cancel,
    isStreaming,
    streamedText,
  };
}