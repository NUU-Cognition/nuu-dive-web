"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FileText, Link2, MessageCircle, Hash } from "lucide-react";

function hostname(url?: string) {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

interface DocumentNodeData {
  title: string;
  kind: "url" | "pdf";
  url?: string;
  responseCount: number;
  conceptCount: number;
  selected?: boolean;
  onOpen?: () => void;
}

function DocumentNode({ data, selected }: NodeProps<DocumentNodeData>) {
  return (
    <div
      className={`
        rounded-lg border bg-background p-4 shadow-sm transition-all
        ${selected ? "ring-2 ring-primary/40 shadow-md" : "hover:shadow-md"}
        min-w-[280px] max-w-[320px]
      `}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !w-2 !h-2"
      />

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="mt-0.5">
          {data.kind === "url" ? (
            <Link2 className="h-5 w-5 text-muted-foreground" />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate" title={data.title}>
            {data.title}
          </h3>
          {data.url && (
            <p className="text-xs text-muted-foreground truncate mt-1" title={data.url}>
              {hostname(data.url) ?? data.url}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <MessageCircle className="h-3 w-3" />
          <span>{data.responseCount} responses</span>
        </div>
        <div className="flex items-center gap-1">
          <Hash className="h-3 w-3" />
          <span>{data.conceptCount} concepts</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={data.onOpen}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md
                     bg-primary text-primary-foreground hover:bg-primary/90
                     transition-colors"
          title="Open in main panel"
        >
          Open Document
        </button>
      </div>

      {/* Output handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !w-2 !h-2"
      />
    </div>
  );
}

export default memo(DocumentNode);