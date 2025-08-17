"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, Copy } from "lucide-react";

interface ConceptCreationTooltipProps {
  isVisible: boolean;
  position: { x: number; y: number };
  selectedText: string;
  onCreateConcept: () => void;
  onClose: () => void;
}

export function ConceptCreationTooltip({
  isVisible,
  position,
  selectedText,
  onCreateConcept,
  onClose,
}: ConceptCreationTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Auto-hide tooltip after a delay
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Hide after 5 seconds of inactivity

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  // Handle clicks outside the tooltip and keyboard events
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isVisible) {
      // Add a small delay to avoid immediate closure when the tooltip appears
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
      }, 100);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, onClose]);

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  // Calculate tooltip position to ensure it stays within viewport
  const getTooltipStyle = () => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return { left: position.x, top: position.y };

    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = position.x;
    let top = position.y;

    // Adjust horizontal position if tooltip would go off-screen
    if (left + rect.width > viewportWidth - 20) {
      left = viewportWidth - rect.width - 20;
    }
    if (left < 20) {
      left = 20;
    }

    // Adjust vertical position if tooltip would go off-screen
    if (top + rect.height > viewportHeight - 20) {
      top = position.y - rect.height - 10; // Show above the cursor instead
    }
    if (top < 20) {
      top = 20;
    }

    return { left, top };
  };

  if (!isVisible) return null;

  const tooltipStyle = getTooltipStyle();

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 bg-white border border-border rounded-lg shadow-lg p-3 max-w-sm animate-in fade-in-0 zoom-in-95 duration-200"
      style={tooltipStyle}
    >
      {/* Header with selected text preview */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">Selected text:</p>
          <p className="text-sm font-medium line-clamp-3 leading-tight">
            {selectedText.length > 100 
              ? `${selectedText.substring(0, 100)}...` 
              : selectedText
            }
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 hover:bg-muted"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          onClick={onCreateConcept}
          size="sm"
          className="flex-1"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Concept
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="px-3"
          title="Copy to clipboard"
        >
          <Copy className="h-4 w-4" />
          {copied && (
            <span className="ml-1 text-xs">✓</span>
          )}
        </Button>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Create a concept from this text or copy it to clipboard
      </p>
    </div>
  );
}