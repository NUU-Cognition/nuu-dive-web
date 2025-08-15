import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_workspace", ["workspaceId"]),

  workspaces: defineTable({
    name: v.string(),
    ownerUserId: v.id("users"),
    createdAt: v.number(),
  }).index("by_owner", ["ownerUserId"]),

  dives: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_creator", ["createdBy"]),

  documents: defineTable({
    diveId: v.id("dives"),
    kind: v.union(v.literal("url"), v.literal("pdf")),
    title: v.string(),
    url: v.optional(v.string()),
    pdfId: v.optional(v.id("_storage")),
    pdfMeta: v.optional(v.object({
      fileName: v.string(),
      pageCount: v.optional(v.number()),
    })),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_dive", ["diveId"]),

  concepts: defineTable({
    diveId: v.id("dives"),
    title: v.string(),
    snippet: v.string(),
    sourceType: v.union(v.literal("url"), v.literal("pdf"), v.literal("chat")),
    sourceUrl: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
    pdfId: v.optional(v.id("_storage")),
    pdfMeta: v.optional(v.object({
      fileName: v.string(),
      page: v.optional(v.number()),
      rect: v.optional(v.object({ 
        x: v.number(), 
        y: v.number(), 
        w: v.number(), 
        h: v.number() 
      })),
    })),
    locatorCss: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_dive", ["diveId"]).index("by_document", ["documentId"]),

  chats: defineTable({
    diveId: v.id("dives"),
    anchorType: v.optional(v.union(v.literal("document"), v.literal("concept"), v.literal("free"))), // Made optional for backwards compatibility
    anchorId: v.optional(v.union(v.id("documents"), v.id("concepts"))),
    conceptId: v.optional(v.id("concepts")), // Keep for backwards compatibility
    title: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_dive", ["diveId"])
    .index("by_concept", ["conceptId"])
    .index("by_anchor", ["anchorType", "anchorId"]),

  messages: defineTable({
    chatId: v.id("chats"),
    parentMessageId: v.optional(v.id("messages")),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant"),
      v.literal("note")
    ),
    content: v.string(),
    tokenCount: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    depth: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_chat", ["chatId"])
    .index("by_parent", ["parentMessageId"]),

  attachments: defineTable({
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
    createdAt: v.number(),
  }).index("by_message", ["messageId"]),

  inclusionOverrides: defineTable({
    anchorMessageId: v.id("messages"),
    includeIds: v.optional(v.array(v.id("messages"))),
    excludeIds: v.optional(v.array(v.id("messages"))),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_anchor", ["anchorMessageId"]),
});