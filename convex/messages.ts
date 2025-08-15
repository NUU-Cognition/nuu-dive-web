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
      const collectSubtree = (messageId: string): any[] => {
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