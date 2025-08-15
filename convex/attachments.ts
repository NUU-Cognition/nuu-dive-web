import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByMessage = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    
    return attachments;
  },
});

export const add = mutation({
  args: {
    messageId: v.id("messages"),
    type: v.union(v.literal("url"), v.literal("pdf"), v.literal("upload")),
    url: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    title: v.optional(v.string()),
    meta: v.optional(v.object({
      mime: v.optional(v.string()),
      pageCount: v.optional(v.number()),
      size: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const attachmentId = await ctx.db.insert("attachments", {
      messageId: args.messageId,
      type: args.type,
      url: args.url,
      fileId: args.fileId,
      title: args.title,
      meta: args.meta,
      createdAt: Date.now(),
    });
    
    return attachmentId;
  },
});

export const remove = mutation({
  args: {
    attachmentId: v.id("attachments"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.attachmentId);
    return { success: true };
  },
});