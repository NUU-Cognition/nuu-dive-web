"use client";

import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import ConceptNode from "./ConceptNode";

interface CanvasViewProps {
  diveId: string;
  selectedConceptId: string | null;
  onSelectConcept: (conceptId: string, chatId: string) => void;
}

const nodeTypes = {
  concept: ConceptNode,
};

export default function CanvasView({
  diveId,
  selectedConceptId,
  onSelectConcept,
}: CanvasViewProps) {
  // Mock data - in production this would come from Convex
  const initialNodes: Node[] = [
    {
      id: "c1",
      type: "concept",
      position: { x: 250, y: 100 },
      data: { 
        title: "Quantum Entanglement",
        snippet: "When two particles become entangled...",
        sourceType: "url",
        chatId: "chat1",
        selected: selectedConceptId === "c1",
      },
    },
    {
      id: "c2",
      type: "concept",
      position: { x: 500, y: 200 },
      data: { 
        title: "Superposition Principle",
        snippet: "A quantum system can exist in multiple states...",
        sourceType: "pdf",
        chatId: "chat2",
        selected: selectedConceptId === "c2",
      },
    },
  ];

  const initialEdges: Edge[] = [
    {
      id: "e1-2",
      source: "c1",
      target: "c2",
      type: "smoothstep",
      animated: true,
      style: { stroke: "#94a3b8", strokeWidth: 1 },
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update node selection state when selectedConceptId changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selected: node.id === selectedConceptId,
        },
      }))
    );
  }, [selectedConceptId, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onSelectConcept(node.id, node.data.chatId);
    },
    [onSelectConcept]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
          nodeColor={(node) => node.data.selected ? "#1e293b" : "#cbd5e1"}
          style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        />
      </ReactFlow>
    </div>
  );
}