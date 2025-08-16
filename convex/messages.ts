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
    }
    
    return Object.fromEntries(graphs);
  },
});