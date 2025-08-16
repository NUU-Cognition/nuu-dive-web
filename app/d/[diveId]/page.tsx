"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { GitBranch, ChevronLeft, Settings, PanelLeftClose, PanelLeft, Link2, FileText } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConceptsList from "@/components/canvas/ConceptsList";
import ChatPanelV2 from "@/components/chat/ChatPanelV2";
import DocumentPanel from "@/components/document/DocumentPanel";
import CanvasView from "@/components/canvas/CanvasView";
import RightDock from "@/components/layout/RightDock";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";

function DiveWorkspaceContent() {
  const params = useParams();
  const diveId = params["diveId"] as string;
  const { status } = useSession();
  const router = useRouter();
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [newDocumentUrl, setNewDocumentUrl] = useState("");
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const { selectedConceptId, selectedChatId, selectedDocumentId, setSelectedChat, setSelectedDocument, addDocument } = useWorkspace();
  
  // Convex mutations
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  // Get dive details from Convex
  const dive = useQuery(
    api.dives.get,
    diveId ? { diveId: diveId as Id<"dives"> } : "skip"
  );
  const diveLoading = dive === undefined;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center text-sm text-muted-foreground">Loading workspace…</div>
      </div>
    );
  }

  // Handle case where dive doesn't exist
  if (dive === null) {
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
  // At this point dive is either loading (undefined) or an object

  const handleAddUrl = async () => {
    if (!newDocumentUrl.trim() || !newDocumentTitle.trim()) return;
    
    try {
      const documentId = await addDocument({
        kind: "url",
        title: newDocumentTitle,
        url: newDocumentUrl,
      });
      
      setSelectedDocument(documentId);
      setUrlDialogOpen(false);
      setNewDocumentUrl("");
      setNewDocumentTitle("");
    } catch (error) {
      console.error("Failed to add URL document:", error);
    }
  };

  const handleAddPdf = async () => {
    if (!pdfFile || !newDocumentTitle.trim()) return;
    
    setIsUploadingPdf(true);
    
    try {
      // Step 1: Get an upload URL from Convex
      const uploadUrl = await generateUploadUrl();
      
      // Step 2: Upload the file to the URL
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": pdfFile.type },
        body: pdfFile,
      });
      
      if (!result.ok) {
        throw new Error("Failed to upload PDF");
      }
      
      const { storageId } = await result.json();
      
      // Step 3: Create the document with the storage ID
      const documentId = await addDocument({
        kind: "pdf",
        title: newDocumentTitle,
        pdfId: storageId,
        pdfMeta: {
          fileName: pdfFile.name,
        },
      });
      
      setSelectedDocument(documentId);
      setPdfDialogOpen(false);
      setPdfFile(null);
      setNewDocumentTitle("");
    } catch (error) {
      console.error("Failed to add PDF document:", error);
      alert("Failed to upload PDF. Please try again.");
    } finally {
      setIsUploadingPdf(false);
    }
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
              <h1 className="text-lg font-semibold">{diveLoading ? "…" : dive?.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Add URL Dialog */}
            <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Link2 className="h-4 w-4 mr-1" />
                  Add URL
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add URL Document</DialogTitle>
                  <DialogDescription>
                    Add a web page or online document to your dive
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      placeholder="https://example.com/article"
                      value={newDocumentUrl}
                      onChange={(e) => setNewDocumentUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Document title"
                      value={newDocumentTitle}
                      onChange={(e) => setNewDocumentTitle(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddUrl}
                    disabled={!newDocumentUrl.trim() || !newDocumentTitle.trim()}
                  >
                    Add Document
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add PDF Dialog */}
            <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-1" />
                  Add PDF
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add PDF Document</DialogTitle>
                  <DialogDescription>
                    Upload a PDF document to your dive
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="pdf">PDF File</Label>
                    <Input
                      id="pdf"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pdf-title">Title</Label>
                    <Input
                      id="pdf-title"
                      placeholder="Document title"
                      value={newDocumentTitle}
                      onChange={(e) => setNewDocumentTitle(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPdfDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddPdf}
                    disabled={!pdfFile || !newDocumentTitle.trim() || isUploadingPdf}
                  >
                    {isUploadingPdf ? "Uploading..." : "Add PDF"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
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

          {/* Center main panel */}
          <div className="flex-1 min-w-0">
            {selectedDocumentId ? (
              <DocumentPanel
                layout="main"
                documentId={selectedDocumentId}
                onClose={() => setSelectedDocument(null)}
              />
            ) : (
              <CanvasView diveId={diveId} />
            )}
          </div>

          {/* Right dock = Chat (resizable & collapsible) */}
          <RightDock storageKey="dock.chat" label="Chat">
            {selectedChatId ? (
              <ChatPanelV2
                chatId={selectedChatId}
                conceptId={selectedConceptId ?? null}
                onClose={() => setSelectedChat(null)}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                Select a concept or ask about an open document…
              </div>
            )}
          </RightDock>
        </div>
    </div>
  );
}

export default function DiveWorkspacePage() {
  const params = useParams();
  const diveId = params["diveId"] as string;
  return (
    <WorkspaceProvider diveId={diveId}>
      <DiveWorkspaceContent />
    </WorkspaceProvider>
  );
}