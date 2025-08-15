import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreate = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (existingUser) {
      return existingUser._id;
    }
    
    // Create new user
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      image: args.image,
      createdAt: Date.now(),
    });
    
    // Create default workspace for the user
    const workspaceId = await ctx.db.insert("workspaces", {
      name: `${args.name || args.email.split("@")[0]}'s Workspace`,
      ownerUserId: userId,
      createdAt: Date.now(),
    });
    
    // Update user with workspace
    await ctx.db.patch(userId, { workspaceId });
    
    return userId;
  },
});

export const getByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (!user) {
      return null;
    }
    
    const workspace = user.workspaceId
      ? await ctx.db.get(user.workspaceId)
      : null;
    
    return {
      ...user,
      workspace,
    };
  },
});

export const get = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      return null;
    }
    
    const workspace = user.workspaceId
      ? await ctx.db.get(user.workspaceId)
      : null;
    
    return {
      ...user,
      workspace,
    };
  },
});