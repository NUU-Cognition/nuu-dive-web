import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface UseConvexChatOptions {
  chatId: string;
  conceptId?: string | null;
  userId: string;        // Convex user id
  diveId: string;        // For concept creation from chat
}

// Minimal message shape used by the UI
export interface Message {
  _id: string;
  role: "system" | "user" | "assistant" | "note";
  content: string;
  parentMessageId?: string;
  depth: number;
  createdAt: number;
  tokenCount?: number;
}

export function useConvexChat({ chatId, conceptId, userId, diveId }: UseConvexChatOptions) {
  const messages =
    useQuery(
      api.messages.listByChat,
      chatId ? ({ chatId: chatId as unknown as Id<"chats"> }) : "skip"
    ) || [];

  const createUser = useMutation(api.messages.createUser);
  const createAssistant = useMutation(api.messages.createAssistant);
  const branch = useMutation(api.messages.branch);
  const createConcept = useMutation(api.concepts.create);

  const createUserMessage = useCallback(
    async (content: string, parentMessageId?: string) => {
      const id = await createUser({
        chatId: chatId as unknown as Id<"chats">,
        parentMessageId: parentMessageId as unknown as Id<"messages"> | undefined,
        content,
        userId: userId as unknown as Id<"users">,
      });
      // Return a lightweight message handle for downstream use
      return { _id: id as string, role: "user", content } as Message;
    },
    [chatId, createUser, userId]
  );

  const createAssistantMessage = useCallback(
    async (content: string, parentMessageId: string, tokenCount?: number) => {
      const id = await createAssistant({
        chatId: chatId as unknown as Id<"chats">,
        parentMessageId: parentMessageId as unknown as Id<"messages">,
        content,
        tokenCount,
        userId: userId as unknown as Id<"users">,
      });
      return { _id: id as string, role: "assistant", content } as Message;
    },
    [chatId, createAssistant, userId]
  );

  const createBranch = useCallback(
    async (fromAssistantMessageId: string, userContent: string) => {
      const id = await branch({
        chatId: chatId as unknown as Id<"chats">,
        fromAssistantMessageId: fromAssistantMessageId as unknown as Id<"messages">,
        userContent,
        userId: userId as unknown as Id<"users">,
      });
      return { _id: id as string, role: "user", content: userContent } as Message;
    },
    [branch, chatId, userId]
  );

  const createConceptFromMessage = useCallback(
    async (title: string, snippet: string) => {
      const res = await createConcept({
        diveId: diveId as unknown as Id<"dives">,
        title,
        snippet,
        sourceType: "chat",
        userId: userId as unknown as Id<"users">,
      });
      return res as { conceptId: string; chatId: string };
    },
    [createConcept, diveId, userId]
  );

  return {
    messages,
    createUserMessage,
    createAssistantMessage,
    createBranch,
    createConcept: createConceptFromMessage,
  };
}