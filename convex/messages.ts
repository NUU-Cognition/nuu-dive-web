import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createUser = mutation({
  args: {
    chatId: v.id("chats"),
    parentMessageId: v.optional(v.id("messages")),
    content: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }
    
    let depth = 0;
    if (args.parentMessageId) {
      const parent = await ctx.db.get(args.parentMessageId);
      if (!parent || parent.chatId !== args.chatId) {
        throw new Error("Invalid parent message");
      }
      depth = parent.depth + 1;
    }
    
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      parentMessageId: args.parentMessageId,
      role: "user",
      content: args.content,
      createdBy: args.userId,
      createdAt: Date.now(),
      depth,
    });
    
    // Update chat's updatedAt
    await ctx.db.patch(args.chatId, { updatedAt: Date.now() });
    
    return messageId;
  },
});

export const createAssistant = mutation({
  args: {
    chatId: v.id("chats"),
    parentMessageId: v.id("messages"),
    content: v.string(),
    tokenCount: v.optional(v.number()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentMessageId);
    if (!parent || parent.chatId !== args.chatId) {
      throw new Error("Invalid parent message");
    }
    
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      parentMessageId: args.parentMessageId,
      role: "assistant",
      content: args.content,
      tokenCount: args.tokenCount,
      createdBy: args.userId,
      createdAt: Date.now(),
      depth: parent.depth + 1,
    });
    
    // Update chat's updatedAt
    await ctx.db.patch(args.chatId, { updatedAt: Date.now() });
    
    return messageId;
  },
});

export const listByChat = query({
  args: {
    chatId: v.id("chats"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc");
    
    const messages = args.limit
      ? await query.take(args.limit)
      : await query.collect();
    
    // Filter out deleted messages
    return messages.filter((m) => !m.deletedAt);
  },
});

export const getSubtree = query({
  args: {
    chatId: v.id("chats"),
    rootMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const allMessages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    
    // Build a tree structure
    const messageMap = new Map(allMessages.map((m) => [m._id, m]));
    const childrenMap = new Map<string, typeof allMessages>();
    
    allMessages.forEach((message) => {
      if (message.parentMessageId) {
        const siblings = childrenMap.get(message.parentMessageId) || [];
        siblings.push(message);
        childrenMap.set(message.parentMessageId, siblings);
      }
    });
    
    // If rootMessageId is specified, return only that subtree
    if (args.rootMessageId) {
      const collectSubtree = (messageId: Id<"messages">): any[] => {
        const message = messageMap.get(messageId);
        if (!message || message.deletedAt) return [];
        
        const children = childrenMap.get(messageId) || [];
        const childTrees = children.flatMap((child) =>
          collectSubtree(child._id)
        );
        
        return [message, ...childTrees];
      };
      
      return collectSubtree(args.rootMessageId);
    }
    
    // Return all non-deleted messages
    return allMessages.filter((m) => !m.deletedAt);
  },
});

export const branch = mutation({
  args: {
    chatId: v.id("chats"),
    fromAssistantMessageId: v.id("messages"),
    userContent: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify the assistant message exists and is an assistant message
    const assistantMessage = await ctx.db.get(args.fromAssistantMessageId);
    if (!assistantMessage || assistantMessage.chatId !== args.chatId) {
      throw new Error("Invalid assistant message");
    }
    
    if (assistantMessage.role !== "assistant") {
      throw new Error("Can only branch from assistant messages");
    }
    
    // Create the new user message branching from the assistant
    const userMessageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      parentMessageId: args.fromAssistantMessageId,
      role: "user",
      content: args.userContent,
      createdBy: args.userId,
      createdAt: Date.now(),
      depth: assistantMessage.depth + 1,
    });
    
    // Update chat's updatedAt
    await ctx.db.patch(args.chatId, { updatedAt: Date.now() });
    
    return userMessageId;
  },
});

export const softDelete = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      deletedAt: Date.now(),
    });
    
    return { success: true };
  },
});

export const deleteWithChildren = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    
    // Get all messages in the chat to find children
    const allMessages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", message.chatId))
      .collect();
    
    // Find all descendants recursively
    const toDelete = new Set<string>();
    const findChildren = (parentId: string) => {
      toDelete.add(parentId);
      allMessages.forEach((m) => {
        if (m.parentMessageId === parentId && !toDelete.has(m._id)) {
          findChildren(m._id);
        }
      });
    };
    
    findChildren(args.messageId);
    
    // Soft delete all descendants
    const deletedAt = Date.now();
    await Promise.all(
      Array.from(toDelete).map((id) =>
        ctx.db.patch(id as any, { deletedAt })
      )
    );
    
    return { success: true, deletedCount: toDelete.size };
  },
});

export const responseGraph = query({
  args: { 
    chatId: v.id("chats") 
  },
  handler: async (ctx, { chatId }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat) throw new Error("Chat not found");

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .order("asc")
      .collect();

    // Index by id
    const byId = new Map(messages.map(m => [m._id, m]));

    // Helper: find nearest ancestor assistant
    const nearestAssistant = (m: any): any | null => {
      let cur = m;
      while (cur?.parentMessageId) {
        const p = byId.get(cur.parentMessageId);
        if (!p) break;
        if (p.role === "assistant") return p;
        cur = p;
      }
      return null;
    };

    const nodes: any[] = [];
    const edges: any[] = [];

    // Anchor node (virtual) so the client can draw an edge from root
    // Handle legacy chats: if no anchorType but has conceptId, it's a concept anchor
    let anchorType = chat.anchorType || "free";
    let anchorId = chat.anchorId;
    
    if (!chat.anchorType && chat.conceptId) {
      anchorType = "concept";
      anchorId = chat.conceptId;
    }
    
    const anchor = { 
      type: anchorType, 
      id: anchorId,
      chatId 
    };

    for (const m of messages) {
      if (m.role !== "assistant" || m.deletedAt) continue; // only responses are nodes
      
      // Find the user question immediately above this assistant
      const user = m.parentMessageId ? byId.get(m.parentMessageId) : null;
      const label = user?.role === "user" 
        ? (user.content.length > 90 ? user.content.substring(0, 87) + "..." : user.content)
        : "(no question)";

      const parentAssistant = user ? nearestAssistant(user) : null;
      const parent = parentAssistant 
        ? { type: "response", id: parentAssistant._id }
        : anchor;

      nodes.push({
        type: "response",
        id: m._id,
        content: m.content, // Include for tooltips
        createdAt: m.createdAt,
        tokenCount: m.tokenCount,
      });

      edges.push({
        from: parent,
        to: { type: "response", id: m._id },
        label,                       // short label for rendering
        promptId: user?._id,         // the user message that created this edge
        prompt: (user?.content && user.content.trim()) ? user.content : label, // fallback to label
      });
    }

    return { anchor, nodes, edges };
  },
});

export const allResponseGraphs = query({
  args: { 
    diveId: v.id("dives") 
  },
  handler: async (ctx, { diveId }) => {
    // Get all chats for this dive
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_dive", (q) => q.eq("diveId", diveId))
      .collect();
    
    const graphs = new Map();
    
    for (const chat of chats) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
        .order("asc")
        .collect();
      
      // Skip if no messages
      if (messages.length === 0) continue;
      
      // Index by id
      const byId = new Map(messages.map(m => [m._id, m]));
      
      // Helper: find nearest ancestor assistant
      const nearestAssistant = (m: any): any | null => {
        let cur = m;
        while (cur?.parentMessageId) {
          const p = byId.get(cur.parentMessageId);
          if (!p) break;
          if (p.role === "assistant") return p;
          cur = p;
        }
        return null;
      };
      
      const nodes: any[] = [];
      const edges: any[] = [];
      
      // Determine anchor
      let anchorType = chat.anchorType || "free";
      let anchorId = chat.anchorId;
      
      if (!chat.anchorType && chat.conceptId) {
        anchorType = "concept";
        anchorId = chat.conceptId;
      }
      
      const anchor = { 
        type: anchorType, 
        id: anchorId,
        chatId: chat._id 
      };
      
      for (const m of messages) {
        if (m.role !== "assistant" || m.deletedAt) continue;
        
        const user = m.parentMessageId ? byId.get(m.parentMessageId) : null;
        const label = user?.role === "user" 
          ? (user.content.length > 90 ? user.content.substring(0, 87) + "..." : user.content)
          : "(no prompt)";
        
        const parentAssistant = user ? nearestAssistant(user) : null;
        const parent = parentAssistant 
          ? { type: "response", id: parentAssistant._id }
          : anchor;
        
        nodes.push({
          type: "response",
          id: m._id,
          content: m.content,
          createdAt: m.createdAt,
          tokenCount: m.tokenCount,
        });
        
        edges.push({
          from: parent,
          to: { type: "response", id: m._id },
          label,
          promptId: user?._id,
          prompt: (user?.content && user.content.trim()) ? user.content : label,
        });
      }
      
      // Store by anchorId if it exists, otherwise by chatId
      const key = anchorId || chat._id;
      graphs.set(key, { anchor, nodes, edges });
      
      // Also store by chatId for cross-reference lookups
      if (anchorId && anchorId !== (chat._id as string)) {
        graphs.set(chat._id as string, { anchor, nodes, edges });
      }
    }
    
    return Object.fromEntries(graphs);
  },
});

// Helper function to build complete path from root to a specific message, including inheritance
async function buildPathToMessage(ctx: any, targetMessage: any, visitedChats = new Set()): Promise<any[]> {
  // Prevent infinite recursion if there are circular concept dependencies
  if (visitedChats.has(targetMessage.chatId)) {
    return [];
  }
  visitedChats.add(targetMessage.chatId);
  // First, build the path within the target message's chat
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_chat", (q: any) => q.eq("chatId", targetMessage.chatId))
    .order("asc")
    .collect();
  
  // Filter out deleted messages
  const activeMessages = messages.filter((m: any) => !m.deletedAt);
  
  // Build index by id
  const byId = new Map(activeMessages.map((m: any) => [m._id, m]));
  
  // Build path from target back to root within this chat
  const currentChatPath: any[] = [];
  let current = targetMessage;
  const visited = new Set();
  
  while (current && !visited.has(current._id)) {
    currentChatPath.unshift(current);
    visited.add(current._id);
    current = current.parentMessageId ? byId.get(current.parentMessageId) : null;
  }
  
  // Check if this chat itself has inherited context (is concept-anchored)
  const chat = await ctx.db.get(targetMessage.chatId);
  if (!chat?.conceptId) {
    // No inheritance, return just the current chat path
    return currentChatPath;
  }
  
  const concept = await ctx.db.get(chat.conceptId);
  if (!concept?.sourceMessageId) {
    // No source message, return just the current chat path
    return currentChatPath;
  }
  
  // Get the source message this concept was derived from
  const sourceMessage = await ctx.db.get(concept.sourceMessageId);
  if (!sourceMessage) {
    // Source message doesn't exist, return just the current chat path
    return currentChatPath;
  }
  
  // Recursively get the inherited path from the source message
  const inheritedPath = await buildPathToMessage(ctx, sourceMessage, visitedChats);
  
  // Combine inherited path with current chat path
  return [...inheritedPath, ...currentChatPath];
}

// Helper function to build complete inheritance chain recursively
async function buildCompleteInheritanceChain(ctx: any, sourceMessage: any, visitedChats = new Set()): Promise<any[]> {
  // Prevent infinite recursion
  if (visitedChats.has(sourceMessage.chatId)) {
    return [];
  }
  visitedChats.add(sourceMessage.chatId);
  
  // First, get the path to the source message within its own chat
  const sourceMessagePath = await buildPathToMessage(ctx, sourceMessage, new Set());
  
  // Check if the source message's chat has its own inherited context
  const sourceChat = await ctx.db.get(sourceMessage.chatId);
  if (!sourceChat?.conceptId) {
    // No further inheritance, return just the source message path
    return sourceMessagePath;
  }
  
  const sourceConcept = await ctx.db.get(sourceChat.conceptId);
  if (!sourceConcept?.sourceMessageId) {
    // No source message for the concept, return just the source message path
    return sourceMessagePath;
  }
  
  // Get the parent source message
  const parentSourceMessage = await ctx.db.get(sourceConcept.sourceMessageId);
  if (!parentSourceMessage) {
    // Parent source message doesn't exist, return just the source message path
    return sourceMessagePath;
  }
  
  // Recursively get the inheritance chain from the parent
  const parentInheritanceChain = await buildCompleteInheritanceChain(ctx, parentSourceMessage, visitedChats);
  
  // Combine parent inheritance with current path and deduplicate by message ID
  const combinedMessages = [...parentInheritanceChain, ...sourceMessagePath];
  const seenMessageIds = new Set();
  const deduplicated = combinedMessages.filter(message => {
    if (seenMessageIds.has(message._id)) {
      return false;
    }
    seenMessageIds.add(message._id);
    return true;
  });
  
  return deduplicated;
}

export const listByConceptChat = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      return { hasInheritedContext: false, inheritedMessages: [], currentMessages: [] };
    }
    
    // Get current chat messages
    const currentMessages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
    
    // Filter out deleted messages
    const activeCurrentMessages = currentMessages.filter((m) => !m.deletedAt);
    
    // Check if this is a concept-anchored chat with inherited context
    // Support both legacy conceptId field and new anchorType/anchorId pattern
    const conceptId = chat.conceptId || (chat.anchorType === "concept" ? chat.anchorId : null);
    
    if (!conceptId) {
      return {
        hasInheritedContext: false,
        inheritedMessages: [],
        currentMessages: activeCurrentMessages,
      };
    }
    
    const concept = await ctx.db.get(conceptId);
    if (!concept || !('sourceMessageId' in concept) || !concept.sourceMessageId) {
      return {
        hasInheritedContext: false,
        inheritedMessages: [],
        currentMessages: activeCurrentMessages,
      };
    }
    
    // Get the source message that the concept was derived from
    const sourceMessage = await ctx.db.get(concept.sourceMessageId);
    if (!sourceMessage) {
      return {
        hasInheritedContext: false,
        inheritedMessages: [],
        currentMessages: activeCurrentMessages,
      };
    }
    
    // Build complete inheritance chain recursively
    const inheritedMessages = await buildCompleteInheritanceChain(ctx, sourceMessage);
    
    // Mark all inherited messages and ensure they have proper depth
    const markedInheritedMessages = inheritedMessages.map((m, index) => ({
      ...m,
      isInherited: true,
      depth: m.depth ?? index, // Fallback depth if missing
      inheritedFromChatId: m.chatId, // Keep original chat ID for each message
    }));
    
    return {
      hasInheritedContext: true,
      inheritedMessages: markedInheritedMessages,
      currentMessages: activeCurrentMessages,
    };
  },
});