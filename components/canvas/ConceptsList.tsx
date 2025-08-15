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

interface ConceptsListProps {
  diveId: string;
  selectedConceptId: string | null;
  onSelectConcept: (conceptId: string, chatId: string) => void;
}

export default function ConceptsList({
  diveId,
  selectedConceptId,
  onSelectConcept,
}: ConceptsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newConceptTitle, setNewConceptTitle] = useState("");
  const [newConceptSnippet, setNewConceptSnippet] = useState("");
  const [newConceptUrl, setNewConceptUrl] = useState("");

  // Mock concepts data
  const mockConcepts = [
    {
      _id: "c1",
      title: "Quantum Entanglement",
      snippet: "When two particles become entangled, the quantum state of each particle cannot be described independently...",
      sourceType: "url" as const,
      sourceUrl: "https://example.com/quantum",
      createdAt: Date.now() - 3600000,
      chatId: "chat1",
    },
    {
      _id: "c2",
      title: "Superposition Principle",
      snippet: "A quantum system can exist in multiple states simultaneously until it is measured...",
      sourceType: "pdf" as const,
      sourceUrl: "paper.pdf",
      createdAt: Date.now() - 7200000,
      chatId: "chat2",
    },
  ];

  const filteredConcepts = mockConcepts.filter((concept) =>
    concept.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateConcept = () => {
    if (!newConceptTitle.trim() || !newConceptSnippet.trim()) return;
    
    // TODO: Implement actual concept creation
    console.log("Creating concept:", {
      title: newConceptTitle,
      snippet: newConceptSnippet,
      url: newConceptUrl,
    });
    
    setNewConceptTitle("");
    setNewConceptSnippet("");
    setNewConceptUrl("");
    setCreateDialogOpen(false);
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
                <DialogTitle>Create Concept</DialogTitle>
                <DialogDescription>
                  Capture a key idea or highlight from a source
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="e.g., Quantum Entanglement"
                    value={newConceptTitle}
                    onChange={(e) => setNewConceptTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Snippet</label>
                  <Textarea
                    placeholder="The key text or idea you want to explore..."
                    value={newConceptSnippet}
                    onChange={(e) => setNewConceptSnippet(e.target.value)}
                    rows={4}
                  />
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
                <Button onClick={handleCreateConcept}>Create</Button>
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
                onClick={() => onSelectConcept(concept._id, concept.chatId)}
                className={`w-full rounded-lg p-3 text-left transition-colors hover:bg-accent ${
                  selectedConceptId === concept._id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {concept.sourceType === "url" ? (
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
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