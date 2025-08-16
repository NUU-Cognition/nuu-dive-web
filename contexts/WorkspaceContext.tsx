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
type DocumentDoc = Doc<"documents">;

interface Concept {
  _id: string;
  title: string;
  snippet: string;
  sourceType: "url" | "pdf" | "chat";
  sourceUrl?: string;
  documentId?: string;
  sourceMessageId?: string;
  createdAt: number;
  // kept for compatibility with existing components; not used functionally
  chatId?: string;
  diveId: string;
}

interface Document {
  _id: string;
  title: string;
  kind: "url" | "pdf";
  url?: string;
  responseCount?: number;
  conceptCount?: number;
  createdAt: number;
  diveId: string;
}

interface WorkspaceContextType {
  // Data
  concepts: Concept[];
  documents: Document[];
  documentsLoading: boolean;
  conceptsLoading: boolean;
  // Leaf cursor management
  getLeafForChat: (chatId: string) => string | undefined;
  setLeafForChat: (chatId: string, messageId: string | null) => void;
  // Pending (ephemeral) response loading per chat
  pendingByChat: Record<string, { id: string; parentMessageId?: string } | undefined>;
  getPendingForChat: (chatId: string) => { id: string; parentMessageId?: string } | undefined;
  setPendingForChat: (chatId: string, pending: { id: string; parentMessageId?: string } | null) => void;
  // Mutations
  addConcept: (args: {
    title: string;
    snippet: string;
    sourceType: "url" | "pdf" | "chat";
    sourceUrl?: string;
    documentId?: string;
    sourceMessageId?: string; // provenance when created from a response
    firstPrompt: string;      // UI-facing; will be sent as firstQuestion for compat
    pdfId?: string;
    pdfMeta?: { fileName: string; page?: number; rect?: { x: number; y: number; w: number; h: number } };
  }) => Promise<{ conceptId: string; chatId: string; firstUserMessageId: string }>;
  addDocument: (args: {
    kind: "url" | "pdf";
    title: string;
    url?: string;
    pdfId?: string;
    pdfMeta?: {
      fileName: string;
      pageCount?: number;
    };
  }) => Promise<string>;
  updateConcept: (id: string, updates: Partial<Concept>) => void; // (no-op for now)

  // Selection
  selectedConceptId: string | null;
  selectedChatId: string | null;
  selectedDocumentId: string | null;
  setSelectedConcept: (conceptId: string | null) => void;
  setSelectedChat: (chatId: string | null) => void;
  setSelectedDocument: (documentId: string | null) => void;

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

  // Documents and Concepts for this dive
  const convexDocuments =
    useQuery(
      api.documents.listByDive,
      diveId ? ({ diveId: diveId as Id<"dives"> }) : "skip"
    );
  const convexConcepts =
    useQuery(
      api.concepts.listByDive,
      diveId ? ({ diveId: diveId as Id<"dives"> }) : "skip"
    );

  const documentsLoading = convexDocuments === undefined;
  const conceptsLoading = convexConcepts === undefined;

  // Map Convex docs to the interface used by components
  const documents: Document[] = useMemo(
    () =>
      (convexDocuments ?? []).map((d: DocumentDoc & { responseCount?: number; conceptCount?: number }) => ({
        _id: d._id as string,
        title: d.title,
        kind: d.kind as Document["kind"],
        url: d.url ?? undefined,
        responseCount: d.responseCount ?? 0,
        conceptCount: d.conceptCount ?? 0,
        createdAt: d.createdAt,
        diveId: d.diveId as unknown as string,
      })),
    [convexDocuments]
  );
  
  const concepts: Concept[] = useMemo(
    () =>
      (convexConcepts ?? []).map((c: ConceptDoc) => ({
        _id: c._id as string,
        title: c.title,
        snippet: c.snippet,
        sourceType: c.sourceType as Concept["sourceType"],
        sourceUrl: c.sourceUrl ?? undefined,
        documentId: (c as any).documentId ?? undefined,
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
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  
  // Leaf cursor state - tracks current leaf message per chat
  const [leafByChat, setLeafByChat] = useState<Record<string, string | undefined>>({});
  const [pendingByChat, setPendingByChat] = 
    useState<Record<string, { id: string; parentMessageId?: string } | undefined>>({});

  const getLeafForChat = useCallback(
    (chatId: string) => leafByChat[chatId],
    [leafByChat]
  );

  const setLeafForChat = useCallback((chatId: string, messageId: string | null) => {
    setLeafByChat((prev) => ({ ...prev, [chatId]: messageId ?? undefined }));
  }, []);

  const getPendingForChat = useCallback(
    (chatId: string) => pendingByChat[chatId],
    [pendingByChat]
  );
  
  const setPendingForChat = useCallback(
    (chatId: string, pending: { id: string; parentMessageId?: string } | null) => {
      setPendingByChat((prev) => ({ ...prev, [chatId]: pending ?? undefined }));
    },
    []
  );

  // When the selected concept changes, resolve its chat from Convex
  const selectedConceptDetail = useQuery(
    api.concepts.get,
    selectedConceptId
      ? ({ conceptId: selectedConceptId as unknown as Id<"concepts"> })
      : "skip"
  );
  useEffect(() => {
    const chatId = (selectedConceptDetail as any)?.chat?._id as string | undefined;
    if (chatId && chatId !== selectedChatId) {
      setSelectedChatId(chatId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(selectedConceptDetail as any)?.chat?._id, selectedChatId]);

  // Default selection: first concept
  useEffect(() => {
    if (!conceptsLoading && !selectedConceptId && concepts.length > 0) {
      setSelectedConceptId(concepts[0]._id);
    }
  }, [conceptsLoading, concepts, selectedConceptId]);

  // Mutations
  const createConcept = useMutation(api.concepts.create);
  const createDocument = useMutation(api.documents.create);

  const addConcept = useCallback(
    async ({
      title,
      snippet,
      sourceType,
      sourceUrl,
      documentId,
      sourceMessageId,
      firstPrompt,
      pdfId,
      pdfMeta,
    }: {
      title: string;
      snippet: string;
      sourceType: "url" | "pdf" | "chat";
      sourceUrl?: string;
      documentId?: string;
      sourceMessageId?: string;
      firstPrompt: string;
      pdfId?: string;
      pdfMeta?: {
        fileName: string;
        page?: number;
        rect?: { x: number; y: number; w: number; h: number };
      };
    }) => {
      if (!currentUserId) throw new Error("User not initialized yet");
      
      const res = await createConcept({
        diveId: diveId as unknown as Id<"dives">,
        title,
        snippet,
        sourceType,
        sourceUrl,
        documentId: documentId as Id<"documents"> | undefined,
        sourceMessageId: sourceMessageId as Id<"messages"> | undefined,
        firstQuestion: firstPrompt, // keep Convex arg name stable
        userId: currentUserId as unknown as Id<"users">,
        pdfId: pdfId as Id<"_storage"> | undefined,
        pdfMeta: pdfMeta,
      });
      const conceptId = (res as any).conceptId as string;
      const chatId = (res as any).chatId as string;
      const firstUserMessageId = (res as any).firstUserMessageId as string;
      setSelectedConceptId(conceptId);
      setSelectedChatId(chatId);
      return { conceptId, chatId, firstUserMessageId };
    },
    [createConcept, currentUserId, diveId]
  );
  
  const addDocument = useCallback(
    async ({
      kind,
      title,
      url,
      pdfId,
      pdfMeta,
    }: {
      kind: "url" | "pdf";
      title: string;
      url?: string;
      pdfId?: string;
      pdfMeta?: {
        fileName: string;
        pageCount?: number;
      };
    }) => {
      if (!currentUserId) throw new Error("User not initialized yet");
      
      const documentId = await createDocument({
        diveId: diveId as unknown as Id<"dives">,
        kind,
        title,
        url,
        pdfId: pdfId as Id<"_storage"> | undefined,
        pdfMeta,
        userId: currentUserId as unknown as Id<"users">,
      });
      
      setSelectedDocumentId(documentId as string);
      return documentId as string;
    },
    [createDocument, currentUserId, diveId]
  );

  // Not used now (kept to avoid refactors)
  const updateConcept = useCallback((_id: string, _updates: Partial<Concept>) => {
    // You can wire to convex.dives.update or a concepts.update in future
  }, []);

  const setSelectedConcept = useCallback((conceptId: string | null) => {
    setSelectedConceptId(conceptId);
    setSelectedDocumentId(null);
  }, []);

  const setSelectedChat = useCallback((chatId: string | null) => {
    setSelectedChatId(chatId);
  }, []);
  
  const setSelectedDocument = useCallback((documentId: string | null) => {
    setSelectedDocumentId(documentId);
    // Do NOT clear concept selection. This allows chat to remain concept-anchored
    // while a document is shown as the main panel.
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        concepts,
        documents,
        documentsLoading,
        conceptsLoading,
        addConcept,
        addDocument,
        updateConcept,
        selectedConceptId,
        selectedChatId,
        selectedDocumentId,
        setSelectedConcept,
        setSelectedChat,
        setSelectedDocument,
        getLeafForChat,
        setLeafForChat,
        pendingByChat,
        getPendingForChat,
        setPendingForChat,
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