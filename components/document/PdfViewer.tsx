"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import CreateConceptDialog from "@/components/concept/CreateConceptDialog";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Import styles
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

type ExistingHighlight = {
  pageIndex: number;
  rect: { x: number; y: number; w: number; h: number };
  color?: string;
};

export default function PdfViewer({
  documentId,
  fileId,
  externalUrl,
  fileName,
  existingHighlights = [],
}: {
  documentId: string;
  fileId?: string;
  externalUrl?: string;
  fileName: string;
  existingHighlights?: ExistingHighlight[];
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [currentPageDimensions, setCurrentPageDimensions] = useState<{ width: number; height: number } | null>(null);

  // If the file is in Convex storage, fetch a signed URL
  const signedUrl = useQuery(
    api.files.getUrl,
    fileId ? ({ fileId: fileId as Id<"_storage"> }) : "skip"
  ) as string | null | undefined;

  // For testing, use a sample PDF if no URL is provided
  // Note: External PDFs may have CORS issues. For production, upload PDFs to Convex storage
  const fileUrl = externalUrl || signedUrl || "";

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  function onPageLoadSuccess({ width, height }: { width: number; height: number }) {
    setCurrentPageDimensions({ width, height });
  }

  // Handle text selection
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString());
      setCreateOpen(true);
    }
  };

  if (!fileUrl) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-sm text-muted-foreground">
            No PDF loaded yet.
          </div>
          <div className="text-xs text-muted-foreground">
            <p className="mb-2">To test PDF functionality:</p>
            <ol className="text-left space-y-1">
              <li>1. Upload a PDF file (coming soon)</li>
              <li>2. Or use a CORS-enabled PDF URL</li>
              <li>3. Select text to create concepts</li>
            </ol>
          </div>
          <div className="text-xs text-muted-foreground">
            Note: External PDFs may be blocked by CORS. For production, upload PDFs to Convex storage.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* PDF Controls */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {pageNumber} of {numPages || "..."}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPageNumber(Math.min(numPages || 1, pageNumber + 1))}
            disabled={pageNumber >= (numPages || 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setScale(Math.min(2, scale + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Document */}
      <div 
        className="flex-1 overflow-auto flex justify-center bg-muted/10"
        onMouseUp={handleTextSelection}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse">Loading PDF...</div>
            </div>
          }
          error={
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground">Failed to load PDF</div>
            </div>
          }
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            onLoadSuccess={onPageLoadSuccess}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
          
          {/* Render existing highlights as overlays */}
          {currentPageDimensions && existingHighlights
            .filter(h => h.pageIndex === pageNumber - 1)
            .map((highlight, idx) => (
              <div
                key={idx}
                className="absolute pointer-events-none bg-amber-300/25"
                style={{
                  left: `${highlight.rect.x * currentPageDimensions.width * scale}px`,
                  top: `${highlight.rect.y * currentPageDimensions.height * scale}px`,
                  width: `${highlight.rect.w * currentPageDimensions.width * scale}px`,
                  height: `${highlight.rect.h * currentPageDimensions.height * scale}px`,
                }}
              />
            ))}
        </Document>
      </div>

      {/* Create Concept dialog */}
      <CreateConceptDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialSnippet={selectedText}
        sourceType="pdf"
        documentId={documentId}
        pdfId={fileId}
        pdfMeta={{
          fileName,
          page: pageNumber - 1, // 0-indexed for storage
        }}
        contextInfo={`From page ${pageNumber} of ${fileName}`}
        onSuccess={() => {
          setSelectedText("");
        }}
      />
    </div>
  );
}