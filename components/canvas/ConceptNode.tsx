"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { FileText, Link2, MessageSquare, StickyNote } from "lucide-react";

interface ConceptNodeProps {
  data: {
    title: string;
    snippet: string;
    sourceType: "url" | "pdf" | "chat";
    selected: boolean;
    hasNote?: boolean;
    onDoubleClick?: () => void;
  };
}

const ConceptNode = memo(({ data }: ConceptNodeProps) => {
  return (
    <>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-primary"
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!bg-primary"
      />
      <div
        className={`rounded-xl border-2 bg-background p-4 shadow-sm transition-all cursor-pointer group ${
          data.selected 
            ? "border-primary ring-2 ring-primary/20" 
            : "border-border hover:border-primary/50 hover:shadow-md"
        }`}
        style={{ width: 200 }}
        onDoubleClick={data.onDoubleClick}
        title="Double-click to edit note"
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5">
            {data.sourceType === "url" ? (
              <Link2 className="h-4 w-4 text-muted-foreground" />
            ) : data.sourceType === "chat" ? (
              <MessageSquare className="h-4 w-4 text-green-600" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">
              {data.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {data.snippet}
            </p>
          </div>
          {/* Visual indicator for note functionality */}
          <div className="mt-0.5" title={data.hasNote ? "Has note" : "No note yet"}>
            {data.hasNote ? (
              <StickyNote className="h-3 w-3 text-blue-500 fill-current" />
            ) : (
              <StickyNote className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" />
            )}
          </div>
        </div>
        
        {/* Subtle hint text that appears on hover */}
        <div className="mt-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity">
          Double-click to edit note
        </div>
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-primary"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!bg-primary"
      />
    </>
  );
});

ConceptNode.displayName = "ConceptNode";

export default ConceptNode;