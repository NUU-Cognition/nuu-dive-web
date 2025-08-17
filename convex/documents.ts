import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    diveId: v.id("dives"),
    kind: v.union(v.literal("url"), v.literal("pdf")),
    title: v.string(),
    url: v.optional(v.string()),
    pdfId: v.optional(v.id("_storage")),
    pdfMeta: v.optional(v.object({
      fileName: v.string(),
      pageCount: v.optional(v.number()),
    })),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    
    const documentId = await ctx.db.insert("documents", {
      diveId: args.diveId,
      kind: args.kind,
      title: args.title,
      url: args.url,
      pdfId: args.pdfId,
      pdfMeta: args.pdfMeta,
      createdBy: args.userId,
      createdAt,
    });
    
    // Update dive's updatedAt
    await ctx.db.patch(args.diveId, { updatedAt: createdAt });
    
    return documentId;
  },
});

export const listByDive = query({
  args: {
    diveId: v.id("dives"),
  },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_dive", (q) => q.eq("diveId", args.diveId))
      .order("desc")
      .collect();
    
    // Get counts for each document
    const docsWithCounts = await Promise.all(
      documents.map(async (doc) => {
        // Count direct response children (chats anchored to this document)
        const chats = await ctx.db
          .query("chats")
          .withIndex("by_anchor", (q) => 
            q.eq("anchorType", "document").eq("anchorId", doc._id)
          )
          .collect();
        
        let responseCount = 0;
        for (const chat of chats) {
          const messages = await ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
            .collect();
          responseCount += messages.filter(m => m.role === "assistant").length;
        }
        
        // Count concepts extracted from this document
        const concepts = await ctx.db
          .query("concepts")
          .withIndex("by_document", (q) => q.eq("documentId", doc._id))
          .collect();
        
        return {
          ...doc,
          responseCount,
          conceptCount: concepts.length,
        };
      })
    );
    
    return docsWithCounts;
  },
});

export const get = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }
    
    // Get associated concepts
    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    
    // Get chats anchored to this document
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_anchor", (q) => 
        q.eq("anchorType", "document").eq("anchorId", args.documentId)
      )
      .collect();
    
    return {
      ...document,
      concepts,
      chats,
    };
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const deleteWithRelated = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }
    
    // Get all concepts associated with this document
    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    
    // Delete each concept and its associated chat/messages
    for (const concept of concepts) {
      const chat = await ctx.db
        .query("chats")
        .withIndex("by_concept", (q) => q.eq("conceptId", concept._id))
        .first();
      
      if (chat) {
        // Get all messages in this chat
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .collect();
        
        // Soft delete all messages
        const deletedAt = Date.now();
        await Promise.all(
          messages.map((message) =>
            ctx.db.patch(message._id, { deletedAt })
          )
        );
        
        // Delete the chat
        await ctx.db.delete(chat._id);
      }
      
      // Delete the concept
      await ctx.db.delete(concept._id);
    }
    
    // Get chats directly anchored to this document
    const documentChats = await ctx.db
      .query("chats")
      .withIndex("by_anchor", (q) => 
        q.eq("anchorType", "document").eq("anchorId", args.documentId)
      )
      .collect();
    
    // Delete document-anchored chats and their messages
    for (const chat of documentChats) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
        .collect();
      
      // Soft delete all messages
      const deletedAt = Date.now();
      await Promise.all(
        messages.map((message) =>
          ctx.db.patch(message._id, { deletedAt })
        )
      );
      
      // Delete the chat
      await ctx.db.delete(chat._id);
    }
    
    // Delete the document
    await ctx.db.delete(args.documentId);
    
    return { success: true };
  },
});