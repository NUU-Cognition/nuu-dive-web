"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
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
    selectedConceptId, 
    selectedDocumentId,
    selectedChatId,
    setSelectedConcept,
    setSelectedDocument,
    setSelectedChat,
  } = useWorkspace();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [responseGraphs, setResponseGraphs] = useState<Map<string, any>>(new Map());

  // Get response graphs for selected items
  const selectedConceptChat = useQuery(
    api.concepts.get,
    selectedConceptId && !selectedConceptId.startsWith("c")
      ? { conceptId: selectedConceptId as Id<"concepts"> }
      : "skip"
  );

  const selectedDocumentChats = useQuery(
    api.chats.listByAnchor,
    selectedDocumentId
      ? { anchorType: "document" as const, anchorId: selectedDocumentId as Id<"documents"> }
      : "skip"
  );

  // Get response graph for selected concept's chat
  const conceptResponseGraph = useQuery(
    api.messages.responseGraph,
    selectedConceptChat?.chat?._id
      ? { chatId: selectedConceptChat.chat._id as Id<"chats"> }
      : "skip"
  );

  // Get response graph for selected document's first chat (if any)
  const documentResponseGraph = useQuery(
    api.messages.responseGraph,
    selectedDocumentChats?.[0]?._id
      ? { chatId: selectedDocumentChats[0]._id as Id<"chats"> }
      : "skip"
  );

  // Update response graphs map
  useEffect(() => {
    const newGraphs = new Map();
    
    if (selectedConceptId && conceptResponseGraph) {
      newGraphs.set(selectedConceptId, conceptResponseGraph);
    }
    
    if (selectedDocumentId && documentResponseGraph) {
      newGraphs.set(selectedDocumentId, documentResponseGraph);
    }
    
    setResponseGraphs(newGraphs);
  }, [selectedConceptId, conceptResponseGraph, selectedDocumentId, documentResponseGraph]);

  // Build and layout the graph
  useEffect(() => {
    const handleNodeClick = (nodeId: string, nodeType: string) => {
      if (nodeType === "document") {
        setSelectedDocument(nodeId);
      } else if (nodeType === "concept") {
        setSelectedConcept(nodeId);
      } else if (nodeType === "response") {
        // Focus message in chat panel
        // This would require finding the chat that contains this message
        console.log("Focus response:", nodeId);
      }
    };

    const { nodes: graphNodes, edges: graphEdges } = buildGraphElements(
      documents,
      concepts,
      responseGraphs,
      selectedConceptId || selectedDocumentId,
      handleNodeClick
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
    setNodes,
    setEdges,
    setSelectedConcept,
    setSelectedDocument,
  ]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const [type, id] = node.id.split("-");
      
      if (type === "doc") {
        setSelectedDocument(id);
      } else if (type === "concept") {
        setSelectedConcept(id);
      } else if (type === "response") {
        // Could open chat panel focused on this message
        console.log("Response clicked:", id);
      }
    },
    [setSelectedConcept, setSelectedDocument]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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