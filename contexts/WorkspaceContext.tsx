"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type ConceptDoc = Doc<"concepts">;

interface Concept {
  _id: string;
  title: string;
  snippet: string;
  sourceType: "url" | "pdf" | "chat";
  sourceUrl?: string;
  createdAt: number;
  // kept for compatibility with existing components; not used functionally
  chatId?: string;
  diveId: string;
}

interface WorkspaceContextType {
  // Data
  concepts: Concept[];
  // Mutations
  addConcept: (args: {
    title: string;
    snippet: string;
    sourceType: "url" | "pdf" | "chat";
    sourceUrl?: string;
  }) => Promise<{ conceptId: string; chatId: string }>;
  updateConcept: (id: string, updates: Partial<Concept>) => void; // (no-op for now)

  // Selection
  selectedConceptId: string | null;
  selectedChatId: string | null;
  setSelectedConcept: (conceptId: string | null) => void;
  setSelectedChat: (chatId: string | null) => void;

  // Useful context
  diveId: string;
  currentUserId: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceProvider({
  children,
  diveId,
}: {
  children: ReactNode;
  diveId: string;
}) {
  const { data: session } = useSession();

  // Ensure Convex user exists (and default workspace gets created)
  const getOrCreateUser = useMutation(api.users.getOrCreate);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
        if (!canceled) setCurrentUserId(userId as string);
      } catch (e) {
        console.error("Failed to init Convex user:", e);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [session?.user?.email, session?.user?.name, getOrCreateUser]);

  // Concepts for this dive (skip for mock dive IDs)
  const isMockDiveId = diveId === "1" || diveId === "2";
  const convexConcepts =
    useQuery(
      api.concepts.listByDive,
      !isMockDiveId && diveId ? ({ diveId: diveId as Id<"dives"> }) : "skip"
    ) || [];

  // Map Convex docs to the interface used by components
  const concepts: Concept[] = useMemo(
    () =>
      convexConcepts.map((c: ConceptDoc) => ({
        _id: c._id as string,
        title: c.title,
        snippet: c.snippet,
        sourceType: c.sourceType as Concept["sourceType"],
        sourceUrl: c.sourceUrl ?? undefined,
        createdAt: c.createdAt,
        diveId: c.diveId as unknown as string,
        chatId: undefined, // resolved on demand via concepts.get
      })),
    [convexConcepts]
  );

  // Selection
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(
    null
  );
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // When the selected concept changes, resolve its chat from Convex
  const selectedConceptDetail = useQuery(
    api.concepts.get,
    selectedConceptId
      ? ({ conceptId: selectedConceptId as unknown as Id<"concepts"> })
      : "skip"
  );
  useEffect(() => {
    const chatId = (selectedConceptDetail as any)?.chat?._id as string | undefined;
    if (chatId) setSelectedChatId(chatId);
  }, [(selectedConceptDetail as any)?.chat?._id]);

  // Default selection: first concept
  useEffect(() => {
    if (!selectedConceptId && concepts.length > 0) {
      setSelectedConceptId(concepts[0]._id);
    }
  }, [concepts, selectedConceptId]);

  // Mutations
  const createConcept = useMutation(api.concepts.create);

  const addConcept = useCallback(
    async ({
      title,
      snippet,
      sourceType,
      sourceUrl,
    }: {
      title: string;
      snippet: string;
      sourceType: "url" | "pdf" | "chat";
      sourceUrl?: string;
    }) => {
      if (!currentUserId) throw new Error("User not initialized yet");
      
      // Don't allow creating concepts in mock dives
      if (diveId === "1" || diveId === "2") {
        throw new Error("Cannot create concepts in demo dives. Please create a new dive first.");
      }
      
      const res = await createConcept({
        diveId: diveId as unknown as Id<"dives">,
        title,
        snippet,
        sourceType,
        sourceUrl,
        userId: currentUserId as unknown as Id<"users">,
      });
      const conceptId = (res as any).conceptId as string;
      const chatId = (res as any).chatId as string;
      setSelectedConceptId(conceptId);
      setSelectedChatId(chatId);
      return { conceptId, chatId };
    },
    [createConcept, currentUserId, diveId]
  );

  // Not used now (kept to avoid refactors)
  const updateConcept = useCallback((_id: string, _updates: Partial<Concept>) => {
    // You can wire to convex.dives.update or a concepts.update in future
  }, []);

  const setSelectedConcept = useCallback((conceptId: string | null) => {
    setSelectedConceptId(conceptId);
  }, []);

  const setSelectedChat = useCallback((chatId: string | null) => {
    setSelectedChatId(chatId);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        concepts,
        addConcept,
        updateConcept,
        selectedConceptId,
        selectedChatId,
        setSelectedConcept,
        setSelectedChat,
        diveId,
        currentUserId,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}