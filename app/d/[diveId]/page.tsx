"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GitBranch, Plus, ChevronLeft, Settings } from "lucide-react";
import Link from "next/link";
import ConceptsList from "@/components/canvas/ConceptsList";
import ChatPanel from "@/components/chat/ChatPanel";
import CanvasView from "@/components/canvas/CanvasView";

export default function DiveWorkspacePage() {
  const params = useParams();
  const diveId = params.diveId as string;
  const { data: session, status } = useSession();
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);

  if (status === "unauthenticated") {
    redirect("/auth/signin");
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  // Mock dive data for now
  const mockDive = {
    _id: diveId,
    title: "Quantum Computing Research",
    description: "Exploring quantum entanglement and computing applications",
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
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            <h1 className="text-lg font-semibold">{mockDive.title}</h1>
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
            <ConceptsList
              diveId={diveId}
              selectedConceptId={selectedConceptId}
              onSelectConcept={(conceptId, chatId) => {
                setSelectedConceptId(conceptId);
                setSelectedChatId(chatId);
              }}
            />
          </div>
        )}

        {/* Canvas area */}
        <div className="flex-1">
          <CanvasView
            diveId={diveId}
            selectedConceptId={selectedConceptId}
            onSelectConcept={(conceptId, chatId) => {
              setSelectedConceptId(conceptId);
              setSelectedChatId(chatId);
            }}
          />
        </div>

        {/* Right panel - Chat */}
        {selectedChatId && (
          <div className="w-[600px] border-l">
            <ChatPanel
              chatId={selectedChatId}
              conceptId={selectedConceptId}
              onClose={() => {
                setSelectedChatId(null);
                setSelectedConceptId(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}