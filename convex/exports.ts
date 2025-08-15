import { action } from "./_generated/server";
import { v } from "convex/values";

export const branchToMarkdown = action({
  args: {
    chatId: v.id("chats"),
    leafMessageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    // Get all messages in the chat
    const allMessages = await ctx.runQuery("messages.listByChat", {
      chatId: args.chatId,
    });

    // Get the chat and related concept
    const chat = await ctx.runQuery("chats.get", { chatId: args.chatId });
    const concept = chat?.conceptId 
      ? await ctx.runQuery("concepts.get", { conceptId: chat.conceptId })
      : null;

    // Build the path from leaf to root
    const messagePath: typeof allMessages = [];
    let currentMessageId: string | undefined = args.leafMessageId;
    
    while (currentMessageId) {
      const message = allMessages.find((m) => m._id === currentMessageId);
      if (!message) break;
      messagePath.unshift(message);
      currentMessageId = message.parentMessageId;
    }

    // Get attachments for messages in path
    const attachments = await Promise.all(
      messagePath.map(async (m) => 
        ctx.runQuery("attachments.listByMessage", { messageId: m._id })
      )
    );

    // Build Markdown
    const now = new Date().toISOString();
    const lines: string[] = [];

    // YAML frontmatter
    lines.push("---");
    lines.push(`dive: "${chat?.title || "Untitled Dive"}"`);
    if (concept) {
      lines.push(`concept: "${concept.title}"`);
    }
    lines.push(`exportedAt: "${now}"`);
    lines.push(`messages: ${messagePath.length}`);
    lines.push("---");
    lines.push("");

    // Sources section
    const allAttachmentsList = attachments.flat();
    if (allAttachmentsList.length > 0 || concept?.sourceUrl) {
      lines.push("## Sources");
      lines.push("");
      
      if (concept?.sourceUrl) {
        lines.push(`1. [${concept.title}](${concept.sourceUrl})`);
      }
      
      allAttachmentsList.forEach((att, i) => {
        const index = concept?.sourceUrl ? i + 2 : i + 1;
        lines.push(`${index}. [${att.title || `Attachment ${index}`}](${att.url || "#"})`);
      });
      
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    // Conversation thread
    lines.push("## Conversation Thread");
    lines.push("");

    messagePath.forEach((message, index) => {
      // Add depth indicator
      const indent = "  ".repeat(message.depth);
      
      // Role header
      const roleLabel = 
        message.role === "user" ? "👤 **You**" :
        message.role === "assistant" ? "🤖 **Assistant**" :
        message.role === "note" ? "📝 **Note**" :
        "💭 **System**";
      
      lines.push(`${indent}${roleLabel}`);
      lines.push("");
      
      // Message content (indented)
      const contentLines = message.content.split("\n");
      contentLines.forEach((line) => {
        lines.push(`${indent}${line}`);
      });
      
      lines.push("");
      
      // Add separator between messages
      if (index < messagePath.length - 1) {
        lines.push(`${indent}↓`);
        lines.push("");
      }
    });

    // Footer
    lines.push("---");
    lines.push("");
    lines.push(`*Exported from Dive on ${new Date().toLocaleDateString()}*`);

    return lines.join("\n");
  },
});

// Helper query to get a chat
export const chatsGet = v.object({
  chatId: v.id("chats"),
});

// Helper query to get attachments
export const attachmentsListByMessage = v.object({
  messageId: v.id("messages"),
});