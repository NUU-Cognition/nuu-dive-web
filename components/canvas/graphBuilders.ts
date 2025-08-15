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
  label: string;
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
  onNodeClick?: (nodeId: string, nodeType: string) => void
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
        onOpen: doc.url ? () => window.open(doc.url, "_blank") : undefined,
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
        onNodeClick
      );
      nodes.push(...responseNodes);
      edges.push(...responseEdges);
    }
    
    standaloneY += 200;
  });
  
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
  onNodeClick?: (nodeId: string, nodeType: string) => void
): { responseNodes: Node[]; responseEdges: Edge[] } {
  const responseNodes: Node[] = [];
  const responseEdges: Edge[] = [];
  
  // Use a simple vertical layout for responses
  let responseY = startPosition.y + 50;
  const responseSpacing = 40;
  
  graph.nodes.forEach((node, idx) => {
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
        onClick: () => onNodeClick?.(node.id, "response"),
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