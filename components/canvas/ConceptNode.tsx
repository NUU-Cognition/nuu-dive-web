"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { FileText, Link2, MessageSquare } from "lucide-react";

interface ConceptNodeProps {
  data: {
    title: string;
    snippet: string;
    sourceType: "url" | "pdf" | "chat";
    selected: boolean;
  };
}

const ConceptNode = memo(({ data }: ConceptNodeProps) => {
  return (
    <>
      {/* Hidden handles for edge connections */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!opacity-0 !pointer-events-none"
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!opacity-0 !pointer-events-none"
      />
      <div
        className={`rounded-xl border-2 bg-background p-4 shadow-sm transition-all ${
          data.selected 
            ? "border-primary ring-2 ring-primary/20" 
            : "border-border hover:border-primary/50"
        }`}
        style={{ width: 200 }}
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
        </div>
      </div>
      {/* Hidden handles for edge connections */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!opacity-0 !pointer-events-none"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!opacity-0 !pointer-events-none"
      />
    </>
  );
});

ConceptNode.displayName = "ConceptNode";

export default ConceptNode;