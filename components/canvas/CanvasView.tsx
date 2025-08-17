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
import { buildGraphElements, autoLayout, type ResponseGraphEdge } from "./graphBuilders";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Scissors, Edit3 } from "lucide-react";

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
    openConceptNote,
  } = useWorkspace();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  
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

  // Deletion mutations
  const deleteMessage = useMutation(api.messages.deleteWithChildren);
  const deleteConcept = useMutation(api.concepts.deleteWithChat);
  const deleteDocument = useMutation(api.documents.deleteWithRelated);

  const findPathToRoot = useCallback((clickedNodeId: string, edges: Edge[]) => {
    const path: string[] = [];
    let currentNodeId: string | undefined = clickedNodeId;

    while (currentNodeId) {
      path.unshift(currentNodeId);
      const parentEdge = edges.find(e => e.target === currentNodeId);
      currentNodeId = parentEdge?.source;
    }
    return path;
  }, []);

  // Deletion handlers
  const handleDeleteNode = useCallback(async (nodeId: string, nodeType: string) => {
    if (!editMode) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete this ${nodeType}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const [type, id] = nodeId.split("-");
      
      if (type === "response") {
        // Delete single response message and its children
        await deleteMessage({ messageId: id as Id<"messages"> });
      } else if (type === "concept") {
        // Delete concept and all its associated chat/responses
        await deleteConcept({ conceptId: id as Id<"concepts"> });
        // Clear selection if this concept was selected
        if (selectedConceptId === id) {
          setSelectedConcept(null);
        }
      } else if (type === "doc") {
        // Delete document and all related concepts/chats
        await deleteDocument({ documentId: id as Id<"documents"> });
        // Clear selection if this document was selected
        if (selectedDocumentId === id) {
          setSelectedDocument(null);
        }
      }
      
      // Clear node selection and chat after deletion
      setSelectedNode([]);
      setSelectedChat(null);
    } catch (error) {
      console.error(`Failed to delete ${nodeType}:`, error);
      alert(`Failed to delete ${nodeType}. Please try again.`);
    }
  }, [editMode, deleteMessage, deleteConcept, deleteDocument, selectedConceptId, selectedDocumentId, setSelectedConcept, setSelectedDocument, setSelectedChat]);

  const handleDeletePath = useCallback(async (nodeId: string) => {
    if (!editMode) return;
    
    const confirmed = window.confirm("Are you sure you want to delete this conversation path? All responses from this point onwards will be deleted. This action cannot be undone.");
    if (!confirmed) return;

    try {
      const [type, id] = nodeId.split("-");
      
      if (type === "response") {
        // Delete the response message and all its children (entire branch)
        await deleteMessage({ messageId: id as Id<"messages"> });
        
        // Clear selections
        setSelectedNode([]);
        setSelectedChat(null);
      }
    } catch (error) {
      console.error("Failed to delete conversation path:", error);
      alert("Failed to delete conversation path. Please try again.");
    }
  }, [editMode, deleteMessage, setSelectedChat]);

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
        graph.edges.forEach((edge: ResponseGraphEdge) => {
          const sourceId = edge.from.type === "response" 
            ? `response-${edge.from.id}`
            : (edge.from.type === "concept" ? `concept-${edge.from.id}` : `doc-${edge.from.id}`);
          const targetId = `response-${edge.to.id}`;
          tempEdges.push({ id: `${sourceId}-${targetId}`, source: sourceId, target: targetId });
        });
      });

      // Check if current leaf is reachable from the last selected node
      const pathToNewLeaf = findPathToRoot(currentLeafNodeId, tempEdges);
      const lastSelectedIndex = lastSelectedNode ? pathToNewLeaf.indexOf(lastSelectedNode) : -1;
      
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
      openConceptNote,
      selectedNode,
      editMode,
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
    editMode,
    setNodes,
    setEdges,
    setSelectedConcept,
    setSelectedDocument,
    setSelectedChat,
    setLeafForChat,
    getLeafForChat,
    pendingByChat,
    openConceptNote,
  ]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (editMode) {
        // In edit mode, handle deletion based on click type
        const [type] = node.id.split("-");
        
        if (event.shiftKey) {
          // Shift+click = delete path (conversation branch)
          handleDeletePath(node.id);
        } else {
          // Regular click = delete single node
          const nodeType = type === "doc" ? "document" : type === "concept" ? "concept" : "response";
          handleDeleteNode(node.id, nodeType);
        }
        return;
      }

      // Normal mode - selection behavior
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
    [editMode, handleDeleteNode, handleDeletePath, setSelectedConcept, setSelectedDocument, responseGraphs, setSelectedChat, setLeafForChat, findPathToRoot, edges]
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
    // Clear all selections to hide chat interface
    setSelectedChat(null); // Clear chat selection to hide messages
    setSelectedConcept(null); // Also clear concept selection
    setSelectedDocument(null); // And document selection
  }, [setSelectedChat, setSelectedConcept, setSelectedDocument]);

  return (
    <div className="h-full w-full relative">
      {/* Edit Mode Toggle Button */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          variant={editMode ? "destructive" : "outline"}
          size="sm"
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-2 ${editMode ? "ring-2 ring-destructive/50" : ""}`}
          title={editMode ? "Exit edit mode" : "Enter edit mode"}
        >
          {editMode ? (
            <>
              <Edit3 className="h-4 w-4" />
              Exit Edit
            </>
          ) : (
            <>
              <Scissors className="h-4 w-4" />
              Edit Mode
            </>
          )}
        </Button>
      </div>

      {(documentsLoading || conceptsLoading || graphsLoading) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <Spinner size="md" label="Building canvas…" />
        </div>
      )}
      
      {/* Edit mode instructions */}
      {editMode && (
        <div className="absolute top-16 right-4 z-40 bg-destructive/10 border border-destructive/30 rounded-lg p-3 max-w-sm">
          <p className="text-sm text-destructive font-medium mb-1">Edit Mode Active</p>
          <p className="text-xs text-muted-foreground">
            • Click to delete single item<br/>
            • Shift+click to delete conversation path<br/>
            • Concept deletion removes all related responses
          </p>
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
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        edgesUpdatable={false}
        fitView
        attributionPosition="bottom-left"
        className={editMode ? "canvas-edit-mode" : ""}
        style={{
          cursor: editMode ? "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23dc2626\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"6\" cy=\"6\" r=\"3\"/><path d=\"m6 6 5 5m0 0 7-7m-7 7v4a1 1 0 0 0 1 1h4\"/></svg>') 10 10, crosshair" : "default"
        }}
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