import { type Node, type Edge, Position } from "reactflow";
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
  sourceMessageId?: string;
}

/**
 * Find source response node for a chat-sourced concept
 */
function findSourceResponseNode(
  responseGraphs: Map<string, ResponseGraph>, 
  concept: Concept,
  documents?: Document[],
  concepts?: Concept[]
): { nodeId: string; position: { x: number; y: number } } | null {
  // Only look for chat-sourced concepts (those with sourceMessageId)
  if (concept.sourceType !== "chat" || !concept.sourceMessageId) {
    return null;
  }
  
  
  // Search through all response graphs to find the source message or its related response
  for (const [, graph] of responseGraphs) {
    // First, try to find the source message directly (if it's an assistant message)
    let responseNode = graph.nodes.find(n => n.id === concept.sourceMessageId);
    
    // If not found, the source might be a user message - find the assistant response to it
    if (!responseNode) {
      // Look through edges to find an assistant response that was prompted by this user message
      for (const edge of graph.edges) {
        if (edge.promptId === concept.sourceMessageId) {
          responseNode = graph.nodes.find(n => n.id === edge.to.id);
          break;
        }
      }
    }
    
    if (responseNode) {
      // Calculate approximate position based on anchor type and position
      let basePosition = { x: 50, y: 50 };
      
      // Try to determine position based on anchor
      if (graph.anchor.type === "document" && documents) {
        const doc = documents.find(d => d._id === graph.anchor.id);
        if (doc) {
          const docIndex = documents.indexOf(doc);
          basePosition = { x: 50, y: 50 + docIndex * 400 };
        }
      } else if (graph.anchor.type === "concept" && concepts) {
        const parentConcept = concepts.find(c => c._id === graph.anchor.id);
        if (parentConcept?.documentId && documents) {
          const doc = documents.find(d => d._id === parentConcept.documentId);
          if (doc) {
            const docIndex = documents.indexOf(doc);
            const docConcepts = concepts.filter(c => c.documentId === doc._id);
            const conceptIndex = docConcepts.indexOf(parentConcept);
            basePosition = { x: 400, y: 50 + docIndex * 400 + conceptIndex * 80 };
          }
        } else {
          basePosition = { x: 800, y: 50 };
        }
      }
      
      // Estimate response node position based on its order in the graph
      const nodeIndex = graph.nodes.indexOf(responseNode);
      const responsePosition = {
        x: basePosition.x + 250,
        y: basePosition.y + 50 + nodeIndex * 40,
      };
      
      return {
        nodeId: `response-${responseNode.id}`,
        position: responsePosition,
      };
    }
  }
  
  return null;
}

/**
 * Build ReactFlow nodes and edges from documents, concepts, and response graphs
 */
export function buildGraphElements(
  documents: Document[],
  concepts: Concept[],
  responseGraphs: Map<string, ResponseGraph>,
  selectedId?: string | null,
  onNodeClick?: (nodeId: string, nodeType: string, extra?: { chatId?: string }) => void
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
    const conceptX = 400;
    
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
        target: conceptNodeId,
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
          onNodeClick
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
        onNodeClick
      );
      nodes.push(...responseNodes);
      edges.push(...responseEdges);
    }
    
    docY += docSpacing;
  });
  
  // Add standalone concepts (not from documents) and chat-sourced concepts
  const standaloneConcepts = concepts.filter(c => !c.documentId);
  let standaloneY = 50;
  
  standaloneConcepts.forEach((concept) => {
    const conceptNodeId = `concept-${concept._id}`;
    
    // Check if this concept was derived from a chat message
    const sourceInfo = findSourceResponseNode(responseGraphs, concept, documents, concepts);
    
    let conceptPosition;
    if (sourceInfo) {
      // Position relative to source response node
      conceptPosition = { 
        x: sourceInfo.position.x + 350, 
        y: sourceInfo.position.y 
      };
      
      // Create edge from source response to concept
      edges.push({
        id: `${sourceInfo.nodeId}-${conceptNodeId}`,
        source: sourceInfo.nodeId,
        target: conceptNodeId,
        type: "smoothstep",
        style: { 
          stroke: "#10b981", 
          strokeWidth: 2,
          strokeDasharray: "5,5"
        },
        label: "concept",
        labelStyle: {
          fontSize: 11,
          fill: "#10b981",
        },
        labelBgStyle: {
          fill: "#f0fdf4",
          fillOpacity: 0.9,
        },
      });
    } else {
      // Standalone concept (not from documents or chats)
      conceptPosition = { x: 800, y: standaloneY };
      standaloneY += 200;
    }
    
    nodes.push({
      id: conceptNodeId,
      type: "conceptNode",
      position: conceptPosition,
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
      const responseStartPosition = {
        x: conceptPosition.x + 250,
        y: conceptPosition.y,
      };
      
      const { responseNodes, responseEdges } = buildResponseSubgraph(
        responseGraph,
        conceptNodeId,
        responseStartPosition,
        selectedId,
        onNodeClick
      );
      nodes.push(...responseNodes);
      edges.push(...responseEdges);
    }
  });
  
  // Add free chats (chats without anchors)
  const freeChats: { graph: ResponseGraph; chatId: string }[] = [];
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
    const freeChatY = Math.max(docY, standaloneY) + 100;
    
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
        onNodeClick
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
  onNodeClick?: (nodeId: string, nodeType: string, extra?: { chatId?: string }) => void
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
  
  graph.nodes.forEach((node) => {
    const nodeId = `response-${node.id}`;
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
      type: "smoothstep",
      label: edge.label,
      data: { promptId: edge.promptId, prompt: edge.prompt },
      labelStyle: {
        fontSize: 11,
        fill: "#64748b",
      },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 4,
      labelBgStyle: {
        fill: "#f1f5f9",
        fillOpacity: 0.9,
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
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: "TB",
    nodesep: 80,
    ranksep: 100,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: node.type === "responseNode" ? 20 : 300,
      height: node.type === "responseNode" ? 20 : 100,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: nodeWithPosition.x - (node.type === "responseNode" ? 10 : 150),
        y: nodeWithPosition.y - (node.type === "responseNode" ? 10 : 50),
      },
    };
  });
}