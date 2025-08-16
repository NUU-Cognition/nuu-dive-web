"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

interface ResponseNodeData {
  content: string;
  createdAt: number;
  tokenCount?: number;
  selected?: boolean;
  onClick?: () => void;
  loading?: boolean;
  isInPath?: boolean;
  hasSelection?: boolean;
}

function ResponseNode({ data, selected }: NodeProps<ResponseNodeData>) {
  // Extract first 120 chars for tooltip
  const preview = data.content.length > 200
    ? data.content.substring(0, 117) + "..."
    : data.content;

  const { isInPath, hasSelection } = data;

  return (
    <div
      className="relative group cursor-pointer"
      onClick={data.onClick}
    >
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

      {/* Response dot / Loading spinner */}
      <div className="relative w-3.5 h-3.5" title={data.loading ? "Generating…" : preview}>
        {data.loading ? (
          <>
            <div
              className={`
                absolute inset-0 rounded-full border-2 border-muted-foreground/40 
                border-t-primary animate-spin transition-opacity
                ${selected ? "opacity-100" : "opacity-90"}
              `}
            />
            <div
              className={`
                absolute inset-[3px] rounded-full bg-background
                ${selected ? "ring-2 ring-primary/30" : ""}
              `}
            />
          </>
        ) : (
          <div
            className={`
              absolute inset-0 rounded-full transition-all
              ${isInPath 
            ? "bg-primary ring-4 ring-primary/60 scale-150 shadow-lg" 
            : selected 
                  ? "bg-primary ring-2 ring-primary/40 scale-110"
                  : hasSelection
                ? "bg-black/30 dark:bg-white/30 scale-90" // Dimmed when something else is selected
                : "bg-black dark:bg-white dark:opacity-90 hover:ring-2 hover:ring-primary/20"
              }
            `}
          />
        )}
      </div>

      {/* Tooltip on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 
                      opacity-0 group-hover:opacity-100 pointer-events-none
                      transition-opacity z-50">
        <div className="glass-frosted min-w-[100px] min-h-[50px] p-10">
          <p className="text-base text-ice-500 whitespace-pre-wrap line-clamp-4">
            {data.loading ? "Generating…" : preview}
          </p>
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
    </div>
  );
}

export default memo(ResponseNode);