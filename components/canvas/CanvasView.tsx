"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import ReactFlow, {
  type Node,
  type Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import ConceptNode from "./ConceptNode";
import DocumentNode from "./DocumentNode";
import ResponseNode from "./ResponseNode";
import { buildGraphElements, autoLayout } from "./graphBuilders";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Spinner } from "@/components/ui/spinner";

interface CanvasViewProps {
  diveId: string;
}

const nodeTypes = {
  conceptNode: ConceptNode,
  documentNode: DocumentNode,
  responseNode: ResponseNode,
};

export default function CanvasView({ diveId }: CanvasViewProps) {
  const { 
    concepts, 
    documents,
    documentsLoading,
    conceptsLoading,
    selectedConceptId, 
    selectedDocumentId,
    selectedChatId,
    setSelectedConcept,
    setSelectedDocument,
    setSelectedChat,
    setLeafForChat,
    getLeafForChat,
    pendingByChat,
  } = useWorkspace();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Get ALL response graphs for this dive at once
  const allGraphs = useQuery(
    api.messages.allResponseGraphs,
    diveId ? { diveId: diveId as Id<"dives"> } : "skip"
  );
  const graphsLoading = allGraphs === undefined;
  
  // Convert to Map for easy lookup
  const responseGraphs = useMemo(() => {
    if (!allGraphs) return new Map();
    return new Map(Object.entries(allGraphs));
  }, [allGraphs]);

  // Build and layout the graph
  useEffect(() => {
    // If we have a selected chat, try to mark its current leaf response as selected
    const selectedResponseId = selectedChatId ? getLeafForChat(selectedChatId) : undefined;

    const handleNodeClick = (nodeId: string, nodeType: string, extra?: { chatId?: string }) => {
      if (nodeType === "document") {
        setSelectedDocument(nodeId);
      } else if (nodeType === "concept") {
        setSelectedConcept(nodeId ?? null);
      } else if (nodeType === "response") {
        const chatId = extra?.chatId;
        if (chatId) {
          setSelectedChat(chatId);
          setLeafForChat(chatId, nodeId); // nodeId is the response message _id
        }
      }
    };

    const { nodes: graphNodes, edges: graphEdges } = buildGraphElements(
      documents,
      concepts,
      responseGraphs,
      selectedResponseId || selectedConceptId || selectedDocumentId,
      handleNodeClick,
      pendingByChat
    );

    // Auto-layout if we have nodes
    if (graphNodes.length > 0) {
      const layoutedNodes = autoLayout(graphNodes, graphEdges);
      setNodes(layoutedNodes);
      setEdges(graphEdges);
    } else {
      // Default empty state
      setNodes([]);
      setEdges([]);
    }
  }, [
    documents,
    concepts,
    responseGraphs,
    selectedConceptId,
    selectedDocumentId,
    selectedChatId,
    setNodes,
    setEdges,
    setSelectedConcept,
    setSelectedDocument,
    setSelectedChat,
    setLeafForChat,
    getLeafForChat,
    pendingByChat,
  ]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const [type, id] = node.id.split("-");
      
      if (type === "doc") {
        setSelectedDocument(id ?? null);
      } else if (type === "concept") {
        setSelectedConcept(id ?? null);
      } else if (type === "response") {
        // Find the chatId for this response from the precomputed graphs
        for (const [, graph] of responseGraphs) {
          if (graph.nodes?.some?.((n: any) => n.id === id)) {
            setSelectedChat(graph.anchor.chatId);
            setLeafForChat(graph.anchor.chatId, id ?? null);
            break;
          }
        }
      }
    },
    [setSelectedConcept, setSelectedDocument, responseGraphs, setSelectedChat, setLeafForChat]
  );

  const onEdgeClick = useCallback(
    (_evt: React.MouseEvent, edge: any) => {
      const prompt = (edge?.data?.prompt as string | undefined) ?? (edge?.label as string | undefined);
      if (!prompt) return;
      // eslint-disable-next-line no-alert
      alert(prompt);
    },
    []
  );

  return (
    <div className="h-full w-full">
      {(documentsLoading || conceptsLoading || graphsLoading) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <Spinner size="md" label="Building canvas…" />
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeClick={onEdgeClick}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={12} 
          size={1} 
          color="#e2e8f0"
        />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            if (node.type === "responseNode") return "#000";
            if (node.type === "documentNode") return "#3b82f6";
            return node.data.selected ? "#1e293b" : "#cbd5e1";
          }}
          style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        />
      </ReactFlow>
      
      {/* Empty state */}
      {documents.length === 0 && concepts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">No documents or concepts yet</p>
            <p className="text-sm text-muted-foreground">
              Import a document or create a concept to get started
            </p>
          </div>
        </div>
      )}
    </div>
  );
}