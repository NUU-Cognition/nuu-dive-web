"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, FileText, Link2, ExternalLink } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useStreamChat } from "@/hooks/useStreamChat";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });

interface DocumentPanelProps {
  documentId: string;
  onClose: () => void;
  /** "main" replaces canvas; "dock" is the old narrow panel */
  layout?: "main" | "dock";
}

export default function DocumentPanel({ documentId, onClose, layout = "dock" }: DocumentPanelProps) {
  const { currentUserId, setSelectedChat, setLeafForChat } = useWorkspace();
  const [question, setQuestion] = useState("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  // Get document details
  const document = useQuery(
    api.documents.get,
    { documentId: documentId as Id<"documents"> }
  );
  
  // Get existing chats for this document
  const documentChats = useQuery(
    api.chats.listByAnchor,
    { anchorType: "document" as const, anchorId: documentId as Id<"documents"> }
  );
  
  // Mutations
  const createChatForDocument = useMutation(api.chats.createForDocument);
  const createUserMessage = useMutation(api.messages.createUser);
  const createAssistantMessage = useMutation(api.messages.createAssistant);
  
  // Streaming hook
  const { sendMessage, isStreaming } = useStreamChat({
    onToken: (token) => {
      setStreamingMessage((prev) => prev + token);
    },
    onComplete: async (fullText) => {
      // Persist assistant reply under the user message we just created
      if (activeChatId && pendingParentId && currentUserId) {
        const assistantId = await createAssistantMessage({
          chatId: activeChatId as Id<"chats">,
          parentMessageId: pendingParentId as Id<"messages">,
          content: fullText,
          tokenCount: fullText.trim().split(/\s+/).length,
          userId: currentUserId as Id<"users">,
        });
        // Set the leaf to the new assistant message
        setLeafForChat(activeChatId, assistantId as string);
        setSelectedChat(activeChatId);
      }
      setStreamingMessage("");
      setQuestion("");
      setIsCreatingChat(false);
      setPendingParentId(null);
    },
    onError: (error) => {
      console.error("Stream error:", error);
      setStreamingMessage("");
      setIsCreatingChat(false);
    },
  });
  
  const handleAsk = async () => {
    if (!question.trim() || !currentUserId || isStreaming) return;
    
    setIsCreatingChat(true);
    
    try {
      let chatId = documentChats?.[0]?._id;
      
      // Create chat if it doesn't exist
      if (!chatId) {
        chatId = await createChatForDocument({
          documentId: documentId as Id<"documents">,
          diveId: document?.diveId as Id<"dives">,
          title: document?.title,
          userId: currentUserId as Id<"users">,
        });
      }
      setActiveChatId(chatId as string);
      
      // Create user message
      const userMessageId = await createUserMessage({
        chatId: chatId as Id<"chats">,
        content: question,
        userId: currentUserId as Id<"users">,
      });
      setPendingParentId(userMessageId as string);
      
      // Stream response
      await sendMessage({
        chatId: chatId as string,
        parentMessageId: userMessageId as string,
        userText: question,
        messages: [], // Note will exist server-side; we still attach for citations
        inclusionOverride: undefined,
        attachments: document?.url
          ? [{ type: "url", url: document.url, title: document.title }]
          : [],
      });
    } catch (error) {
      console.error("Failed to ask document:", error);
      setIsCreatingChat(false);
    }
  };
  
  const outerClass =
    layout === "main"
      ? "flex-1 min-w-0 border-r bg-background h-full flex flex-col"
      : "w-[400px] border-l bg-background h-full flex flex-col";

  if (!document) {
    return (
      <div className={outerClass + " flex items-center justify-center"}>
        <div className="animate-pulse">Loading document...</div>
      </div>
    );
  }
  
  return (
    <div className={outerClass}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {document.kind === "url" ? (
            <Link2 className="h-5 w-5 text-muted-foreground" />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground" />
          )}
          <h2 className="font-semibold text-sm truncate flex-1" title={document.title}>
            {document.title}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Document info */}
      <div className="px-4 py-3 border-b">
        {document.url && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Source:</span>
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {new URL(document.url).hostname}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span>{document.responseCount || 0} responses</span>
          <span>{document.conceptCount || 0} concepts</span>
        </div>
      </div>
      
      {/* Middle content - PDF viewer or existing responses */}
      <div className="flex-1 overflow-hidden min-w-0">
        {document.kind === "pdf" ? (
          <div className="h-full">
            <PdfViewer
              documentId={documentId}
              fileId={(document as any).pdfId}
              externalUrl={!(document as any).pdfId ? document.url : undefined}
              fileName={(document as any)?.pdfMeta?.fileName || document.title}
              existingHighlights={
                // Get highlights from concepts tied to this document
                []  // TODO: Query concepts and extract their highlights
              }
            />
          </div>
        ) : (
          // Previous questions area for URLs
          documentChats && documentChats.length > 0 ? (
            <div className="p-4 overflow-y-auto h-full">
              <p className="text-xs text-muted-foreground mb-2">Previous questions:</p>
              {/* TODO: Show message tree here */}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Ask something about this document…
            </div>
          )
        )}
      </div>
      
      {/* Streaming response */}
      {streamingMessage && (
        <div className="px-4 py-3 border-t bg-muted/50">
          <div className="text-sm whitespace-pre-wrap">{streamingMessage}</div>
        </div>
      )}
      
      {/* Ask input */}
      <div className="border-t p-4 mt-auto">
        <div className="space-y-3">
          <label className="text-sm font-medium">Prompt this document...</label>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter a prompt for this document…"
            className="min-h-[80px] resize-none"
            disabled={isStreaming || isCreatingChat}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
          />
          <Button
            onClick={handleAsk}
            disabled={!question.trim() || isStreaming || isCreatingChat || !currentUserId}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            {isStreaming ? "Generating..." : "Prompt"}
          </Button>
        </div>
      </div>
    </div>
  );
}