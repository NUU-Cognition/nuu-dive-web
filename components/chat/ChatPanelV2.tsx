"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, GitBranch, Paperclip, Info, ChevronRight } from "lucide-react";
import MessageItem from "./MessageItem";
import ContextInspector from "./ContextInspector";
import ExportButton from "./ExportButton";
import { useStreamChat } from "@/hooks/useStreamChat";
import { useConvexChat } from "@/hooks/useConvexChat";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Id } from "@/convex/_generated/dataModel";
import CreateConceptDialog from "@/components/concept/CreateConceptDialog";
import { ConceptCreationTooltip } from "./ConceptCreationTooltip";

interface ChatPanelProps {
  chatId: string;
  conceptId: string | null;
  onClose: () => void;
  onCollapse?: () => void;
}

// Message interface is imported from useConvexChat hook

// Helper function to generate title from selected text (first few words)
function generateTitleFromText(text: string): string {
  const words = text.trim().split(/\s+/);
  const maxWords = 5;
  const title = words.slice(0, maxWords).join(" ");
  return title.length > 50 ? title.substring(0, 47) + "..." : title;
}

// Helper function to generate first prompt template
function generateFirstPrompt(text: string): string {
  return `Tell me about: ${text.trim()}`;
}

export default function ChatPanelV2({ chatId, conceptId, onClose, onCollapse }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [contextInspectorOpen, setContextInspectorOpen] = useState(false);
  const [inclusionOverride, setInclusionOverride] = useState<{ includeIds?: string[]; excludeIds?: string[] } | undefined>(undefined);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchInput, setBranchInput] = useState("");
  const [branchFromId, setBranchFromId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [createConceptOpen, setCreateConceptOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedMessageForConcept, setSelectedMessageForConcept] = useState<{ _id: string; content: string; role: string } | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Workspace context for user & dive metadata + leaf cursor
  const { currentUserId, diveId, setSelectedChat, getLeafForChat, setLeafForChat, setPendingForChat } = useWorkspace();
  const ready = Boolean(currentUserId);
  
  // Persist overrides per anchor (the current leaf message)
  const upsertOverrides = useMutation(api.inclusionOverrides.upsert);

  // Messages for this chat
  const {
    messages: rawMessages,
    createUserMessage,
    createAssistantMessage,
    createBranch,
    deleteMessage,
  } = useConvexChat({
    chatId,
    conceptId,
    userId: currentUserId || "",
    diveId,
  });
  const messages = useMemo(() => rawMessages ?? [], [rawMessages]);
  const messagesLoading = rawMessages === undefined;

  // Build indices for efficient lookups
  const byId = useMemo(() => new Map<string, typeof messages[0]>(messages.map((m: typeof messages[0]) => [m._id, m])), [messages]);
  

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

  // Separate inherited and current messages
  const { inheritedMessages, currentMessages } = useMemo(() => {
    const inherited = messages.filter((m: typeof messages[0]) => (m as typeof messages[0] & { isInherited?: boolean }).isInherited) || [];
    const current = messages.filter((m: typeof messages[0]) => !(m as typeof messages[0] & { isInherited?: boolean }).isInherited) || [];
    return { inheritedMessages: inherited, currentMessages: current };
  }, [messages]);

  // Path to the current leaf (only from current messages)
  const currentByIdMap = useMemo(() => new Map<string, typeof currentMessages[0]>(currentMessages.map((m: typeof currentMessages[0]) => [m._id, m])), [currentMessages]);
  
  const path = useMemo(() => {
    if (!leafId) return [...inheritedMessages, ...currentMessages];
    const p: typeof messages = [];
    let cur = currentByIdMap.get(leafId as Id<"messages">);
    const guard = new Set<Id<"messages">>();
    while (cur && !guard.has(cur._id)) {
      p.unshift(cur);
      guard.add(cur._id);
      cur = cur.parentMessageId ? currentByIdMap.get(cur.parentMessageId) : undefined;
    }
    // Always include inherited messages at the beginning
    return [...inheritedMessages, ...p];
  }, [leafId, currentByIdMap, inheritedMessages, currentMessages]);

  const pathLeaf = path[path.length - 1];
  
  // For determining parent of new messages, only consider current messages (not inherited)
  const currentPathLeaf = currentMessages.length > 0 ? 
    currentMessages.find((m: typeof currentMessages[0]) => m._id === leafId) || currentMessages[currentMessages.length - 1] :
    undefined;
  
  // Check if the path leaf is a user message that needs a response
  const needsResponse = useMemo(() => {
    if (!pathLeaf) return false;
    if (pathLeaf.role !== "user") return false;
    // Check if there's already an assistant response to this user message
    const hasResponse = messages.some(
      (m: typeof messages[0]) => m.role === "assistant" && m.parentMessageId === pathLeaf._id
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
    onStart: ({ messageId }) => {
      // Create ephemeral loading dot for this chat immediately
      setPendingForChat(chatId, { id: messageId, parentMessageId: pendingParentIdRef.current ?? undefined });
    },
    onToken: (token) => {
      setStreamingMessage((prev) => prev + token);
    },
    onComplete: async (fullText) => {
      // Remove loading dot; persisted message will appear next render
      setPendingForChat(chatId, null);
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
      setPendingForChat(chatId, null);
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
      void sendMessage({
        chatId,
        parentMessageId: pathLeaf._id,
        userText: pathLeaf.content,
        messages: path,
        inclusionOverride: undefined,
        attachments: [],
      });
    }
  }, [chatId, path, pathLeaf, needsResponse, isStreaming, sendMessage, ready]);

  // Continue = append to the current conversation
  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming || !ready) return;

    // Determine what to parent the new message to:
    // Only consider current messages (not inherited) for parent determination
    // If current leaf is an assistant or note, parent to it
    // If current leaf is a user, we need to wait for its response first
    let parentId = currentPathLeaf?._id;
    
    // If there are no current messages yet, use undefined as parent (start new thread)
    if (currentMessages.length === 0) {
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
    if (!path.some((m: typeof path[0]) => m._id === newUserMessage._id)) {
      newPath.push(newUserMessage as typeof path[number]);
    }

    await sendMessage({
      chatId,
      parentMessageId: newUserMessage._id,
      userText: newUserMessage.content,
      messages: newPath,
      inclusionOverride: inclusionOverride,
      attachments: [],
    });

    // Persist overrides for this anchor if provided
    try {
      if (inclusionOverride && currentPathLeaf?._id && currentUserId) {
        await upsertOverrides({
          anchorMessageId: currentPathLeaf._id as unknown as Parameters<typeof upsertOverrides>[0]['anchorMessageId'],
          includeIds: inclusionOverride.includeIds as unknown as Parameters<typeof upsertOverrides>[0]['includeIds'],
          excludeIds: inclusionOverride.excludeIds as unknown as Parameters<typeof upsertOverrides>[0]['excludeIds'],
          userId: currentUserId as unknown as Parameters<typeof upsertOverrides>[0]['userId'],
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
    let cur = branchFromId ? byId.get(branchFromId as Id<"messages">) : undefined;
    const guard = new Set<Id<"messages">>();
    while (cur && !guard.has(cur._id)) {
      branchPath.unshift(cur);
      guard.add(cur._id);
      cur = cur && cur.parentMessageId ? byId.get(cur.parentMessageId as Id<"messages">) : undefined;
    }
    branchPath.push(branchMessage as typeof branchPath[number]);
    
    // Send branched message to streaming API
    await sendMessage({
      chatId,
      parentMessageId: branchMessage._id,
      userText: branchMessage.content,
      messages: branchPath,
      inclusionOverride: undefined,
      attachments: [],
    });
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleDelete = (messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (messageToDelete && ready) {
      try {
        await deleteMessage(messageToDelete);
      } catch (error) {
        console.error("Failed to delete message:", error);
      }
    }
    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  };

  const handleExtractConcept = (message: { _id: string; content: string; role: string }) => {
    setSelectedMessageForConcept(message);
    setSelectedText(message.content);
    setCreateConceptOpen(true);
  };

  // Handle text selection from messages
  const handleTextSelection = (event: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim();
      
      // Only show tooltip for selections of reasonable length (avoid accidental single clicks)
      if (selectedText.length < 3) {
        return;
      }
      
      // Get cursor position for tooltip
      const tooltipX = event.clientX;
      const tooltipY = event.clientY;
      
      // Find which message contains the selected text
      const range = selection.getRangeAt(0);
      let element: Node | null = range.commonAncestorContainer;
      
      // Traverse up the DOM to find the message container
      while (element && element.nodeType !== Node.ELEMENT_NODE) {
        element = element.parentNode;
      }
      
      while (element && !(element as Element).getAttribute?.('data-message-id')) {
        element = (element as Element).parentElement;
      }
      
      if (element && (element as Element).getAttribute('data-message-id')) {
        const messageId = (element as Element).getAttribute('data-message-id');
        
        // Find the full message object
        const sourceMessage = messages.find((m: typeof messages[0]) => m._id === messageId);
        if (sourceMessage) {
          setSelectedText(selectedText);
          setSelectedMessageForConcept({
            _id: sourceMessage._id,
            content: sourceMessage.content,
            role: sourceMessage.role,
          });
          
          // Show tooltip instead of directly opening dialog
          setTooltipPosition({ x: tooltipX, y: tooltipY });
          setTooltipVisible(true);
        }
      } else {
        // Fallback: just set the selected text without message context
        setSelectedText(selectedText);
        setSelectedMessageForConcept(null);
        
        // Show tooltip instead of directly opening dialog
        setTooltipPosition({ x: tooltipX, y: tooltipY });
        setTooltipVisible(true);
      }
    }
  };

  // Handle concept creation from tooltip
  const handleCreateConceptFromTooltip = () => {
    setTooltipVisible(false);
    setCreateConceptOpen(true);
  };

  // Handle tooltip close
  const handleTooltipClose = () => {
    setTooltipVisible(false);
    // Clear selection to remove highlight
    window.getSelection()?.removeAllRanges();
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
          {inheritedMessages.length > 0 && (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
              +{inheritedMessages.length} inherited
            </span>
          )}
          {path.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {path.filter(m => m.role !== "note").length} total messages
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            chatId={chatId}
            messages={path}
            currentMessageId={pathLeaf?._id}
          />
          {onCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCollapse}
              aria-label="Collapse Chat panel"
              title="Collapse"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages - showing inherited context and current path */}
      <div className="flex-1 overflow-y-auto p-4" onMouseUp={handleTextSelection}>
        <div className="space-y-4">
          {/* Inherited Context Section */}
          {inheritedMessages.length > 0 && (
            <div className="border-l-2 border-blue-200 pl-4 bg-blue-50/30 rounded-r-lg">
              <div className="mb-3 text-xs text-blue-600 font-medium flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                Inherited Context ({inheritedMessages.length} messages)
              </div>
              {inheritedMessages.map((node: typeof inheritedMessages[0], index: number) => (
                <div key={`inherited-${node.inheritedFromChatId || node.chatId}-${node._id}-${index}`} className="opacity-75">
                  <MessageItem
                    message={node}
                    isLatest={false}
                    isInherited={true}
                    onCopy={() => handleCopy(node.content)}
                    onExtractConcept={() => handleExtractConcept(node)}
                    depth={0}
                  />
                </div>
              ))}
              <div className="border-t border-blue-200 mt-3 pt-3 text-xs text-blue-600">
                ↓ Current conversation continues below
              </div>
            </div>
          )}
          
          {/* Current Messages */}
          {currentMessages.length > 0 && path.filter((m) => !(m as typeof messages[0] & { isInherited?: boolean }).isInherited).map((node) => (
            <MessageItem
              key={`current-${chatId}-${node._id}`}
              message={node}
              isLatest={node._id === pathLeaf?._id}
              onBranch={node.role === "assistant" ? () => handleBranch(node._id) : undefined}
              onCopy={() => handleCopy(node.content)}
              onExtractConcept={() => handleExtractConcept(node)}
              onDelete={() => handleDelete(node._id)}
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

      {/* Context & Attachments Bar */}
      <div className="border-t px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setContextInspectorOpen(true)}
            className="text-xs"
            disabled={messagesLoading}
          >
            <Info className="mr-1 h-3 w-3" />
            Context ({messagesLoading ? "…" : path.filter(m => m.role !== "note").length})
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
              disabled={isStreaming || !ready || messagesLoading}
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isStreaming || !ready || messagesLoading}
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

      {/* Create Concept Dialog */}
      <CreateConceptDialog
        open={createConceptOpen}
        onOpenChange={setCreateConceptOpen}
        initialTitle={selectedText ? generateTitleFromText(selectedText) : ""}
        initialSnippet={selectedText}
        initialFirstPrompt={selectedText ? generateFirstPrompt(selectedText) : "What's the key idea here?"}
        sourceType="chat"
        sourceMessageId={selectedMessageForConcept?._id}
        contextInfo={selectedMessageForConcept ? `From ${selectedMessageForConcept.role} message` : "From selected text"}
        onSuccess={() => {
          setSelectedText("");
          setSelectedMessageForConcept(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this message? This will also delete all child messages in this branch. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Concept Creation Tooltip */}
      <ConceptCreationTooltip
        isVisible={tooltipVisible}
        position={tooltipPosition}
        selectedText={selectedText}
        onCreateConcept={handleCreateConceptFromTooltip}
        onClose={handleTooltipClose}
      />
    </div>
  );
}