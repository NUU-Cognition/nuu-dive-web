import { Node, Edge, Position } from "reactflow";
import dagre from "dagre";

interface ResponseGraphNode {
  type: "response";
  id: string;
  content: string;
  createdAt: number;
  tokenCount?: number;
}

interface ResponseGraphEdge {
  from: { type: string; id: string };
  to: { type: string; id: string };
  label: string;       // truncated prompt for display
  promptId?: string;   // user message id (the prompt)
  prompt?: string;     // full prompt content
}

interface ResponseGraph {
  anchor: { type: string; id: string; chatId: string };
  nodes: ResponseGraphNode[];
  edges: ResponseGraphEdge[];
}

interface Document {
  _id: string;
  title: string;
  kind: "url" | "pdf";
  url?: string;
  responseCount: number;
  conceptCount: number;
}

interface Concept {
  _id: string;
  title: string;
  snippet: string;
  sourceType: "url" | "pdf" | "chat";
  documentId?: string;
}

/**
 * Build ReactFlow nodes and edges from documents, concepts, and response graphs
 */
export function buildGraphElements(
  documents: Document[],
  concepts: Concept[],
  responseGraphs: Map<string, ResponseGraph>,
  selectedId?: string | null,
  onNodeClick?: (nodeId: string, nodeType: string, extra?: { chatId?: string }) => void,
  selectedNodePath?: string[] // ADD THIS PARAMETER
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Position tracking
  let docY = 50;
  const docSpacing = 400;
  
  // Create document nodes
  documents.forEach((doc) => {
    const nodeId = `doc-${doc._id}`;
    nodes.push({
      id: nodeId,
      type: "documentNode",
      position: { x: 50, y: docY },
      data: {
        title: doc.title,
        kind: doc.kind,
        url: doc.url,
        responseCount: doc.responseCount,
        conceptCount: doc.conceptCount,
        selected: selectedId === doc._id,
        onAsk: () => onNodeClick?.(doc._id, "document"),
        // Open in main panel (replace canvas)
        onOpen: () => onNodeClick?.(doc._id, "document"),
      },
    });
    
    // Position concepts related to this document
    const docConcepts = concepts.filter(c => c.documentId === doc._id);
    let conceptX = 400;
    
    docConcepts.forEach((concept, idx) => {
      const conceptNodeId = `concept-${concept._id}`;
      nodes.push({
        id: conceptNodeId,
        type: "conceptNode",
        position: { x: conceptX, y: docY + idx * 80 },
        data: {
          title: concept.title,
          snippet: concept.snippet,
          sourceType: concept.sourceType,
          selected: selectedId === concept._id,
        },
      });
      
      // Edge from document to concept
      edges.push({
        id: `${nodeId}-${conceptNodeId}`,
        source: nodeId,
        sourceHandle: "right",
        target: conceptNodeId,
        targetHandle: "left",
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 1 },
      });
      
      // Add response nodes for this concept's chat
      const responseGraph = responseGraphs.get(concept._id);
      if (responseGraph) {
        const { responseNodes, responseEdges } = buildResponseSubgraph(
          responseGraph,
          conceptNodeId,
          { x: conceptX + 250, y: docY + idx * 80 },
          selectedId,
          onNodeClick,
          selectedNodePath // ADD THIS
        );
        nodes.push(...responseNodes);
        edges.push(...responseEdges);
      }
    });
    
    // Add response nodes directly under documents
    const docResponseGraph = responseGraphs.get(doc._id);
    if (docResponseGraph) {
      const { responseNodes, responseEdges } = buildResponseSubgraph(
        docResponseGraph,
        nodeId,
        { x: 50, y: docY + 150 },
        selectedId,
        onNodeClick,
        selectedNodePath // ADD THIS
      );
      nodes.push(...responseNodes);
      edges.push(...responseEdges);
    }
    
    docY += docSpacing;
  });
  
  // Add standalone concepts (not from documents)
  const standaloneConcepts = concepts.filter(c => !c.documentId);
  let standaloneY = 50;
  
  standaloneConcepts.forEach((concept) => {
    const conceptNodeId = `concept-${concept._id}`;
    nodes.push({
      id: conceptNodeId,
      type: "conceptNode",
      position: { x: 800, y: standaloneY },
      data: {
        title: concept.title,
        snippet: concept.snippet,
        sourceType: concept.sourceType,
        selected: selectedId === concept._id,
      },
    });
    
    // Add response nodes for this concept
    const responseGraph = responseGraphs.get(concept._id);
    if (responseGraph) {
      const { responseNodes, responseEdges } = buildResponseSubgraph(
        responseGraph,
        conceptNodeId,
        { x: 1050, y: standaloneY },
        selectedId,
        onNodeClick,
        selectedNodePath // ADD THIS
      );
      nodes.push(...responseNodes);
      edges.push(...responseEdges);
    }
    
    standaloneY += 200;
  });
  
  // Add free chats (chats without anchors)
  const freeChats: any[] = [];
  responseGraphs.forEach((graph, key) => {
    // Check if this key is already handled (as document or concept)
    const isDocument = documents.some(d => d._id === key);
    const isConcept = concepts.some(c => c._id === key);
    
    // If not handled and it's a free chat
    if (!isDocument && !isConcept && graph.anchor?.type === "free") {
      freeChats.push({ graph, chatId: graph.anchor.chatId });
    }
  });
  
  // Render free chats in a separate section
  if (freeChats.length > 0) {
    let freeChatY = Math.max(docY, standaloneY) + 100;
    
    // Add a label node for free chats section
    nodes.push({
      id: "free-chats-label",
      type: "default",
      position: { x: 50, y: freeChatY - 30 },
      data: { label: "Free Chats" },
      style: { 
        background: "transparent", 
        border: "none",
        fontSize: "14px",
        fontWeight: "bold"
      }
    });
    
    freeChats.forEach(({ graph, chatId }, idx) => {
      const anchorNodeId = `free-chat-${chatId}`;
      
      // Create an anchor node for the free chat
      nodes.push({
        id: anchorNodeId,
        type: "default",
        position: { x: 50, y: freeChatY + idx * 150 },
        data: { label: `Chat ${idx + 1}` },
        style: { 
          background: "#f3f4f6",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
          padding: "8px 12px"
        }
      });
      
      // Add response nodes for this free chat
      const { responseNodes, responseEdges } = buildResponseSubgraph(
        graph,
        anchorNodeId,
        { x: 200, y: freeChatY + idx * 150 },
        selectedId,
        onNodeClick,
        selectedNodePath // ADD THIS
      );
      nodes.push(...responseNodes);
      edges.push(...responseEdges);
    });
  }
  
  return { nodes, edges };
}

/**
 * Build response nodes and edges for a single chat/anchor
 */
function buildResponseSubgraph(
  graph: ResponseGraph,
  anchorNodeId: string,
  startPosition: { x: number; y: number },
  selectedId?: string | null,
  onNodeClick?: (nodeId: string, nodeType: string, extra?: { chatId?: string }) => void,
  selectedNodePath?: string[] 
): { responseNodes: Node[]; responseEdges: Edge[] } {
  const responseNodes: Node[] = [];
  const responseEdges: Edge[] = [];
  
  // Use a simple vertical layout for responses
  let responseY = startPosition.y + 50;
  const responseSpacing = 40;
  
  // If no nodes, add a placeholder
  if (graph.nodes.length === 0) {
    responseNodes.push({
      id: `${anchorNodeId}-placeholder`,
      type: "default",
      position: { x: startPosition.x, y: responseY },
      data: { 
        label: "No responses yet" 
      },
      style: {
        background: "#fafafa",
        border: "1px dashed #cbd5e1",
        borderRadius: "4px",
        fontSize: "12px",
        color: "#94a3b8",
        padding: "4px 8px"
      }
    });
    
    // Connect placeholder to anchor
    responseEdges.push({
      id: `${anchorNodeId}-to-placeholder`,
      source: anchorNodeId,
      target: `${anchorNodeId}-placeholder`,
      type: "smoothstep",
      style: { 
        stroke: "#e2e8f0", 
        strokeWidth: 1,
        strokeDasharray: "5,5"
      },
    });
    
    return { responseNodes, responseEdges };
  }
  
  // ADD: Check if any node is selected (for hasSelection)
  const hasSelection = selectedNodePath && selectedNodePath.length > 0;
  
  graph.nodes.forEach((node, idx) => {
    const nodeId = `response-${node.id}`;
    
    // ADD: Check if this specific node is in the selected path
    const isInPath = selectedNodePath ? selectedNodePath.includes(nodeId) : false;
    
    responseNodes.push({
      id: nodeId,
      type: "responseNode",
      position: { x: startPosition.x, y: responseY },
      data: {
        content: node.content,
        createdAt: node.createdAt,
        tokenCount: node.tokenCount,
        selected: selectedId === node.id,
        onClick: () => onNodeClick?.(node.id, "response", { chatId: graph.anchor.chatId }),
        isInPath, // ADD THIS
        hasSelection, // ADD THIS
      },
    });
    
    responseY += responseSpacing;
  });
  
  // Create edges
  graph.edges.forEach((edge) => {
    const sourceId = edge.from.type === "response" 
      ? `response-${edge.from.id}`
      : anchorNodeId;
    const targetId = `response-${edge.to.id}`;
    
    responseEdges.push({
      id: `${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: "bezier",
      label: edge.label,
      data: { promptId: edge.promptId, prompt: edge.prompt, label: edge.label },
      labelStyle: {
        fontSize: 11,
        fill: "#64748b",
      },
      style: {
        stroke: "#cbd5e1",
        strokeWidth: 1,
      },
    });
  });
  
  return { responseNodes, responseEdges };
}

/**
 * Auto-layout the graph using dagre
 */
export function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n, children: [], depth: 0}]));
  const roots: any[] = [];

  nodes.forEach(node => {
    const incoming = edges.filter(e => e.target === node.id);
    if (incoming.length === 0) {
      roots.push(nodeMap.get(node.id));
    }
  });

  edges.forEach(edge => {
    const parent = nodeMap.get(edge.source);
    const child = nodeMap.get(edge.target);
    if (parent && child) {
      parent.children.push(child);
      child.depth = parent.depth + 1;
    }
  });

  const positionNode = (node: any, x = 0, y = 0) => {
    node.position = { x, y };

    node.children.forEach((child: any, index: number) => {
      if (node.type === "documentNode") {
        positionNode(child, x + 350 + (index * 300), y);
      } else if (node.type === "responseNode") {
        if (index === 0) {
          positionNode(child, x, y + 120); // First response goes down
        } else {
          positionNode(child, x + (index * 150), y + 120); // Others go right
        }
      } else if (node.type === "conceptNode") {
        const conceptWidth = 200;
        const conceptCenter = x + (conceptWidth / 2) - 5;

        positionNode(child, conceptCenter, y + 150);
      }
    });
  };

  roots.forEach((root, index) => {
    positionNode(root, 50, index * 200 + 50);
  });

  return nodes.map(node => {
    const positioned = nodeMap.get(node.id);
    const nodeType = node.type;

    let targetPos, sourcePos;

    if (nodeType === "documentNode") {
      targetPos = Position.Right;
      sourcePos = Position.Left;  
    } else if (nodeType === "conceptNode") {
      targetPos = Position.Right;
      sourcePos = Position.Left;
    } else if (nodeType === "responseNode") {
      targetPos = Position.Top;
      sourcePos = Position.Bottom
    }

    return {
      ...node, 
      targetPosition: targetPos,
      sourcePosition: sourcePos,
      position: positioned.position,
    }
  });
}