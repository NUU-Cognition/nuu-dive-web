import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    // For MVP, we'll use a simple auth check
    // In production, integrate with NextAuth properly
    const dives = await ctx.db
      .query("dives")
      .filter((q) =>
        args.workspaceId
          ? q.eq(q.field("workspaceId"), args.workspaceId)
          : true
      )
      .order("desc")
      .take(100);
    
    return dives;
  },
});

export const listByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get user's workspace
    const user = await ctx.db.get(args.userId);
    if (!user?.workspaceId) {
      return [];
    }
    
    // Get all dives in that workspace
    const dives = await ctx.db
      .query("dives")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", user.workspaceId))
      .order("desc")
      .collect();
    
    // Get concept count for each dive
    const divesWithCounts = await Promise.all(
      dives.map(async (dive) => {
        const concepts = await ctx.db
          .query("concepts")
          .withIndex("by_dive", (q) => q.eq("diveId", dive._id))
          .collect();
        
        return {
          ...dive,
          conceptCount: concepts.length,
        };
      })
    );
    
    return divesWithCounts;
  },
});

export const get = query({
  args: {
    diveId: v.id("dives"),
  },
  handler: async (ctx, args) => {
    const dive = await ctx.db.get(args.diveId);
    if (!dive) {
      throw new Error("Dive not found");
    }
    
    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_dive", (q) => q.eq("diveId", args.diveId))
      .collect();
    
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_dive", (q) => q.eq("diveId", args.diveId))
      .collect();
    
    return {
      ...dive,
      concepts,
      chats,
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const diveId = await ctx.db.insert("dives", {
      workspaceId: args.workspaceId,
      title: args.title,
      description: args.description,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });
    
    return diveId;
  },
});

export const update = mutation({
  args: {
    diveId: v.id("dives"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dive = await ctx.db.get(args.diveId);
    if (!dive) {
      throw new Error("Dive not found");
    }
    
    const updates: any = {
      updatedAt: Date.now(),
    };
    
    if (args.title !== undefined) {
      updates.title = args.title;
    }
    
    if (args.description !== undefined) {
      updates.description = args.description;
    }
    
    await ctx.db.patch(args.diveId, updates);
    
    return { success: true };
  },
});