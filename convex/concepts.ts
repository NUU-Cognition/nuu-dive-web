import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    diveId: v.id("dives"),
    title: v.string(),
    snippet: v.string(),
    sourceType: v.union(v.literal("url"), v.literal("pdf")),
    sourceUrl: v.optional(v.string()),
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
      pdfId: args.pdfId,
      pdfMeta: args.pdfMeta,
      locatorCss: args.locatorCss,
      createdBy: args.userId,
      createdAt,
    });
    
    // Auto-create a chat for this concept
    const chatId = await ctx.db.insert("chats", {
      diveId: args.diveId,
      conceptId,
      title: args.title,
      createdBy: args.userId,
      createdAt,
      updatedAt: createdAt,
    });
    
    // Create an initial note message with the concept snippet
    await ctx.db.insert("messages", {
      chatId,
      parentMessageId: undefined,
      role: "note",
      content: `# ${args.title}\n\n> ${args.snippet}\n\nSource: ${args.sourceUrl || "PDF"}`,
      createdBy: args.userId,
      createdAt,
      depth: 0,
    });
    
    // Update the dive's updatedAt timestamp
    await ctx.db.patch(args.diveId, { updatedAt: createdAt });
    
    return { conceptId, chatId };
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