"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [selectedNode, setSelectedNode] = useState<string[]>([]);
  
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

  const findPathToRoot = useCallback((clickedNodeId: string, edges: Edge[]) => {
    const path: string[] = [];
    let currentNodeId = clickedNodeId;

    while (currentNodeId) {
      path.unshift(currentNodeId);
      const parentEdge = edges.find(e => e.target === currentNodeId);
      currentNodeId = parentEdge?.source || "";
    }
    return path;
  }, []);

  // Build and layout the graph
  useEffect(() => {
    if (!selectedChatId || selectedNode.length === 0) return;

    const currentLeaf = getLeafForChat(selectedChatId);
    if (!currentLeaf) return;

    const currentLeafNodeId = `response-${currentLeaf}`;
    
    // If the current leaf is not in the selected path, extend the path
    if (!selectedNode.includes(currentLeafNodeId)) {
      // Check if the current leaf is a descendant of the last node in the selected path
      const lastSelectedNode = selectedNode[selectedNode.length - 1];
      
      // Build a temporary graph to check relationships
      const tempEdges: Edge[] = [];
      responseGraphs.forEach((graph) => {
        graph.edges.forEach((edge) => {
          const sourceId = edge.from.type === "response" 
            ? `response-${edge.from.id}`
            : (edge.from.type === "concept" ? `concept-${edge.from.id}` : `doc-${edge.from.id}`);
          const targetId = `response-${edge.to.id}`;
          tempEdges.push({ id: `${sourceId}-${targetId}`, source: sourceId, target: targetId });
        });
      });

      // Check if current leaf is reachable from the last selected node
      const pathToNewLeaf = findPathToRoot(currentLeafNodeId, tempEdges);
      const lastSelectedIndex = pathToNewLeaf.indexOf(lastSelectedNode);
      
      if (lastSelectedIndex !== -1) {
        // Extend the path to include the new leaf
        const newPath = [...selectedNode, ...pathToNewLeaf.slice(lastSelectedIndex + 1)];
        setSelectedNode(newPath);
      }
    }
  }, [selectedChatId, getLeafForChat, selectedNode, responseGraphs, findPathToRoot]);
    // If we have a selected chat, try to mark its current leaf response as selected
    // const selectedResponseId = selectedChatId ? getLeafForChat(selectedChatId) : undefined;

    // const handleNodeClick = (nodeId: string, nodeType: string, extra?: { chatId?: string }) => {
    //   if (nodeType === "document") {
    //     setSelectedDocument(nodeId);
    //   } else if (nodeType === "concept") {
    //     setSelectedConcept(nodeId ?? null);
    //   } else if (nodeType === "response") {
    //     const chatId = extra?.chatId;
    //     if (chatId) {
    //       setSelectedChat(chatId);
    //       setLeafForChat(chatId, nodeId); // nodeId is the response message _id
    //     }
    //   }

    // };

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
      pendingByChat,
      selectedNode,
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
    selectedNode,
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
      const path = findPathToRoot(node.id, edges);
      setSelectedNode(path);
  
      const [type, id] = node.id.split("-");
      
      if (type === "doc") {
        setSelectedDocument(id ?? null);
      } else if (type === "concept") {
        setSelectedConcept(id ?? null);
      } else if (type === "response") {
        for (const [, graph] of responseGraphs) {
          if (graph.nodes?.some?.((n: { id: string }) => n.id === id)) {
            setSelectedChat(graph.anchor.chatId);
            setLeafForChat(graph.anchor.chatId, id ?? null);
            break;
          }
        }
      }
    },
    [setSelectedConcept, setSelectedDocument, responseGraphs, setSelectedChat, setLeafForChat, findPathToRoot, edges] // ← Add missing deps
  );

  const enhancedEdges = useMemo(() => {
    return edges.map(edge => {
      // FIX: Check if edge connects consecutive nodes in path
      const isInPath = selectedNode.length > 1 &&
        selectedNode.includes(edge.source) &&
        selectedNode.includes(edge.target) &&
        selectedNode.indexOf(edge.target) === selectedNode.indexOf(edge.source) + 1; // ← Fixed this line
      
        return {
          ...edge,
          // ONLY show label when edge is in path
          label: isInPath ? edge.label : undefined,
          style: {
            ...edge.style,
            stroke: isInPath ? "#1e293b" : (edge.style?.stroke || "#e2e8f0"),
            strokeWidth: isInPath ? 3 : (edge.style?.strokeWidth || 1),
            opacity: selectedNode.length === 0 ? 1 : (isInPath ? 1 : 0.3),
          },
          animated: isInPath,
          // Show title only when in path
          ...(isInPath && edge.data?.prompt ? { title: edge.data.prompt } : {}),
          // Always include label styling so it's ready when label appears
          labelStyle: {
            fontSize: 20,
            fill: "#64748b",
          },
          labelBgPadding: [8, 4] as [number, number],
          labelBgBorderRadius: 4,
          labelBgStyle: {
            fill: "#f1f5f9",
            fillOpacity: 0.9,
          },
        };
    });
  }, [edges, selectedNode]);
  
  // ADD: Clear selection when clicking background
  const onPaneClick = useCallback(() => {
    setSelectedNode([]);
  }, []);

  return (
    <div className="h-full w-full">
      {(documentsLoading || conceptsLoading || graphsLoading) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <Spinner size="md" label="Building canvas…" />
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={enhancedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
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