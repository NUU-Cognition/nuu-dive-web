"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { Plus, GitBranch, FileText, Clock, Search } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

export default function DivesListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDiveTitle, setNewDiveTitle] = useState("");
  const [newDiveDescription, setNewDiveDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Local state for dives - will be replaced with real Convex queries later
  const [dives, setDives] = useState([
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
  ]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const handleCreateDive = async () => {
    if (!newDiveTitle.trim()) return;
    
    const now = Date.now();
    const newDive = {
      _id: String(now),
      title: newDiveTitle.trim(),
      description: newDiveDescription.trim(),
      createdAt: now,
      updatedAt: now,
      conceptCount: 0,
    };
    setDives((prev) => [newDive, ...prev]);
    
    setNewDiveTitle("");
    setNewDiveDescription("");
    setCreateDialogOpen(false);
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
      </main>
    </div>
  );
}

function signOut() {
  // Import from next-auth/react
  import("next-auth/react").then(({ signOut }) => signOut({ callbackUrl: "/" }));
}