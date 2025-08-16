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
}

function ResponseNode({ data, selected }: NodeProps<ResponseNodeData>) {
  // Extract first 120 chars for tooltip
  const preview = data.content.length > 120 
    ? data.content.substring(0, 117) + "..."
    : data.content;

  return (
    <div
      className="relative group cursor-pointer"
      onClick={data.onClick}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-0 !w-3 !h-3"
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        className="!bg-primary"
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
              ${selected 
                ? "bg-primary ring-2 ring-primary/40 scale-110"
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

      {/* Output handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-0 !w-3 !h-3"
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        className="!bg-primary"
      />
    </div>
  );
}

export default memo(ResponseNode);