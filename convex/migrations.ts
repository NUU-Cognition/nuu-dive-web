import { mutation } from "./_generated/server";

export const migrateChatsAnchorType = mutation({
  handler: async (ctx) => {
    const chats = await ctx.db.query("chats").collect();
    let updated = 0;
    
    for (const chat of chats) {
      // Skip if already has anchorType
      if (chat.anchorType) continue;
      
      // If has conceptId, set as concept anchor
      if (chat.conceptId) {
        await ctx.db.patch(chat._id, {
          anchorType: "concept",
          anchorId: chat.conceptId,
        });
        updated++;
      } else {
        // Otherwise mark as free chat
        await ctx.db.patch(chat._id, {
          anchorType: "free",
        });
        updated++;
      }
    }
    
    return { updated, total: chats.length };
  },
});