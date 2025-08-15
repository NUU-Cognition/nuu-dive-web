import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

interface Message {
  _id: string;
  role: "system" | "user" | "assistant" | "note";
  content: string;
  parentMessageId?: string;
  depth: number;
  createdAt: number;
  tokenCount?: number;
}

interface UseConvexChatOptions {
  chatId: string;
  conceptId?: string | null;
}

export function useConvexChat({ chatId, conceptId }: UseConvexChatOptions) {
  const { data: session } = useSession();
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  // For demo/MVP, we'll use local state with the option to sync to Convex later
  // In production, these would be real Convex queries/mutations
  
  // Mock query for messages
  const messages = localMessages; // In production: useQuery(api.messages.listByChat, { chatId });
  
  // Mock mutations
  const createUserMessage = useCallback(async (content: string, parentMessageId?: string) => {
    const newMessage: Message = {
      _id: `user_${Date.now()}`,
      role: "user",
      content,
      parentMessageId,
      depth: parentMessageId ? (localMessages.find(m => m._id === parentMessageId)?.depth || 0) + 1 : 0,
      createdAt: Date.now(),
    };
    
    setLocalMessages(prev => [...prev, newMessage]);
    
    // In production, call Convex mutation:
    // await createUserMessageMutation({ chatId, content, parentMessageId, userId });
    
    return newMessage;
  }, [localMessages]);

  const createAssistantMessage = useCallback(async (
    content: string, 
    parentMessageId: string,
    tokenCount?: number
  ) => {
    const parentMessage = localMessages.find(m => m._id === parentMessageId);
    const newMessage: Message = {
      _id: `assistant_${Date.now()}`,
      role: "assistant",
      content,
      parentMessageId,
      depth: (parentMessage?.depth || 0) + 1,
      createdAt: Date.now(),
      tokenCount,
    };
    
    setLocalMessages(prev => [...prev, newMessage]);
    
    // In production, call Convex mutation:
    // await createAssistantMessageMutation({ chatId, content, parentMessageId, tokenCount, userId });
    
    return newMessage;
  }, [localMessages]);

  const createBranch = useCallback(async (
    fromAssistantMessageId: string,
    userContent: string
  ) => {
    const assistantMessage = localMessages.find(m => m._id === fromAssistantMessageId);
    if (!assistantMessage || assistantMessage.role !== "assistant") {
      throw new Error("Can only branch from assistant messages");
    }

    const branchMessage: Message = {
      _id: `branch_${Date.now()}`,
      role: "user",
      content: userContent,
      parentMessageId: fromAssistantMessageId,
      depth: assistantMessage.depth + 1,
      createdAt: Date.now(),
    };
    
    setLocalMessages(prev => [...prev, branchMessage]);
    
    // In production, call Convex mutation:
    // await branchMutation({ chatId, fromAssistantMessageId, userContent, userId });
    
    return branchMessage;
  }, [localMessages]);

  const createConcept = useCallback(async (
    title: string,
    snippet: string,
    messageId?: string
  ) => {
    // In production, call Convex mutation to create concept
    console.log("Creating concept:", { 
      title, 
      snippet, 
      chatId, 
      messageId,
      diveId: "current_dive_id", // Get from context
    });
    
    // Return mock concept ID
    return `concept_${Date.now()}`;
  }, [chatId]);

  // Initialize with concept note if provided (guard against StrictMode double-invocation)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (conceptId && localMessages.length === 0) {
      const initialNote: Message = {
        _id: "initial_note",
        role: "note",
        content: "# Concept\n\n> This is the initial concept that started this conversation.\n\nReady to explore!",
        depth: 0,
        createdAt: Date.now() - 10000,
      };
      setLocalMessages([initialNote]);
      initializedRef.current = true;
    }
  }, [conceptId, localMessages.length]);

  return {
    messages,
    createUserMessage,
    createAssistantMessage,
    createBranch,
    createConcept,
    setMessages: setLocalMessages, // For demo purposes
  };
}