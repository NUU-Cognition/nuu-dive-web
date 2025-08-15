"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportButtonProps {
  chatId: string;
  messages: any[];
  currentMessageId?: string;
}

export default function ExportButton({ 
  chatId, 
  messages, 
  currentMessageId 
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "markdown" | "json") => {
    setIsExporting(true);
    
    try {
      // Build the conversation thread
      const leafMessage = currentMessageId 
        ? messages.find(m => m._id === currentMessageId)
        : messages[messages.length - 1];
      
      if (!leafMessage) {
        console.error("No message to export");
        return;
      }

      // Build path from leaf to root
      const path: typeof messages = [];
      let current = leafMessage;
      
      while (current) {
        path.unshift(current);
        current = messages.find(m => m._id === current.parentMessageId);
      }

      if (format === "markdown") {
        // Generate markdown
        const markdown = generateMarkdown(path);
        
        // Download file
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dive-export-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Export as JSON
        const json = JSON.stringify(path, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dive-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="ml-2">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("markdown")}>
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function generateMarkdown(messages: any[]): string {
  const lines: string[] = [];
  
  // Header
  lines.push("# Dive Export");
  lines.push("");
  lines.push(`**Date:** ${new Date().toLocaleDateString()}`);
  lines.push(`**Messages:** ${messages.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  
  // Messages
  messages.forEach((message, index) => {
    const roleLabel = 
      message.role === "user" ? "**You**" :
      message.role === "assistant" ? "**Assistant**" :
      message.role === "note" ? "**Note**" :
      "**System**";
    
    lines.push(`### ${roleLabel}`);
    lines.push("");
    lines.push(message.content);
    lines.push("");
    
    if (index < messages.length - 1) {
      lines.push("---");
      lines.push("");
    }
  });
  
  return lines.join("\n");
}