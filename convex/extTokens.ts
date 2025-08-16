import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createHash } from "crypto";

function hashToken(token: string, salt: string): string {
  return createHash("sha256").update(`${token}:${salt}`).digest("hex");
}

export const create = mutation({
  args: { 
    label: v.string(), 
    token: v.string(), 
    salt: v.string() 
  },
  handler: async (ctx, { label, token, salt }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    // Get user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    
    if (!user) throw new Error("User not found");
    
    const hash = hashToken(token, salt);
    const tokenId = await ctx.db.insert("extensionTokens", {
      userId: user._id,
      label,
      hash,
      createdAt: Date.now(),
    });
    
    return { id: tokenId };
  },
});

export const revoke = mutation({
  args: { tokenId: v.id("extensionTokens") },
  handler: async (ctx, { tokenId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    
    if (!user) throw new Error("User not found");
    
    const token = await ctx.db.get(tokenId);
    if (!token || token.userId !== user._id) {
      throw new Error("Token not found or forbidden");
    }
    
    await ctx.db.patch(tokenId, { revokedAt: Date.now() });
    return { success: true };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    
    if (!user) return [];
    
    const tokens = await ctx.db
      .query("extensionTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    // Don't expose hashes to client
    return tokens.map(({ _id, label, createdAt, lastUsedAt, revokedAt }) => ({
      _id,
      label,
      createdAt,
      lastUsedAt,
      revokedAt,
    }));
  },
});

export const resolveUserByToken = query({
  args: { 
    token: v.string(), 
    salt: v.string() 
  },
  handler: async (ctx, { token, salt }) => {
    const hash = hashToken(token, salt);
    
    const tokenRecord = await ctx.db
      .query("extensionTokens")
      .withIndex("by_hash", (q) => q.eq("hash", hash))
      .first();
    
    if (!tokenRecord || tokenRecord.revokedAt) {
      return null;
    }
    
    const user = await ctx.db.get(tokenRecord.userId);
    return user ? { userId: tokenRecord.userId, email: user.email } : null;
  },
});

export const touch = mutation({
  args: { 
    token: v.string(), 
    salt: v.string() 
  },
  handler: async (ctx, { token, salt }) => {
    const hash = hashToken(token, salt);
    
    const tokenRecord = await ctx.db
      .query("extensionTokens")
      .withIndex("by_hash", (q) => q.eq("hash", hash))
      .first();
    
    if (!tokenRecord || tokenRecord.revokedAt) {
      return { success: false };
    }
    
    await ctx.db.patch(tokenRecord._id, { lastUsedAt: Date.now() });
    return { success: true };
  },
});