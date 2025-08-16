"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

interface ResponseNodeData {
  content: string;
  createdAt: number;
  tokenCount?: number;
  selected?: boolean;
  onClick?: () => void;
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

      {/* Response dot */}
      <div
        className={`
          w-2.5 h-2.5 rounded-full transition-all
          ${selected 
            ? "bg-primary ring-2 ring-primary/40 scale-125" 
            : "bg-black dark:bg-white dark:opacity-90 hover:ring-2 hover:ring-primary/20"
          }
        `}
        title={preview}
      />

      {/* Tooltip on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 
                      opacity-0 group-hover:opacity-100 pointer-events-none
                      transition-opacity z-50">
        <div className="bg-popover text-popover-foreground rounded-md
                        shadow-md border px-3 py-2 max-w-[280px]">
          <p className="text-xs whitespace-pre-wrap line-clamp-4">
            {preview}
          </p>
          {data.tokenCount && (
            <p className="text-xs text-muted-foreground mt-1">
              {data.tokenCount} tokens
            </p>
          )}
        </div>
      </div>

      {/* Output handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-0 !w-3 !h-3"
      />
    </div>
  );
}

export default memo(ResponseNode);