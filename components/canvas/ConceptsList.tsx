"use client";

import { useState } from "react";
import { Plus, Search, FileText, Link2, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface ConceptsListProps {
  diveId: string;
}

export default function ConceptsList({}: ConceptsListProps) {
  const { 
    concepts, 
    addConcept, 
    selectedConceptId, 
    setSelectedConcept,
    setSelectedChat,
    setLeafForChat 
  } = useWorkspace();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newConceptTitle, setNewConceptTitle] = useState("");
  const [newConceptSnippet, setNewConceptSnippet] = useState("");
  const [newConceptUrl, setNewConceptUrl] = useState("");
  const [firstPrompt, setFirstPrompt] = useState("");

  const filteredConcepts = concepts.filter((concept) =>
    concept.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateConcept = async () => {
    if (!newConceptTitle.trim() || !newConceptSnippet.trim() || !firstPrompt.trim()) return;
    
    try {
      const { conceptId, chatId, firstUserMessageId } = await addConcept({
        title: newConceptTitle,
        snippet: newConceptSnippet,
        sourceType: newConceptUrl ? "url" : "chat",
        sourceUrl: newConceptUrl || undefined,
        firstPrompt,
      });
      
      setSelectedConcept(conceptId);
      setSelectedChat(chatId);
      
      // Set the leaf cursor to the newly created user message to trigger auto-streaming
      if (firstUserMessageId) {
        setLeafForChat(chatId, firstUserMessageId);
      }
      
      console.log("Created concept with first question:", { conceptId, chatId, firstUserMessageId });
      
      setNewConceptTitle("");
      setNewConceptSnippet("");
      setNewConceptUrl("");
      setFirstPrompt("");
      setCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create concept:", error);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Concepts</h2>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Concept & Ask</DialogTitle>
                <DialogDescription>
                  Capture a key idea and ask your first question about it
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    placeholder="e.g., Quantum Entanglement"
                    value={newConceptTitle}
                    onChange={(e) => setNewConceptTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Snippet *</label>
                  <Textarea
                    placeholder="The key text or idea you want to explore..."
                    value={newConceptSnippet}
                    onChange={(e) => setNewConceptSnippet(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Prompt *</label>
                  <Textarea
                    placeholder="Enter the first prompt you want to explore…"
                    value={firstPrompt}
                    onChange={(e) => setFirstPrompt(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will start a conversation about the concept
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Source URL (optional)</label>
                  <Input
                    placeholder="https://example.com/article"
                    value={newConceptUrl}
                    onChange={(e) => setNewConceptUrl(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateConcept}
                  disabled={!newConceptTitle.trim() || !newConceptSnippet.trim() || !firstPrompt.trim()}
                >
                  Create & Ask
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* Concepts list */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredConcepts.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchQuery ? "No concepts found" : "No concepts yet"}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConcepts.map((concept) => (
              <button
                key={concept._id}
                onClick={() => setSelectedConcept(concept._id)}
                className={`w-full rounded-lg p-3 text-left transition-colors hover:bg-accent ${
                  selectedConceptId === concept._id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {concept.sourceType === "url" ? (
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    ) : concept.sourceType === "pdf" ? (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Hash className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">
                      {concept.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {concept.snippet}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(concept.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}