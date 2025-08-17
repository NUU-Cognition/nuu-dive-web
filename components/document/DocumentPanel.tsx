"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { X, FileText, Link2, ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });

interface DocumentPanelProps {
  documentId: string;
  onClose: () => void;
  /** "main" replaces canvas; "dock" is the old narrow panel */
  layout?: "main" | "dock";
}

export default function DocumentPanel({ documentId, onClose, layout = "dock" }: DocumentPanelProps) {
  
  // Get document details
  const document = useQuery(
    api.documents.get,
    { documentId: documentId as Id<"documents"> }
  );
  
  const outerClass =
    layout === "main"
      ? "flex-1 min-w-0 border-r bg-background h-full flex flex-col"
      : "w-[400px] border-l bg-background h-full flex flex-col";

  if (!document) {
    return (
      <div className={outerClass + " flex items-center justify-center"}>
        <div className="animate-pulse">Loading document...</div>
      </div>
    );
  }
  
  return (
    <div className={outerClass}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {document.kind === "url" ? (
            <Link2 className="h-5 w-5 text-muted-foreground" />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground" />
          )}
          <h2 className="font-semibold text-sm truncate flex-1" title={document.title}>
            {document.title}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Document info */}
      <div className="px-4 py-3 border-b">
        {document.url && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Source:</span>
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {new URL(document.url).hostname}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span>{document.responseCount || 0} responses</span>
          <span>{document.conceptCount || 0} concepts</span>
        </div>
      </div>
      
      {/* Middle content - PDF viewer or existing responses */}
      <div className="flex-1 overflow-hidden min-w-0">
        {document.kind === "pdf" ? (
          <div className="h-full">
            <PdfViewer
              documentId={documentId}
              fileId={(document as { pdfId?: string }).pdfId}
              externalUrl={!(document as { pdfId?: string }).pdfId ? document.url : undefined}
              fileName={(document as { pdfMeta?: { fileName?: string } })?.pdfMeta?.fileName || document.title}
              existingHighlights={
                // Get highlights from concepts tied to this document
                []  // TODO: Query concepts and extract their highlights
              }
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-md text-center space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">View this page with Dive</h3>
                <p className="text-sm text-muted-foreground">
                  The embedded preview has been removed for better compatibility.
                  Use the Dive Chrome extension to highlight text and create concepts directly on any webpage.
                </p>
              </div>
              
              <div className="flex flex-col gap-3">
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Website
                </a>
                
                <Link
                  href="/settings/tokens"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  Get Extension Token
                </Link>
              </div>
              
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  With the extension installed, you can:
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 text-left">
                  <li>• Select any text to create concepts</li>
                  <li>• Chat about the current page</li>
                  <li>• See your highlights on return visits</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}