"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

interface ResponseNodeData {
  content: string;
  createdAt: number;
  tokenCount?: number;
  selected?: boolean;
  onClick?: () => void;
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
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-0 !w-3 !h-3"
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        className="!bg-transparent !border-0 !w-3 !h-3"
      />

      {/* Response dot */}
      <div
        className={`
          w-2.5 h-2.5 rounded-full transition-all
          ${isInPath 
            ? "bg-primary ring-4 ring-primary/60 scale-150 shadow-lg" 
            : selected 
              ? "bg-primary ring-2 ring-primary/40 scale-125" 
              : hasSelection
                ? "bg-black/30 dark:bg-white/30 scale-90" // Dimmed when something else is selected
                : "bg-black dark:bg-white dark:opacity-90 hover:ring-2 hover:ring-primary/20"
          }
        `}
        title={preview}
      />

      {/* Tooltip on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 
                      opacity-0 group-hover:opacity-100 pointer-events-none
                      transition-opacity z-50">
        <div className="glass-frosted min-w-[100px] min-h-[50px] p-10">
          <p className="text-base text-ice-500 whitespace-pre-wrap line-clamp-4">
            {preview}
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
        className="!bg-transparent !border-0 !w-3 !h-3"
      />
    </div>
  );
}

export default memo(ResponseNode);