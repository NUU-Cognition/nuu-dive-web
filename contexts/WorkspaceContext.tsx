"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface Concept {
  _id: string;
  title: string;
  snippet: string;
  sourceType: "url" | "pdf" | "chat";
  sourceUrl?: string;
  createdAt: number;
  chatId: string;
  diveId: string;
}

interface Message {
  _id: string;
  role: "system" | "user" | "assistant" | "note";
  content: string;
  parentMessageId?: string;
  depth: number;
  createdAt: number;
  chatId: string;
}

interface Chat {
  _id: string;
  conceptId?: string;
  messages: Message[];
}

interface WorkspaceContextType {
  // Concepts
  concepts: Concept[];
  addConcept: (concept: Omit<Concept, "_id" | "createdAt">) => string;
  updateConcept: (id: string, updates: Partial<Concept>) => void;
  
  // Chats
  chats: Map<string, Chat>;
  getOrCreateChat: (chatId: string, conceptId?: string) => Chat;
  addMessage: (chatId: string, message: Omit<Message, "_id" | "createdAt" | "chatId">) => Message;
  
  // Selection
  selectedConceptId: string | null;
  selectedChatId: string | null;
  setSelectedConcept: (conceptId: string | null) => void;
  setSelectedChat: (chatId: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children, diveId }: { children: ReactNode; diveId: string }) {
  const [concepts, setConcepts] = useState<Concept[]>([
    // Initial mock concepts
    {
      _id: "c1",
      title: "Quantum Entanglement",
      snippet: "When two particles become entangled, the quantum state of each particle cannot be described independently...",
      sourceType: "url",
      sourceUrl: "https://example.com/quantum",
      createdAt: Date.now() - 3600000,
      chatId: "chat1",
      diveId,
    },
    {
      _id: "c2",
      title: "Superposition Principle",
      snippet: "A quantum system can exist in multiple states simultaneously until it is measured...",
      sourceType: "pdf",
      sourceUrl: "paper.pdf",
      createdAt: Date.now() - 7200000,
      chatId: "chat2",
      diveId,
    },
  ]);

  const [chats, setChats] = useState<Map<string, Chat>>(new Map([
    ["chat1", {
      _id: "chat1",
      conceptId: "c1",
      messages: [{
        _id: "m1",
        role: "note",
        content: "# Quantum Entanglement\n\n> When two particles become entangled, the quantum state of each particle cannot be described independently...\n\nSource: https://example.com/quantum",
        depth: 0,
        createdAt: Date.now() - 3600000,
        chatId: "chat1",
      }],
    }],
    ["chat2", {
      _id: "chat2",
      conceptId: "c2",
      messages: [{
        _id: "m2",
        role: "note",
        content: "# Superposition Principle\n\n> A quantum system can exist in multiple states simultaneously until it is measured...\n\nSource: paper.pdf",
        depth: 0,
        createdAt: Date.now() - 7200000,
        chatId: "chat2",
      }],
    }],
  ]));

  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const addConcept = useCallback((concept: Omit<Concept, "_id" | "createdAt">) => {
    const newConcept: Concept = {
      ...concept,
      _id: `c${Date.now()}`,
      createdAt: Date.now(),
    };
    
    setConcepts(prev => [...prev, newConcept]);
    
    // Create a chat for the concept
    const newChat: Chat = {
      _id: newConcept.chatId,
      conceptId: newConcept._id,
      messages: [{
        _id: `m${Date.now()}`,
        role: "note",
        content: `# ${newConcept.title}\n\n> ${newConcept.snippet}\n\nSource: ${newConcept.sourceUrl || "Chat"}`,
        depth: 0,
        createdAt: Date.now(),
        chatId: newConcept.chatId,
      }],
    };
    
    setChats(prev => new Map(prev).set(newChat._id, newChat));
    
    return newConcept._id;
  }, []);

  const updateConcept = useCallback((id: string, updates: Partial<Concept>) => {
    setConcepts(prev => prev.map(c => c._id === id ? { ...c, ...updates } : c));
  }, []);

  const getOrCreateChat = useCallback((chatId: string, conceptId?: string) => {
    const existingChat = chats.get(chatId);
    if (existingChat) return existingChat;
    
    const newChat: Chat = {
      _id: chatId,
      conceptId,
      messages: [],
    };
    
    setChats(prev => new Map(prev).set(chatId, newChat));
    return newChat;
  }, [chats]);

  const addMessage = useCallback((chatId: string, message: Omit<Message, "_id" | "createdAt" | "chatId">) => {
    const newMessage: Message = {
      ...message,
      _id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      chatId,
    };
    
    setChats(prev => {
      const newChats = new Map(prev);
      const chat = newChats.get(chatId) || { _id: chatId, messages: [] };
      chat.messages = [...chat.messages, newMessage];
      newChats.set(chatId, chat);
      return newChats;
    });
    
    return newMessage;
  }, []);

  const setSelectedConcept = useCallback((conceptId: string | null) => {
    setSelectedConceptId(conceptId);
    if (conceptId) {
      const concept = concepts.find(c => c._id === conceptId);
      if (concept) {
        setSelectedChatId(concept.chatId);
      }
    }
  }, [concepts]);

  const setSelectedChat = useCallback((chatId: string | null) => {
    setSelectedChatId(chatId);
  }, []);

  return (
    <WorkspaceContext.Provider value={{
      concepts,
      addConcept,
      updateConcept,
      chats,
      getOrCreateChat,
      addMessage,
      selectedConceptId,
      selectedChatId,
      setSelectedConcept,
      setSelectedChat,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}