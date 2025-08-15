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

export const create = mutation({
  args: {
    diveId: v.id("dives"),
    conceptId: v.optional(v.id("concepts")),
    title: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    
    const chatId = await ctx.db.insert("chats", {
      diveId: args.diveId,
      conceptId: args.conceptId,
      title: args.title,
      createdBy: args.userId,
      createdAt,
      updatedAt: createdAt,
    });
    
    return chatId;
  },
});