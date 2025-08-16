import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    anchorMessageId: v.id("messages"),
    includeIds: v.optional(v.array(v.id("messages"))),
    excludeIds: v.optional(v.array(v.id("messages"))),
    userId: v.id("users"),
  },
  handler: async (ctx, { anchorMessageId, includeIds, excludeIds, userId }) => {
    const existing = await ctx.db
      .query("inclusionOverrides")
      .withIndex("by_anchor", (q) => q.eq("anchorMessageId", anchorMessageId))
      .first();

    const payload = {
      anchorMessageId,
      includeIds,
      excludeIds,
      createdBy: userId,
      createdAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("inclusionOverrides", payload);
  },
});

export const getForAnchor = query({
  args: { anchorMessageId: v.id("messages") },
  handler: async (ctx, { anchorMessageId }) => {
    return await ctx.db
      .query("inclusionOverrides")
      .withIndex("by_anchor", (q) => q.eq("anchorMessageId", anchorMessageId))
      .first();
  },
});