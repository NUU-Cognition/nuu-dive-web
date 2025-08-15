"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, GitBranch, Paperclip, Info, Plus } from "lucide-react";
import MessageItem from "./MessageItem";
import ContextInspector from "./ContextInspector";
import ExportButton from "./ExportButton";
import { useStreamChat } from "@/hooks/useStreamChat";
import { useConvexChat } from "@/hooks/useConvexChat";
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

export default function ChatPanelV2({ chatId, conceptId, onClose }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [contextInspectorOpen, setContextInspectorOpen] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchInput, setBranchInput] = useState("");
  const [branchFromId, setBranchFromId] = useState<string | null>(null);
  const [extractConceptDialog, setExtractConceptDialog] = useState(false);
  const [conceptTitle, setConceptTitle] = useState("");
  const [conceptSnippet, setConceptSnippet] = useState("");
  const [selectedMessageForConcept, setSelectedMessageForConcept] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use Convex chat hook for real-time sync
  const {
    messages,
    createUserMessage,
    createAssistantMessage,
    createBranch,
    createConcept,
  } = useConvexChat({ chatId, conceptId });

  // Streaming hook for LLM responses
  const { sendMessage, isStreaming } = useStreamChat({
    onToken: (token) => {
      setStreamingMessage((prev) => prev + token);
    },
    onComplete: async (fullText, messageId) => {
      // Save assistant message to Convex
      const lastUserMessage = messages[messages.length - 1];
      await createAssistantMessage(
        fullText,
        lastUserMessage._id,
        fullText.split(" ").length
      );
      setStreamingMessage("");
    },
    onError: (error) => {
      console.error("Stream error:", error);
      setStreamingMessage("");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return;

    const parentMessage = messages[messages.length - 1];
    
    // Create user message in Convex
    const newUserMessage = await createUserMessage(
      inputValue,
      parentMessage?._id
    );
    
    setInputValue("");

    // Send to streaming API
    await sendMessage({
      chatId,
      parentMessageId: newUserMessage._id,
      userText: newUserMessage.content,
      messages: [...messages, newUserMessage],
      inclusionOverride: undefined,
      attachments: [],
    });
  };

  const handleBranch = (fromMessageId: string) => {
    setBranchFromId(fromMessageId);
    setBranchDialogOpen(true);
  };

  const handleCreateBranch = async () => {
    if (!branchInput.trim() || !branchFromId) return;

    // Create branch in Convex
    const branchMessage = await createBranch(branchFromId, branchInput);
    
    setBranchInput("");
    setBranchDialogOpen(false);
    setBranchFromId(null);

    // Send branched message to streaming API
    await sendMessage({
      chatId,
      parentMessageId: branchMessage._id,
      userText: branchMessage.content,
      messages: [...messages, branchMessage],
      inclusionOverride: undefined,
      attachments: [],
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
    if (!conceptTitle.trim() || !conceptSnippet.trim()) return;

    await createConcept(
      conceptTitle,
      conceptSnippet,
      selectedMessageForConcept?._id
    );

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

  // Build message tree for visualization
  const buildMessageTree = (messages: any[]): any[] => {
    const messageMap = new Map(messages.map(m => [m._id, { ...m, children: [] }]));
    const roots: any[] = [];

    messages.forEach(message => {
      const msg = messageMap.get(message._id)!;
      if (message.parentMessageId) {
        const parent = messageMap.get(message.parentMessageId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(msg);
        }
      } else {
        roots.push(msg);
      }
    });

    return roots;
  };

  const renderMessageTree = (messages: any[], depth: number = 0): JSX.Element[] => {
    return messages.flatMap(message => [
      <MessageItem
        key={message._id}
        message={message}
        isLatest={message._id === messages[messages.length - 1]?._id}
        onBranch={() => handleBranch(message._id)}
        onCopy={() => handleCopy(message.content)}
        onExtractConcept={() => handleExtractConcept(message)}
        depth={depth}
      />,
      ...(message.children ? renderMessageTree(message.children, depth + 1) : [])
    ]);
  };

  const messageTree = buildMessageTree(messages);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Chat</h2>
          {messages.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {messages.length} messages
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            chatId={chatId}
            messages={messages}
            currentMessageId={messages[messages.length - 1]?._id}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {renderMessageTree(messageTree)}
          
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
          >
            <Info className="mr-1 h-3 w-3" />
            Context ({messages.filter(m => m.role !== "note").length})
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
        <div className="flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="min-h-[60px] resize-none"
            disabled={isStreaming}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isStreaming}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Context Inspector */}
      <ContextInspector
        open={contextInspectorOpen}
        onClose={() => setContextInspectorOpen(false)}
        messages={messages}
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