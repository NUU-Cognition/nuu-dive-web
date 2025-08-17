"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, GitBranch, Paperclip, Info, Plus, FileText } from "lucide-react";
import MessageItem from "./MessageItem";
import ContextInspector from "./ContextInspector";
import ExportButton from "./ExportButton";
import { useStreamChat } from "@/hooks/useStreamChat";
import { useConvexChat } from "@/hooks/useConvexChat";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ChatPanelProps {
  chatId: string;
  conceptId: string | null;
  onClose: () => void;
}

interface Message {
  _id: string;
  role: "system" | "user" | "assistant" | "note";
  content: string;
  parentMessageId?: string;
  depth: number;
  createdAt: number;
}

export default function ChatPanelV2({ chatId, conceptId, onClose }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [contextInspectorOpen, setContextInspectorOpen] = useState(false);
  const [inclusionOverride, setInclusionOverride] = useState<{ includeIds?: string[]; excludeIds?: string[] } | undefined>(undefined);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchInput, setBranchInput] = useState("");
  const [branchFromId, setBranchFromId] = useState<string | null>(null);
  const [extractConceptDialog, setExtractConceptDialog] = useState(false);
  const [conceptTitle, setConceptTitle] = useState("");
  const [conceptSnippet, setConceptSnippet] = useState("");
  const [selectedMessageForConcept, setSelectedMessageForConcept] = useState<any>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Workspace context for user & dive metadata + leaf cursor
  const { currentUserId, diveId, setSelectedChat, getLeafForChat, setLeafForChat } = useWorkspace();
  const ready = Boolean(currentUserId);
  
  // Persist overrides per anchor (the current leaf message)
  const upsertOverrides = useMutation(api.inclusionOverrides.upsert);

  // Messages for this chat
  const {
    messages = [],
    createUserMessage,
    createAssistantMessage,
    createBranch,
    createConcept,
  } = useConvexChat({
    chatId,
    conceptId,
    userId: currentUserId || "",
    diveId,
  });
  
  // Get the concept for this chat
  const concept = useQuery(
    api.concepts.get,
    conceptId ? { conceptId: conceptId as Id<"concepts"> } : "skip"
  );
  
  // Get the document for this concept (contains extracted content)
  const document = useQuery(
    api.documents.get,
    concept?.documentId ? { documentId: concept.documentId } : "skip"
  );

  // Build indices for efficient lookups
  const byId = useMemo(() => new Map(messages.map((m) => [m._id, m])), [messages]);
  

  // Compute default leaf - prefer latest assistant, then latest user, then latest message
  const defaultLeaf = useMemo(() => {
    // First try to find the latest assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant") return m._id;
    }
    // Then try latest user message
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user") return m._id;
    }
    // Finally, just use the latest message
    return messages[messages.length - 1]?._id;
  }, [messages]);

  const leafId = getLeafForChat(chatId) ?? defaultLeaf;

  // Ensure a leaf is set once messages arrive
  useEffect(() => {
    if (!getLeafForChat(chatId) && defaultLeaf) {
      setLeafForChat(chatId, defaultLeaf);
    }
  }, [chatId, defaultLeaf, getLeafForChat, setLeafForChat]);

  // Path to the current leaf
  const path = useMemo(() => {
    if (!leafId) return [];
    const p: typeof messages = [];
    let cur = byId.get(leafId);
    const guard = new Set<string>();
    while (cur && !guard.has(cur._id)) {
      p.unshift(cur);
      guard.add(cur._id);
      cur = cur.parentMessageId ? byId.get(cur.parentMessageId) : undefined;
    }
    return p;
  }, [leafId, byId]);

  const pathLeaf = path[path.length - 1];
  
  // Check if the path leaf is a user message that needs a response
  const needsResponse = useMemo(() => {
    if (!pathLeaf) return false;
    if (pathLeaf.role !== "user") return false;
    // Check if there's already an assistant response to this user message
    const hasResponse = messages.some(
      m => m.role === "assistant" && m.parentMessageId === pathLeaf._id
    );
    return !hasResponse;
  }, [pathLeaf, messages]);

  // Track the parent message id for the assistant's reply to avoid races
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const pendingParentIdRef = useRef<string | null>(null);

  // Guard: ensure we only trigger a stream once per user message id
  const sentUserIdsRef = useRef<Set<string>>(new Set());

  // Streaming hook for LLM responses
  const { sendMessage, isStreaming } = useStreamChat({
    onToken: (token) => {
      setStreamingMessage((prev) => prev + token);
    },
    onComplete: async (fullText) => {
      console.log("Stream complete, saving assistant message");
      console.log("Full text length:", fullText?.length);
      console.log("Pending parent ID (state):", pendingParentId);
      console.log("Pending parent ID (ref):", pendingParentIdRef.current);
      console.log("Ready:", ready);
      console.log("Chat ID:", chatId);
      
      // Save assistant message to Convex under the exact parent we streamed for
      const parentId = pendingParentIdRef.current || pendingParentId;
      if (parentId && ready && chatId) {
        try {
          console.log("Creating assistant message with parent:", parentId);
          const inserted = await createAssistantMessage(
            fullText,
            parentId,
            fullText.trim().split(/\s+/).length
          );
          console.log("Assistant message created:", inserted);
          
          // Update leaf to the new assistant message
          setLeafForChat(chatId, inserted._id);
          // Trigger re-render of canvas by re-selecting chat
          // This ensures the graph updates with the new response
          setSelectedChat("");
          setTimeout(() => setSelectedChat(chatId), 50);
        } catch (error) {
          console.error("Failed to save assistant message:", error);
        }
      } else {
        console.warn("Cannot save assistant message - missing required data:", {
          parentId, ready, chatId
        });
      }
      setPendingParentId(null);
      pendingParentIdRef.current = null;
      setStreamingMessage("");
    },
    onError: (error) => {
      console.error("Stream error:", error);
      setStreamError(error);
      setStreamingMessage("");
      setPendingParentId(null);
      pendingParentIdRef.current = null;
      // Clear error after 5 seconds
      setTimeout(() => setStreamError(null), 5000);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [path, streamingMessage]);

  // Reset per-chat guards when switching chats
  useEffect(() => {
    sentUserIdsRef.current = new Set();
    setPendingParentId(null);
    pendingParentIdRef.current = null;
    setStreamingMessage("");
  }, [chatId]);

  // Auto-stream only if the current leaf is a user message awaiting response
  useEffect(() => {
    if (!pathLeaf || isStreaming || !ready || !needsResponse) return;
    if (!sentUserIdsRef.current.has(pathLeaf._id)) {
      sentUserIdsRef.current.add(pathLeaf._id);
      setPendingParentId(pathLeaf._id);
      pendingParentIdRef.current = pathLeaf._id;
      // Prepare attachments including extracted content from document
      const attachments = [];
      if (document && document.extractedContent && document.extractedContent.length > 0) {
        attachments.push({
          type: 'extracted_content',
          content: document.extractedContent,
          title: `${document.title} - Extracted Content`,
          filename: 'extracted_content.md'
        });
      }
      
      void sendMessage({
        chatId,
        parentMessageId: pathLeaf._id,
        userText: pathLeaf.content,
        messages: path,
        inclusionOverride: undefined,
        attachments,
      });
    }
  }, [chatId, path, pathLeaf, needsResponse, isStreaming, sendMessage, ready]);

  // Continue = append to the current conversation
  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming || !ready) return;

    // Determine what to parent the new message to:
    // If leaf is an assistant or note, parent to it
    // If leaf is a user, we need to wait for its response first
    let parentId = pathLeaf?._id;
    
    // If there's no path yet (empty chat), parent to undefined
    if (path.length === 0) {
      parentId = undefined;
    }
    
    // Create user message in Convex
    const newUserMessage = await createUserMessage(inputValue, parentId);
    
    // Update the leaf to this new user message
    setLeafForChat(chatId, newUserMessage._id);
    
    // Mark as sent to prevent double auto-stream
    sentUserIdsRef.current.add(newUserMessage._id);
    
    setInputValue("");
    setPendingParentId(newUserMessage._id);
    pendingParentIdRef.current = newUserMessage._id;

    // Send to streaming API with updated path context
    const newPath = [...path];
    // Only add the new message if it's not already in the path
    if (!path.some(m => m._id === newUserMessage._id)) {
      newPath.push(newUserMessage);
    }

    // Prepare attachments including extracted content from document
    const attachments = [];
    if (document && document.extractedContent && document.extractedContent.length > 0) {
      attachments.push({
        type: 'extracted_content',
        content: document.extractedContent,
        title: `${document.title} - Extracted Content`,
        filename: 'extracted_content.md'
      });
    }

    await sendMessage({
      chatId,
      parentMessageId: newUserMessage._id,
      userText: newUserMessage.content,
      messages: newPath,
      inclusionOverride: inclusionOverride,
      attachments,
    });

    // Persist overrides for this anchor if provided
    try {
      if (inclusionOverride && pathLeaf?._id && currentUserId) {
        await upsertOverrides({
          anchorMessageId: pathLeaf._id as any,
          includeIds: inclusionOverride.includeIds as any,
          excludeIds: inclusionOverride.excludeIds as any,
          userId: currentUserId as any,
        });
      }
    } catch (e) {
      console.warn("Failed to persist inclusion overrides:", e);
    }
  };

  const handleBranch = (fromMessageId: string) => {
    setBranchFromId(fromMessageId);
    setBranchDialogOpen(true);
  };

  // Branch = create a new path from an assistant message
  const handleCreateBranch = async () => {
    if (!branchInput.trim() || !branchFromId || !ready) return;

    // Create branch in Convex (parent to the assistant we're branching from)
    const branchMessage = await createBranch(branchFromId, branchInput);
    
    // Switch to the new branch
    setLeafForChat(chatId, branchMessage._id);
    sentUserIdsRef.current.add(branchMessage._id);
    
    setBranchInput("");
    setBranchDialogOpen(false);
    setBranchFromId(null);
    setPendingParentId(branchMessage._id);
    pendingParentIdRef.current = branchMessage._id;

    // Build path up to and including the branch point
    const branchPath: typeof messages = [];
    let cur = byId.get(branchFromId);
    const guard = new Set<string>();
    while (cur && !guard.has(cur._id)) {
      branchPath.unshift(cur);
      guard.add(cur._id);
      cur = cur.parentMessageId ? byId.get(cur.parentMessageId) : undefined;
    }
    branchPath.push(branchMessage);

    // Prepare attachments including extracted content from document
    const attachments = [];
    if (document && document.extractedContent && document.extractedContent.length > 0) {
      attachments.push({
        type: 'extracted_content',
        content: document.extractedContent,
        title: `${document.title} - Extracted Content`,
        filename: 'extracted_content.md'
      });
    }

    // Send branched message to streaming API
    await sendMessage({
      chatId,
      parentMessageId: branchMessage._id,
      userText: branchMessage.content,
      messages: branchPath,
      inclusionOverride: undefined,
      attachments,
    });
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleExtractConcept = (message: any) => {
    setSelectedMessageForConcept(message);
    setConceptSnippet(message.content);
    setConceptTitle("");
    setExtractConceptDialog(true);
  };

  const handleCreateConcept = async () => {
    if (!conceptTitle.trim() || !conceptSnippet.trim() || !ready) return;

    await createConcept(conceptTitle, conceptSnippet, selectedMessageForConcept?._id);

    setExtractConceptDialog(false);
    setConceptTitle("");
    setConceptSnippet("");
    setSelectedMessageForConcept(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Render ONLY the path (linear conversation)
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Chat</h2>
          {path.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {path.filter(m => m.role !== "note").length} messages
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            chatId={chatId}
            messages={path}
            currentMessageId={pathLeaf?._id}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages - showing only the current path */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {path.map((node) => (
            <MessageItem
              key={node._id}
              message={node}
              isLatest={node._id === pathLeaf?._id}
              onBranch={node.role === "assistant" ? () => handleBranch(node._id) : undefined}
              onCopy={() => handleCopy(node.content)}
              onExtractConcept={() => handleExtractConcept(node)}
              depth={0}  // Force linear presentation - no indentation
            />
          ))}
          
          {/* Streaming message */}
          {streamingMessage && (
            <div className="group relative flex gap-3">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                  <div className="animate-pulse h-2 w-2 rounded-full bg-primary" />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Assistant</span>
                  <span className="text-xs text-muted-foreground">typing...</span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{streamingMessage}</p>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Attached Sources */}
      {document && document.extractedContent && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Attached Sources</span>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-mono">extracted_content.md</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {(document.extractedContent.length / 1024).toFixed(1)}KB
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {document.extractionLevel === 'full' ? 'Comprehensive document structure analysis' : 'Basic content extraction'}
            </p>
          </div>
        </div>
      )}

      {/* Context & Attachments Bar */}
      <div className="border-t px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setContextInspectorOpen(true)}
            className="text-xs"
          >
            <Info className="mr-1 h-3 w-3" />
            Context ({path.filter(m => m.role !== "note").length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            <Paperclip className="mr-1 h-3 w-3" />
            Attach
          </Button>
        </div>
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex flex-col gap-2">
          {!ready && (
            <div className="text-xs text-muted-foreground">
              Initializing workspace…
            </div>
          )}
          {streamError && (
            <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
              {streamError}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ready ? "Enter a prompt..." : "Initializing..."}
              className="min-h-[60px] resize-none"
              disabled={isStreaming || !ready}
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isStreaming || !ready}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Context Inspector - now receives just the path */}
      <ContextInspector
        open={contextInspectorOpen}
        onClose={() => setContextInspectorOpen(false)}
        messages={path}
        onSave={(o: { includeIds?: string[]; excludeIds?: string[] }) => setInclusionOverride(o)}
        extractedContent={document?.extractedContent}
        documentTitle={document?.title}
        extractionLevel={document?.extractionLevel}
      />

      {/* Branch Dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
            <DialogDescription>
              Start a new conversation branch from this message
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="What would you like to explore in this branch?"
              value={branchInput}
              onChange={(e) => setBranchInput(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBranch} disabled={!branchInput.trim()}>
              <GitBranch className="mr-2 h-4 w-4" />
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extract Concept Dialog */}
      <Dialog open={extractConceptDialog} onOpenChange={setExtractConceptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extract Concept</DialogTitle>
            <DialogDescription>
              Create a new concept from this message
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="e.g., Key Insight about X"
                value={conceptTitle}
                onChange={(e) => setConceptTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Snippet</label>
              <Textarea
                value={conceptSnippet}
                onChange={(e) => setConceptSnippet(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Will link back to the selected response as provenance.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtractConceptDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConcept} disabled={!conceptTitle.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Create Concept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}