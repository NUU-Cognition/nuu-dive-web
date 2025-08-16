import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    return chat;
  },
});

export const listByDive = query({
  args: {
    diveId: v.id("dives"),
  },
  handler: async (ctx, args) => {
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_dive", (q) => q.eq("diveId", args.diveId))
      .order("desc")
      .collect();
    
    return chats;
  },
});

export const listByAnchor = query({
  args: {
    anchorType: v.union(v.literal("document"), v.literal("concept")),
    anchorId: v.union(v.id("documents"), v.id("concepts")),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("chats")
      .withIndex("by_anchor", (q) =>
        q.eq("anchorType", args.anchorType).eq("anchorId", args.anchorId)
      )
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    diveId: v.id("dives"),
    conceptId: v.optional(v.id("concepts")),
    title: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    
    // For backwards compatibility, if conceptId is provided, set anchorType/anchorId
    const chatData: any = {
      diveId: args.diveId,
      conceptId: args.conceptId,
      title: args.title,
      createdBy: args.userId,
      createdAt,
      updatedAt: createdAt,
      anchorType: args.conceptId ? "concept" : "free",
    };
    
    if (args.conceptId) {
      chatData.anchorId = args.conceptId;
    }
    
    const chatId = await ctx.db.insert("chats", chatData);
    
    return chatId;
  },
});

export const createForDocument = mutation({
  args: {
    documentId: v.id("documents"),
    diveId: v.id("dives"),
    title: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }
    
    const chatId = await ctx.db.insert("chats", {
      diveId: args.diveId,
      anchorType: "document",
      anchorId: args.documentId,
      title: args.title || document.title,
      createdBy: args.userId,
      createdAt,
      updatedAt: createdAt,
    });

    // Seed a contextual note so assembleContext can inject document context
    await ctx.db.insert("messages", {
      chatId,
      parentMessageId: undefined,
      role: "note",
      content: `# ${document.title}\n\n_Source_: ${document.url ? document.url : "Document"}\n\nUse this document as the primary source when answering.`,
      createdBy: args.userId,
      createdAt,
      depth: 0,
    });
    
    return chatId;
  },
});