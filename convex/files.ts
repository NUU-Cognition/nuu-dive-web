import { query } from "./_generated/server";
import { v } from "convex/values";

export const getUrl = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, { fileId }) => {
    // Returns a temporary, signed URL. Can be null if fileId invalid.
    return await ctx.storage.getUrl(fileId);
  },
});