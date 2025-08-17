"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, ArrowRight, Link2, Clock } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CapturedData {
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  timestamp: string;
}

export default function CapturePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [capturedData, setCapturedData] = useState<CapturedData | null>(null);
  const [showNewDiveDialog, setShowNewDiveDialog] = useState(false);
  const [newDiveTitle, setNewDiveTitle] = useState("");
  const [newDiveDescription, setNewDiveDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Get user's dives
  const dives = useQuery(api.dives.list, status === "authenticated" ? {} : "skip") || [];
  
  // Mutations
  const createDive = useMutation(api.dives.create);
  const createConcept = useMutation(api.concepts.create);
  const getOrCreateUser = useMutation(api.users.getOrCreate);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
      return;
    }

    // Parse extension parameters
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
    }
  }, [searchParams, status, router]);

  const handleCreateNewDive = async () => {
    if (!capturedData || !session?.user?.email || !newDiveTitle.trim()) return;
    
    setIsCreating(true);
    try {
      // Ensure user exists
      const userId = await getOrCreateUser({
        email: session.user.email,
        name: session.user.name || session.user.email.split("@")[0],
        image: (session.user as any).image,
      });

      // Create new dive
      const diveId = await createDive({
        title: newDiveTitle,
        description: newDiveDescription || undefined,
        userId: userId as Id<"users">,
      });

      // Create concept with captured data
      const conceptResult = await createConcept({
        diveId: diveId as Id<"dives">,
        title: capturedData.sourceTitle,
        snippet: capturedData.text,
        sourceType: "url",
        sourceUrl: capturedData.sourceUrl,
        firstQuestion: `What is "${capturedData.text}"?`,
        userId: userId as Id<"users">,
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
    if (!capturedData || !session?.user?.email) return;
    
    setIsCreating(true);
    try {
      // Ensure user exists
      const userId = await getOrCreateUser({
        email: session.user.email,
        name: session.user.name || session.user.email.split("@")[0],
        image: (session.user as any).image,
      });

      // Create concept in existing dive
      const conceptResult = await createConcept({
        diveId: diveId as Id<"dives">,
        title: capturedData.sourceTitle,
        snippet: capturedData.text,
        sourceType: "url",
        sourceUrl: capturedData.sourceUrl,
        firstQuestion: `What is "${capturedData.text}"?`,
        userId: userId as Id<"users">,
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

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!capturedData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No captured data found</p>
          <Link href="/d">
            <Button variant="outline" className="mt-4">
              Go to Dives
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary">From Extension</Badge>
            <span className="text-sm text-muted-foreground">
              <Clock className="h-4 w-4 inline mr-1" />
              {new Date(capturedData.timestamp).toLocaleString()}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Captured Text Ready to Dive
          </h1>
          <p className="text-gray-600">
            Choose how you'd like to explore this content
          </p>
        </div>

        {/* Captured Content */}
        <Card className="mb-8">
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
            <CardContent>
              <Button 
                onClick={() => setShowNewDiveDialog(true)}
                className="w-full"
                disabled={isCreating}
              >
                Create New Dive <ArrowRight className="h-4 w-4 ml-2" />
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
                {dives.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No existing dives found. Create your first dive above!
                  </p>
                ) : (
                  dives.map((dive) => (
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

        {/* New Dive Dialog */}
        <Dialog open={showNewDiveDialog} onOpenChange={setShowNewDiveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Dive</DialogTitle>
              <DialogDescription>
                Set up your new research dive with the captured content
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Dive Title</Label>
                <Input
                  id="title"
                  value={newDiveTitle}
                  onChange={(e) => setNewDiveTitle(e.target.value)}
                  placeholder="Enter dive title..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={newDiveDescription}
                  onChange={(e) => setNewDiveDescription(e.target.value)}
                  placeholder="Describe what you want to research..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowNewDiveDialog(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateNewDive}
                disabled={!newDiveTitle.trim() || isCreating}
              >
                {isCreating ? "Creating..." : "Create Dive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}