"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { GitBranch, Plus, ChevronLeft, Settings, PanelLeftClose, PanelLeft } from "lucide-react";
import Link from "next/link";
import ConceptsList from "@/components/canvas/ConceptsList";
import ChatPanel from "@/components/chat/ChatPanel";
import CanvasView from "@/components/canvas/CanvasView";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";

function DiveWorkspaceContent() {
  const params = useParams();
  const diveId = params.diveId as string;
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidePanelOpen, setSidePanelOpen] = useState(true);

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

  // Mock dive data for now
  const mockDive = {
    _id: diveId,
    title: "Quantum Computing Research",
    description: "Exploring quantum entanglement and computing applications",
  };

  return (
    <WorkspaceProvider diveId={diveId}>
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
              <ConceptsList diveId={diveId} />
            </div>
          )}

          {/* Canvas and Chat area */}
          <div className="flex flex-1">
            {/* Canvas */}
            <div className="flex-1">
              <CanvasView diveId={diveId} />
            </div>

            {/* Chat Panel */}
            <ChatPanel diveId={diveId} />
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  );
}

export default function DiveWorkspacePage() {
  return <DiveWorkspaceContent />;
}