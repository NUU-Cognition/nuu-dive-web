"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { GitBranch, Plus, ChevronLeft, Settings, PanelLeftClose, PanelLeft } from "lucide-react";
import Link from "next/link";
import ConceptsList from "@/components/canvas/ConceptsList";
import ChatPanelV2 from "@/components/chat/ChatPanelV2";
import DocumentPanel from "@/components/document/DocumentPanel";
import CanvasView from "@/components/canvas/CanvasView";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";

function DiveWorkspaceContent() {
  const params = useParams();
  const diveId = params.diveId as string;
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const { selectedConceptId, selectedChatId, selectedDocumentId, setSelectedChat, setSelectedDocument } = useWorkspace();

  // Get dive details from Convex
  const dive = useQuery(
    api.dives.get,
    diveId && diveId !== "1" && diveId !== "2" 
      ? { diveId: diveId as Id<"dives"> } 
      : "skip"
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse">Loading workspace...</div>
      </div>
    );
  }

  // Handle case where dive doesn't exist or is a mock ID
  if (!dive && diveId !== "1" && diveId !== "2") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Dive not found</p>
          <Link href="/d">
            <Button variant="outline" className="mt-4">
              Back to Dives
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Use mock data for legacy IDs
  const displayDive = dive || {
    _id: diveId,
    title: diveId === "1" ? "Quantum Computing Research" : "Machine Learning Papers",
    description: diveId === "1" 
      ? "Exploring quantum entanglement and computing applications"
      : "Deep learning architectures and optimization techniques",
  };

  return (
    <div className="flex h-screen flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-4">
            <Link href="/d">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidePanelOpen(!sidePanelOpen)}
            >
              {sidePanelOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              <h1 className="text-lg font-semibold">{displayDive.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Concepts list */}
          {sidePanelOpen && (
            <div className="w-80 border-r bg-secondary/5">
              <ConceptsList diveId={diveId} />
            </div>
          )}

          {/* Canvas and Chat area */}
          <div className="flex flex-1">
            {/* Canvas */}
            <div className="flex-1">
              <CanvasView diveId={diveId} />
            </div>

            {/* Right Panel - Document or Chat */}
            {selectedDocumentId ? (
              <DocumentPanel
                documentId={selectedDocumentId}
                onClose={() => setSelectedDocument(null)}
              />
            ) : selectedChatId ? (
              <div className="w-[600px] border-l flex h-full">
                <ChatPanelV2
                  chatId={selectedChatId}
                  conceptId={selectedConceptId ?? null}
                  onClose={() => setSelectedChat(null)}
                />
              </div>
            ) : (
              <div className="w-[600px] border-l flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">Select a document or concept to start</p>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

export default function DiveWorkspacePage() {
  const params = useParams();
  const diveId = params.diveId as string;
  return (
    <WorkspaceProvider diveId={diveId}>
      <DiveWorkspaceContent />
    </WorkspaceProvider>
  );
}