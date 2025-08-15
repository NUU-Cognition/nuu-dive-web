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
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface CanvasViewProps {
  diveId: string;
}

const nodeTypes = {
  concept: ConceptNode,
};

export default function CanvasView({ diveId }: CanvasViewProps) {
  const { concepts, selectedConceptId, setSelectedConcept } = useWorkspace();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Update nodes when concepts change
  useEffect(() => {
    const newNodes: Node[] = concepts.map((concept, index) => ({
      id: concept._id,
      type: "concept",
      position: { 
        x: 250 + (index % 3) * 250, 
        y: 100 + Math.floor(index / 3) * 150 
      },
      data: {
        title: concept.title,
        snippet: concept.snippet,
        sourceType: concept.sourceType,
        chatId: concept.chatId,
        selected: selectedConceptId === concept._id,
      },
    }));
    setNodes(newNodes);
  }, [concepts, selectedConceptId, setNodes]);

  // Create edges between related concepts (for demo, connect sequential concepts)
  useEffect(() => {
    const newEdges: Edge[] = [];
    for (let i = 0; i < concepts.length - 1; i++) {
      if (i % 3 !== 2) { // Don't connect to next row
        newEdges.push({
          id: `e${concepts[i]._id}-${concepts[i + 1]._id}`,
          source: concepts[i]._id,
          target: concepts[i + 1]._id,
          type: "smoothstep",
          animated: false,
          style: { stroke: "#94a3b8", strokeWidth: 1 },
        });
      }
    }
    setEdges(newEdges);
  }, [concepts, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedConcept(node.id);
    },
    [setSelectedConcept]
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