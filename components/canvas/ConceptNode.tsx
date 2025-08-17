"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { FileText, Link2, MessageSquare, StickyNote, ChevronDown, ChevronRight } from "lucide-react";

interface ConceptNodeProps {
  data: {
    title: string;
    snippet: string;
    sourceType: "url" | "pdf" | "chat";
    selected: boolean;
    hasNote?: boolean;
    onDoubleClick?: () => void;
    onToggleCollapse?: () => void;
    onClick?: () => void;
    isCollapsed?: boolean;
    hasChildren?: boolean;
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
        className={`rounded-xl border-2 bg-background p-4 shadow-sm transition-all cursor-pointer group relative ${
          data.selected 
            ? "border-primary ring-2 ring-primary/20" 
            : "border-border hover:border-primary/50 hover:shadow-md"
        }`}
        style={{ width: 200 }}
        onDoubleClick={data.onDoubleClick}
        onClick={data.onClick}
        title="Double-click to edit note"
      >
        {/* Collapse button - appears on hover when there are children */}
        {data.hasChildren && (
          <button
            className="absolute -right-2 -top-2 bg-background border border-border rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent z-10"
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleCollapse?.();
            }}
            title={data.isCollapsed ? "Expand responses" : "Collapse responses"}
          >
            {data.isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}

        <div className="flex justify-between">
          {/* Left side - Text content */}
          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-lg truncate">
              {data.title}
            </h2>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0">
              {data.snippet}
            </p>
          </div>
          
          {/* Right side - Icons stacked vertically */}
          <div className="flex flex-col items-end gap-2 ml-2">
            {/* Chat/Source type icon aligned with title */}
            <div className="-mt-0">
              {data.sourceType === "url" ? (
                <Link2 className="h-4 w-4 text-muted-foreground" />
              ) : data.sourceType === "chat" ? (
                <MessageSquare className="h-4 w-4 text-green-600" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            {/* Note indicator below - bigger size */}
            <div title={data.hasNote ? "Has note" : "No note yet"}>
              {data.hasNote ? (
                <StickyNote className="h-4 w-4 text-blue-500 fill-current" />
              ) : (
                <StickyNote className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" />
              )}
            </div>
          </div>
        </div>
        
        {/* Subtle hint text that appears on hover */}
        <div className="mt-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity">
          Double-click to edit note
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