import { useState, useCallback, useRef, useEffect } from "react";

interface StreamChatOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string, messageId: string) => void;
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
              
              // We let the finally block clean up isStreaming
              if (data === "[DONE]") break;

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
        if ((error as any)?.name !== "AbortError") {
          console.error("Stream chat error:", error);
          options.onError?.(
            error instanceof Error ? error.message : "Unknown error"
          );
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