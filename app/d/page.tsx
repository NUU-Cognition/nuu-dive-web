"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Plus,
  GitBranch,
  FileText,
  Clock,
  Search as SearchIcon,
  Star,
  StarOff,
  MoreVertical,
  LayoutGrid,
  List as ListIcon,
  SortAsc,
  Pencil,
} from "lucide-react";

import { useLocalStorage } from "@/hooks/useLocalStorage";

type SortBy = "recent" | "alpha" | "concepts";
type ViewMode = "grid" | "list";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const re = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded px-0.5 bg-yellow-200 dark:bg-yellow-600/40"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function DivesListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Creation dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDiveTitle, setNewDiveTitle] = useState("");
  const [newDiveDescription, setNewDiveDescription] = useState("");

  // Rename dialog state
  const [renameOpen, setRenameOpen] = useState(false);
  const [editingDive, setEditingDive] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Search, sort, view, pinned
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useLocalStorage<SortBy>("d.sort", "recent");
  const [view, setView] = useLocalStorage<ViewMode>("d.view", "grid");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [pinnedIds, setPinnedIds] = useLocalStorage<string[]>("d.pins", []);
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const togglePin = (id: string) =>
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts: "/" to focus search, "n" for new dive
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const inField = tag === "input" || tag === "textarea";
      if (!inField && e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (!inField && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCreateDialogOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Current user & workspace wiring (Convex)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    null
  );
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

  const user = useQuery(
    api.users.get,
    currentUserId ? { userId: currentUserId as Id<"users"> } : "skip"
  );
  useEffect(() => {
    if (user?.workspaceId) {
      setCurrentWorkspaceId(user.workspaceId as string);
    }
  }, [user?.workspaceId]);

  const convexDives = useQuery(
    api.dives.listByUser,
    currentUserId ? { userId: currentUserId as Id<"users"> } : "skip"
  );
  const divesLoading = currentUserId ? convexDives === undefined : true;
  const dives = convexDives ?? [];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  const createDive = useMutation(api.dives.create);
  const updateDive = useMutation(api.dives.update);

  const handleCreateDive = async () => {
    if (!newDiveTitle.trim() || !currentUserId || !currentWorkspaceId) return;
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
      router.push(`/d/${diveId}`);
    } catch (error) {
      console.error("Failed to create dive:", error);
    }
  };

  const openRename = (dive: any) => {
    setEditingDive(dive);
    setEditTitle(dive.title);
    setEditDescription(dive.description || "");
    setRenameOpen(true);
  };

  const handleRename = async () => {
    if (!editingDive) return;
    try {
      await updateDive({
        diveId: editingDive._id as Id<"dives">,
        title: editTitle,
        description: editDescription || undefined,
      });
      setRenameOpen(false);
      setEditingDive(null);
    } catch (e) {
      console.error("Failed to rename dive:", e);
    }
  };

  // Filtering + sorting
  const normalized = searchQuery.trim().toLowerCase();
  const filteredDives = useMemo(() => {
    let list = dives as Array<{
      _id: string;
      title: string;
      description?: string;
      updatedAt: number;
      conceptCount?: number;
    }>;

    if (normalized) {
      list = list.filter((d) => {
        const t = d.title?.toLowerCase() || "";
        const desc = (d.description || "").toLowerCase();
        return t.includes(normalized) || desc.includes(normalized);
      });
    }

    if (showPinnedOnly) {
      list = list.filter((d) => pinnedSet.has(d._id));
    }

    // Sort
    const sorted = [...list].sort((a, b) => {
      if (sortBy === "alpha") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "concepts") {
        const ac = a.conceptCount ?? 0;
        const bc = b.conceptCount ?? 0;
        return bc - ac;
      }
      // recent
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    return sorted;
  }, [dives, normalized, sortBy, showPinnedOnly, pinnedSet]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Signing you in…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <GitBranch className="h-6 w-6" />
            <span className="text-xl font-bold">Dive</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="hidden sm:block text-sm text-muted-foreground">
              {session?.user?.email}
            </span>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page header + actions */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Dives</h1>
            <p className="mt-2 text-muted-foreground">
              Organize your research into focused workspaces
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative sm:w-[320px]">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder='Search (press "/")…'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search dives"
              />
            </div>

            {/* Pinned filter */}
            <Button
              variant={showPinnedOnly ? "secondary" : "outline"}
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
              className="sm:ml-2"
              aria-pressed={showPinnedOnly}
              aria-label="Toggle pinned only"
            >
              <Star className={`h-4 w-4 ${showPinnedOnly ? 'fill-current' : ''}`} />
              {showPinnedOnly ? "Pinned" : "All"}
            </Button>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="sm:ml-2">
                  <SortAsc className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortBy("recent")}>
                  Recently updated
                  {sortBy === "recent" && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("alpha")}>
                  A → Z
                  {sortBy === "alpha" && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("concepts")}>
                  Concept count
                  {sortBy === "concepts" && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View */}
            <div className="flex rounded-md border overflow-hidden sm:ml-2" role="tablist" aria-label="View mode">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none"
                onClick={() => setView("grid")}
                role="tab"
                aria-selected={view === "grid"}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none"
                onClick={() => setView("list")}
                role="tab"
                aria-selected={view === "list"}
              >
                <ListIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Create */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="sm:ml-2">
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
                    <label
                      htmlFor="description"
                      className="text-sm font-medium"
                    >
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
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateDive} disabled={!newDiveTitle.trim()}>
                    Create Dive
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Content */}
        {divesLoading ? (
          <div
            className={
              view === "list"
                ? "space-y-2"
                : "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            }
          >
            {Array.from({ length: view === "list" ? 6 : 6 }).map((_, i) =>
              view === "list" ? (
                <div
                  key={i}
                  className="rounded-lg border p-4 flex items-center gap-4"
                >
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : (
                <div key={i} className="rounded-lg border p-6 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              )
            )}
          </div>
        ) : filteredDives.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No matching dives</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {dives.length === 0
                ? "Create your first dive to start organizing your research."
                : "Try a different search, clear filters, or create a new dive."}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create a Dive
              </Button>
              {searchQuery && (
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Tip: press <kbd className="px-1 py-0.5 border rounded">/</kbd> to
              focus search, <kbd className="px-1 py-0.5 border rounded">n</kbd>{" "}
              to create.
            </p>
          </div>
        ) : view === "list" ? (
          <div className="space-y-2">
            {filteredDives.map((dive) => (
              <div
                key={dive._id}
                className="group flex items-center gap-4 rounded-lg border p-4 hover:bg-accent/40 transition-colors"
              >
                {/* Pin */}
                <button
                  onClick={() => togglePin(dive._id)}
                  className="p-2 -ml-2 rounded hover:bg-accent"
                  aria-label={pinnedSet.has(dive._id) ? "Unpin" : "Pin"}
                  title={pinnedSet.has(dive._id) ? "Unpin" : "Pin"}
                >
                  <Star className={`h-4 w-4 ${pinnedSet.has(dive._id) ? 'fill-current' : ''}`} />
                </button>

                {/* Title / Desc */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/d/${dive._id}`}
                    className="block font-medium hover:underline truncate"
                  >
                    {highlight(dive.title, searchQuery)}
                  </Link>
                  {dive.description && (
                    <div className="text-sm text-muted-foreground line-clamp-1">
                      {highlight(dive.description, searchQuery)}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>{dive.conceptCount ?? 0} concepts</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(dive.updatedAt, { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="opacity-60 group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/d/${dive._id}`}>Open</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openRename(dive)}>
                      <Pencil className="mr-2 h-3 w-3" />
                      Rename
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDives.map((dive) => (
              <div
                key={dive._id}
                className="group relative rounded-lg border p-6 transition-colors hover:bg-accent"
              >
                {/* Pin (top-right) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(dive._id);
                  }}
                  className="absolute right-2 top-2 rounded p-2 hover:bg-background/60"
                  aria-label={pinnedSet.has(dive._id) ? "Unpin" : "Pin"}
                  title={pinnedSet.has(dive._id) ? "Unpin" : "Pin"}
                >
                  <Star className={`h-4 w-4 ${pinnedSet.has(dive._id) ? 'fill-current' : ''}`} />
                </button>

                <Link href={`/d/${dive._id}`} className="block">
                  <h3 className="text-lg font-semibold truncate">
                    {highlight(dive.title, searchQuery)}
                  </h3>
                  {dive.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {highlight(dive.description, searchQuery)}
                    </p>
                  )}
                </Link>

                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {dive.conceptCount ?? 0} concepts
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(dive.updatedAt, { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/d/${dive._id}`}>Open</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRename(dive);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                      Rename
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Dive</DialogTitle>
            <DialogDescription>Update title and description</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!editTitle.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function signOut() {
  import("next-auth/react").then(({ signOut }) =>
    signOut({ callbackUrl: "/" })
  );
}