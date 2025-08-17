"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, GitBranch, FileText, Clock, Search, Link2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
type PDFExtractionLevel = 'none' | 'basic' | 'full';

interface CapturedData {
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  timestamp: string;
}

export default function DivesListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDiveTitle, setNewDiveTitle] = useState("");
  const [newDiveDescription, setNewDiveDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  
  // Extension capture modal state
  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [capturedData, setCapturedData] = useState<CapturedData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // PDF context extraction options
  const [extractPdfContext, setExtractPdfContext] = useState<'none' | 'basic' | 'full'>('basic');
  const [extractionProgress, setExtractionProgress] = useState<string>('');

  // Get or create Convex user
  const getOrCreateUser = useMutation(api.users.getOrCreate);
  
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!session?.user?.email) return;
      try {
        const userId = await getOrCreateUser({
          email: session.user.email,
          name: session.user.name || session.user.email.split("@")[0],
          image: (session.user as any).image,
        });
        if (!canceled) {
          setCurrentUserId(userId as string);
        }
      } catch (e) {
        console.error("Failed to init Convex user:", e);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [session?.user?.email, session?.user?.name, getOrCreateUser]);

  // Get user's workspace (skip if no userId yet)
  const user = useQuery(
    api.users.get,
    currentUserId ? { userId: currentUserId as Id<"users"> } : "skip"
  );
  
  useEffect(() => {
    if (user?.workspaceId) {
      setCurrentWorkspaceId(user.workspaceId as string);
    }
  }, [user?.workspaceId]);

  // Get dives from Convex (skip if no userId yet)
  const convexDives = useQuery(
    api.dives.listByUser,
    currentUserId ? { userId: currentUserId as Id<"users"> } : "skip"
  ) || [];

  // Create dive mutation
  const createDive = useMutation(api.dives.create);
  const createConcept = useMutation(api.concepts.create);
  const addDocument = useMutation(api.documents.create);

  // Mock dives for when Convex isn't ready yet
  const mockDives = [
    {
      _id: "1",
      title: "Quantum Computing Research",
      description: "Exploring quantum entanglement and computing applications",
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000,
      conceptCount: 5,
    },
    {
      _id: "2",
      title: "Machine Learning Papers",
      description: "Deep learning architectures and optimization techniques",
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 7200000,
      conceptCount: 8,
    },
  ];

  // Use Convex dives if available, otherwise show mock dives
  const dives = convexDives.length > 0 ? convexDives : mockDives;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  // Check for extension capture parameters
  useEffect(() => {
    if (status === "authenticated") {
      const fromExtension = searchParams.get('fromExtension') === 'true';
      
      if (fromExtension) {
        const text = searchParams.get('text') || '';
        const sourceUrl = searchParams.get('sourceUrl') || '';
        const sourceTitle = searchParams.get('sourceTitle') || '';
        const timestamp = searchParams.get('timestamp') || new Date().toISOString();
        
        setCapturedData({
          text,
          sourceUrl,
          sourceTitle,
          timestamp,
        });

        // Pre-fill new dive form
        setNewDiveTitle(`Research: ${sourceTitle}`);
        setNewDiveDescription(`Exploring concept from ${sourceTitle}: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
        
        // Open capture modal
        setCaptureModalOpen(true);
        
        // Clean up URL parameters
        const url = new URL(window.location.href);
        url.searchParams.delete('fromExtension');
        url.searchParams.delete('text');
        url.searchParams.delete('sourceUrl');
        url.searchParams.delete('sourceTitle');
        url.searchParams.delete('timestamp');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [searchParams, status]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const handleCreateDive = async () => {
    if (!newDiveTitle.trim()) return;
    if (!currentUserId || !currentWorkspaceId) {
      console.error("User or workspace not initialized");
      return;
    }
    
    try {
      const diveId = await createDive({
        title: newDiveTitle.trim(),
        description: newDiveDescription.trim() || undefined,
        workspaceId: currentWorkspaceId as Id<"workspaces">,
        userId: currentUserId as Id<"users">,
      });
      
      setNewDiveTitle("");
      setNewDiveDescription("");
      setCreateDialogOpen(false);
      
      // Navigate to the new dive
      router.push(`/d/${diveId}`);
    } catch (error) {
      console.error("Failed to create dive:", error);
    }
  };

  const handleCreateNewDiveWithCapture = async () => {
    if (!capturedData || !currentUserId || !newDiveTitle.trim()) return;
    if (!currentWorkspaceId) {
      console.error("Workspace not initialized yet");
      alert("Workspace not ready. Please wait a moment and try again.");
      return;
    }
    
    setIsCreating(true);
    try {
      // Create new dive
      const diveId = await createDive({
        title: newDiveTitle,
        description: newDiveDescription || undefined,
        workspaceId: currentWorkspaceId as Id<"workspaces">,
        userId: currentUserId as Id<"users">,
      });

      // Create a document and optionally extract content
      let documentId: string | undefined;
      let extractedContent: string | undefined;
      const documentKind = capturedData.sourceUrl.includes('.pdf') ? 'pdf' : 'url';
      
      try {
        // Extract content based on document type
        // PDFs: Use user's extraction choice (none, basic, full)
        // URLs: Always extract automatically (website structure)
        const shouldExtract = documentKind === 'pdf' ? extractPdfContext !== 'none' : true;
        const extractionLevel = documentKind === 'pdf' ? extractPdfContext : 'basic'; // Use 'basic' for website structure
        
        if (shouldExtract) {
            setExtractionProgress('Starting content extraction...');
            console.log('Starting content extraction for:', capturedData.sourceUrl, 'level:', extractionLevel);
            
            try {
              console.log('🚀 [EXTRACTION] Starting content extraction...');
              console.log('🚀 [EXTRACTION] URL:', capturedData.sourceUrl);
              console.log('🚀 [EXTRACTION] Level:', extractionLevel);
              console.log('🚀 [EXTRACTION] Document Kind:', documentKind);
              
              const response = await fetch('/api/content/extract', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify({
                  url: capturedData.sourceUrl,
                  level: extractionLevel
                })
                // Removed timeout - let the server handle timeouts
              });
              
              console.log('🚀 [EXTRACTION] Response received, status:', response.status);
              
              if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [EXTRACTION] API error:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
              }
              
              const extractionResult = await response.json();
              console.log('✅ [EXTRACTION] Result received:');
              console.log('✅ [EXTRACTION] Success:', extractionResult.success);
              console.log('✅ [EXTRACTION] Content length:', extractionResult.content?.length || 0);
              console.log('✅ [EXTRACTION] Processing time:', extractionResult.metadata?.processingTime || 0, 'ms');
              console.log('✅ [EXTRACTION] Metadata:', extractionResult.metadata);
              if (extractionResult.content) {
                console.log('✅ [EXTRACTION] Content preview:', extractionResult.content.substring(0, 200) + '...');
              }
              
              if (extractionResult.success) {
                extractedContent = extractionResult.content;
                const metadata = extractionResult.metadata;
                console.log('✅ [EXTRACTION] Content extracted successfully!');
                console.log('✅ [EXTRACTION] Final content length:', extractedContent?.length || 0);
                
                if (metadata?.extractionSkipped) {
                  setExtractionProgress('Extraction skipped - using document reference');
                } else if (metadata?.extractionFailed) {
                  setExtractionProgress('Using fallback - document will be referenced');
                } else {
                  setExtractionProgress(`Extracted ${metadata?.extractedPages || metadata?.sectionsExtracted || 'content'} - ${metadata?.processingTime}ms`);
                }
              } else {
                console.error('❌ [EXTRACTION] Extraction failed:', extractionResult.error || 'Unknown error');
                console.error('❌ [EXTRACTION] Error metadata:', extractionResult.metadata);
                setExtractionProgress(`Extraction failed: ${extractionResult.error || 'Unknown error'}`);
              }
            } catch (error) {
              console.error('❌ [EXTRACTION] Unexpected error:', error);
              console.error('❌ [EXTRACTION] Error type:', error.name);
              console.error('❌ [EXTRACTION] Error message:', error.message);
              setExtractionProgress(`Extraction error: ${error.message}`);
              // Continue without extracted content
            }
          }

        // Create document with extracted content
        documentId = await addDocument({
          diveId: diveId,
          kind: documentKind,
          title: capturedData.sourceTitle,
          url: capturedData.sourceUrl,
          extractedContent: extractedContent, // Store the extracted content in the document
          extractionLevel: extractionLevel,
          userId: currentUserId as Id<"users">,
        }) as string;
          
      } catch (error) {
        console.error("Failed to create document:", error);
        setExtractionProgress('Failed to create document');
        // Continue without document if creation fails
      }

      // Create concept with captured data (no extracted content in snippet anymore - it's in the document)
      const conceptSnippet = capturedData.text;
        
      await createConcept({
        diveId: diveId as Id<"dives">,
        title: capturedData.sourceTitle,
        snippet: conceptSnippet,
        sourceType: documentKind as "pdf" | "url",
        sourceUrl: capturedData.sourceUrl,
        documentId: documentId,
        firstQuestion: `What is "${capturedData.text}"?`,
        userId: currentUserId as Id<"users">,
      });

      // Navigate to the new dive
      router.push(`/d/${diveId}`);
    } catch (error) {
      console.error("Failed to create dive:", error);
      alert("Failed to create dive. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddToExistingDive = async (diveId: string) => {
    if (!capturedData || !currentUserId) return;
    
    setIsCreating(true);
    try {
      // Create document and optionally extract content (same logic as new dive)
      let documentId: string | undefined;
      let extractedContent: string | undefined;
      const documentKind = capturedData.sourceUrl.includes('.pdf') ? 'pdf' : 'url';
      
      try {
        // Extract content if requested (works for both PDFs and HTML)
        if (extractPdfContext !== 'none') {
          setExtractionProgress('Starting content extraction...');
          console.log('Starting content extraction for existing dive:', capturedData.sourceUrl, 'level:', extractPdfContext);
          
          try {
            const controller = new AbortController();
            const clientTimeout = extractPdfContext === 'basic' ? 20000 : 35000;
            const timeoutId = setTimeout(() => {
              controller.abort();
              setExtractionProgress('Extraction timed out');
            }, clientTimeout);
            
            const response = await fetch('/api/content/extract', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                url: capturedData.sourceUrl,
                level: extractPdfContext
              }),
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const extractionResult = await response.json();
              if (extractionResult.success) {
                extractedContent = extractionResult.content;
                const metadata = extractionResult.metadata;
                setExtractionProgress(`Extracted ${metadata?.extractedPages || metadata?.sectionsExtracted || 'content'} - ${metadata?.processingTime}ms`);
              } else {
                console.warn('Content extraction failed:', extractionResult.error);
              }
            }
          } catch (error) {
            console.error('Content extraction failed:', error);
          }
        }

        // Create document with extracted content
        documentId = await addDocument({
          diveId: diveId as Id<"dives">,
          kind: documentKind,
          title: capturedData.sourceTitle,
          url: capturedData.sourceUrl,
          userId: currentUserId as Id<"users">,
        });
          
      } catch (error) {
        console.error("Failed to create document:", error);
        // Continue without document if creation fails
      }

      // Create concept with captured data (include extracted content in snippet if available)
      const conceptSnippet = extractedContent 
        ? `${capturedData.text}\n\n--- Extracted Content ---\n${extractedContent.substring(0, 1000)}...` 
        : capturedData.text;

      await createConcept({
        diveId: diveId as Id<"dives">,
        title: capturedData.sourceTitle,
        snippet: conceptSnippet,
        sourceType: documentKind as "pdf" | "url",
        sourceUrl: capturedData.sourceUrl,
        documentId: documentId,
        firstQuestion: `What is "${capturedData.text}"?`,
        userId: currentUserId as Id<"users">,
      });

      // Navigate to the dive
      router.push(`/d/${diveId}`);
    } catch (error) {
      console.error("Failed to add to dive:", error);
      alert("Failed to add to dive. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const filteredDives = dives.filter((dive) =>
    dive.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <GitBranch className="h-6 w-6" />
            <span className="text-xl font-bold">Dive</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {session?.user?.email}
            </span>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Dives</h1>
            <p className="mt-2 text-muted-foreground">
              Organize your research into focused workspaces
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                New Dive
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Dive</DialogTitle>
                <DialogDescription>
                  Start a new research workspace to explore concepts and ideas
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="title" className="text-sm font-medium">
                    Title
                  </label>
                  <Input
                    id="title"
                    placeholder="e.g., Quantum Computing Research"
                    value={newDiveTitle}
                    onChange={(e) => setNewDiveTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Description (optional)
                  </label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of your research focus..."
                    value={newDiveDescription}
                    onChange={(e) => setNewDiveDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateDive}>Create Dive</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search dives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredDives.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No dives yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first dive to start organizing your research
            </p>
            <Button
              className="mt-4 gap-2"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create Your First Dive
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDives.map((dive) => (
              <Link key={dive._id} href={`/d/${dive._id}`}>
                <div className="group cursor-pointer rounded-lg border p-6 transition-colors hover:bg-accent">
                  <h3 className="text-lg font-semibold">{dive.title}</h3>
                  {dive.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {dive.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span>{dive.conceptCount} concepts</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(dive.updatedAt, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Extension Capture Modal */}
        <Dialog open={captureModalOpen} onOpenChange={setCaptureModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge variant="secondary">From Extension</Badge>
                Captured Text Ready to Dive
              </DialogTitle>
              <DialogDescription>
                Choose how you'd like to explore this content
              </DialogDescription>
            </DialogHeader>

            {capturedData && (
              <div className="space-y-6">
                {/* Captured Content Display */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{capturedData.sourceTitle}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Link2 className="h-4 w-4" />
                          <a 
                            href={capturedData.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {capturedData.sourceUrl}
                          </a>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                      <p className="text-gray-800 italic">
                        "{capturedData.text}"
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Options */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Create New Dive */}
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-green-600" />
                        Create New Dive
                      </CardTitle>
                      <CardDescription>
                        Start a fresh research dive with this captured content
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Dive Title</label>
                        <Input
                          value={newDiveTitle}
                          onChange={(e) => setNewDiveTitle(e.target.value)}
                          placeholder="Enter dive title..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Description (Optional)</label>
                        <Textarea
                          value={newDiveDescription}
                          onChange={(e) => setNewDiveDescription(e.target.value)}
                          placeholder="Describe what you want to research..."
                          rows={2}
                        />
                      </div>
                      
                      {/* Content Extraction Options - Only show for PDFs */}
                      {capturedData?.sourceUrl.includes('.pdf') ? (
                        <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <label className="text-sm font-medium text-blue-900">
                            PDF Content Extraction
                          </label>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="extract-none"
                                name="pdfExtraction"
                                value="none"
                                checked={extractPdfContext === 'none'}
                                onChange={(e) => setExtractPdfContext(e.target.value as 'none')}
                                className="w-4 h-4 text-blue-600"
                              />
                              <label htmlFor="extract-none" className="text-sm text-gray-700">
                                No extraction - Just reference the source URL
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="extract-basic"
                                name="pdfExtraction"
                                value="basic"
                                checked={extractPdfContext === 'basic'}
                                onChange={(e) => setExtractPdfContext(e.target.value as 'basic')}
                                className="w-4 h-4 text-blue-600"
                              />
                              <label htmlFor="extract-basic" className="text-sm text-gray-700">
                                Basic - Extract key headings and structure (fast, ~5-10 seconds)
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="extract-full"
                                name="pdfExtraction"
                                value="full"
                                checked={extractPdfContext === 'full'}
                                onChange={(e) => setExtractPdfContext(e.target.value as 'full')}
                                className="w-4 h-4 text-blue-600"
                              />
                              <label htmlFor="extract-full" className="text-sm text-gray-700">
                                Full - Extract complete structured content (moderate, ~15-25 seconds)
                              </label>
                            </div>
                          </div>
                          {extractionProgress && (
                            <div className="text-xs text-blue-600 font-medium">
                              {extractionProgress}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* For non-PDF URLs, show automatic extraction notice */
                        <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <label className="text-sm font-medium text-green-900">
                              Automatic Website Structure Extraction
                            </label>
                          </div>
                          <p className="text-xs text-green-700">
                            We'll automatically extract the page structure, headings, and key sections to help with your research.
                          </p>
                        </div>
                      )}
                      
                      <Button 
                        onClick={handleCreateNewDiveWithCapture}
                        className="w-full"
                        disabled={isCreating || !newDiveTitle.trim() || !currentWorkspaceId}
                      >
                        {isCreating ? "Creating..." : !currentWorkspaceId ? "Loading..." : "Create New Dive"} <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Add to Existing Dive */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Add to Existing Dive
                      </CardTitle>
                      <CardDescription>
                        Add this content to one of your existing research dives
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filteredDives.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No existing dives found. Create your first dive above!
                          </p>
                        ) : (
                          filteredDives.map((dive) => (
                            <div
                              key={dive._id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm">{dive.title}</p>
                                {dive.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {dive.description}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddToExistingDive(dive._id)}
                                disabled={isCreating}
                              >
                                Add Here
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setCaptureModalOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function signOut() {
  // Import from next-auth/react
  import("next-auth/react").then(({ signOut }) => signOut({ callbackUrl: "/" }));
}