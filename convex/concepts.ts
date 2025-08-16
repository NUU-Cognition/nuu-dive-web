import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    diveId: v.id("dives"),
    title: v.string(),
    snippet: v.string(),
    sourceType: v.union(v.literal("url"), v.literal("pdf"), v.literal("chat")),
    sourceUrl: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
    sourceMessageId: v.optional(v.id("messages")),
    locatorCss: v.optional(v.string()),
    pdfId: v.optional(v.id("_storage")),
    pdfMeta: v.optional(v.object({
      fileName: v.string(),
      page: v.optional(v.number()),
      rect: v.optional(v.object({
        x: v.number(),
        y: v.number(),
        w: v.number(),
        h: v.number(),
      })),
    })),
    firstQuestion: v.optional(v.string()), // optional for flexibility
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    
    // Create the concept
    const conceptId = await ctx.db.insert("concepts", {
      diveId: args.diveId,
      title: args.title,
      snippet: args.snippet,
      sourceType: args.sourceType,
      sourceUrl: args.sourceUrl,
      documentId: args.documentId,
      sourceMessageId: args.sourceMessageId,
      pdfId: args.pdfId,
      pdfMeta: args.pdfMeta,
      locatorCss: args.locatorCss,
      createdBy: args.userId,
      createdAt,
    });
    
    // Auto-create a conversation for this concept (but separate from concept)
    const chatId = await ctx.db.insert("chats", {
      diveId: args.diveId,
      anchorType: "concept",
      anchorId: conceptId,
      conceptId, // Keep for backwards compatibility
      title: `Discussion: ${args.title}`,
      createdBy: args.userId,
      createdAt,
      updatedAt: createdAt,
    });
    
    // Create an initial note message with the concept snippet
    const sourceLabel =
      args.sourceMessageId ? "Response" :
      args.sourceType === "url" ? (args.sourceUrl || "URL") :
      args.sourceType === "pdf" ? "PDF" : "Chat";
    const noteId = await ctx.db.insert("messages", {
      chatId,
      parentMessageId: undefined,
      role: "note",
      content: `# ${args.title}\n\n> ${args.snippet}\n\nSource: ${sourceLabel}`,
      createdBy: args.userId,
      createdAt,
      depth: 0,
    });
    
    // Create first user message with the provided prompt
    let firstUserMessageId: string | undefined;
    if (args.firstQuestion && args.firstQuestion.trim()) {
      firstUserMessageId = await ctx.db.insert("messages", {
        chatId,
        parentMessageId: noteId,
        role: "user",
        content: args.firstQuestion,
        createdBy: args.userId,
        createdAt: createdAt + 1, // Ensure it comes after the note
        depth: 1,
      });
    }
    
    // Update the dive's updatedAt timestamp
    await ctx.db.patch(args.diveId, { updatedAt: createdAt });
    
    return { conceptId, chatId, firstUserMessageId };
  },
});


export const listByDive = query({
  args: {
    diveId: v.id("dives"),
  },
  handler: async (ctx, args) => {
    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_dive", (q) => q.eq("diveId", args.diveId))
      .order("desc")
      .collect();
    
    return concepts;
  },
});

export const get = query({
  args: {
    conceptId: v.id("concepts"),
  },
  handler: async (ctx, args) => {
    const concept = await ctx.db.get(args.conceptId);
    if (!concept) {
      throw new Error("Concept not found");
    }
    
    // Get associated chat
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_concept", (q) => q.eq("conceptId", args.conceptId))
      .first();
    
    return {
      ...concept,
      chat,
    };
  },
});

export const update = mutation({
  args: {
    conceptId: v.id("concepts"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const concept = await ctx.db.get(args.conceptId);
    if (!concept) {
      throw new Error("Concept not found");
    }
    
    await ctx.db.patch(args.conceptId, {
      note: args.note,
    });
    
    return { success: true };
  },
});