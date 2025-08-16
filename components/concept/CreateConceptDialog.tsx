"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface CreateConceptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle?: string;
  initialSnippet?: string;
  initialFirstPrompt?: string;
  sourceType: "url" | "pdf" | "chat";
  sourceUrl?: string;
  documentId?: string;
  sourceMessageId?: string;
  pdfId?: string;
  pdfMeta?: {
    fileName: string;
    page?: number;
    rect?: { x: number; y: number; w: number; h: number };
  };
  contextInfo?: string; // Additional info to display (e.g., "From page 3 of document.pdf")
  onSuccess?: (result: { conceptId: string }) => void;
}

export default function CreateConceptDialog({
  open,
  onOpenChange,
  initialTitle = "",
  initialSnippet = "",
  initialFirstPrompt = "What's the key idea here?",
  sourceType,
  sourceUrl,
  documentId,
  sourceMessageId,
  pdfId,
  pdfMeta,
  contextInfo,
  onSuccess,
}: CreateConceptDialogProps) {
  const { addConcept, setSelectedConcept, setSelectedChat, setLeafForChat } = useWorkspace();
  const [conceptTitle, setConceptTitle] = useState(initialTitle);
  const [conceptSnippet, setConceptSnippet] = useState(initialSnippet);
  const [firstPrompt, setFirstPrompt] = useState(initialFirstPrompt);
  const [isCreating, setIsCreating] = useState(false);

  // Reset form when dialog opens/closes or initial values change
  useEffect(() => {
    if (open) {
      setConceptTitle(initialTitle);
      setConceptSnippet(initialSnippet);
      setFirstPrompt(initialFirstPrompt);
    }
  }, [open, initialTitle, initialSnippet, initialFirstPrompt]);

  const handleCreateConcept = async () => {
    if (!conceptSnippet.trim()) return;
    
    setIsCreating(true);
    
    try {
      const result = await addConcept({
        title: conceptTitle.trim() || "Untitled Concept",
        snippet: conceptSnippet.trim(),
        sourceType,
        sourceUrl,
        documentId,
        sourceMessageId,
        firstPrompt: firstPrompt.trim(),
        pdfId,
        pdfMeta,
      });
      
      // Select the new concept and its chat to trigger auto-streaming
      setSelectedConcept(result.conceptId);
      setSelectedChat(result.chatId);
      
      // Set the leaf cursor to the newly created user message to trigger auto-streaming
      if (result.firstUserMessageId) {
        setLeafForChat(result.chatId, result.firstUserMessageId);
      }
      
      // Success callback
      onSuccess?.(result);
      
      // Clean up dialog state
      onOpenChange(false);
      setConceptTitle("");
      setConceptSnippet("");
      setFirstPrompt("What's the key idea here?");
    } catch (error) {
      console.error("Failed to create concept:", error);
      // Could add error handling UI here
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setConceptTitle("");
    setConceptSnippet("");
    setFirstPrompt("What's the key idea here?");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Concept</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={conceptTitle}
              onChange={(e) => setConceptTitle(e.target.value)}
              placeholder="e.g., Key insight about X"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Snippet</label>
            <Textarea
              rows={5}
              value={conceptSnippet}
              onChange={(e) => setConceptSnippet(e.target.value)}
              placeholder="The main content or selection..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">First prompt</label>
            <Textarea
              rows={2}
              value={firstPrompt}
              onChange={(e) => setFirstPrompt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Starts a chat anchored to this concept.
            </p>
          </div>
          {contextInfo && (
            <div className="text-xs text-muted-foreground">
              {contextInfo}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateConcept} 
            disabled={!conceptSnippet.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create Concept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}