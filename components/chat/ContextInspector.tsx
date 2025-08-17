"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info, FileText, Link2, MessageSquare } from "lucide-react";

interface Message {
  _id: string;
  role: "system" | "user" | "assistant" | "note";
  content: string;
  parentMessageId?: string;
  depth: number;
  createdAt: number;
}

interface ContextInspectorProps {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  onSave?: (o: { includeIds?: string[]; excludeIds?: string[] }) => void;
  extractedContent?: string;
  documentTitle?: string;
  extractionLevel?: string;
}

export default function ContextInspector({
  open,
  onClose,
  messages,
  onSave,
  extractedContent,
  documentTitle,
  extractionLevel,
}: ContextInspectorProps) {

  const [includedMessageIds, setIncludedMessageIds] = useState<Set<string>>(
    new Set(messages.map((m) => m._id))
  );

  // Keep checkboxes in sync when messages change or dialog opens
  useEffect(() => {
    setIncludedMessageIds(new Set(messages.map((m) => m._id)));
  }, [messages, open]);

  const toggleMessageInclusion = (messageId: string) => {
    const newSet = new Set(includedMessageIds);
    if (newSet.has(messageId)) {
      newSet.delete(messageId);
    } else {
      newSet.add(messageId);
    }
    setIncludedMessageIds(newSet);
  };

  const handleSave = () => {
    const include = Array.from(includedMessageIds);
    const exclude = messages.map(m => m._id).filter(id => !includedMessageIds.has(id));
    onSave?.({ includeIds: include, excludeIds: exclude });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Context Inspector</DialogTitle>
          <DialogDescription>
            Control which messages and sources are included in the AI's context for the next response.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-lg bg-secondary/50 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4" />
              <span>
                {includedMessageIds.size} of {messages.length} messages included
              </span>
            </div>
          </div>

          {/* Messages */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Conversation History</h3>
            <ScrollArea className="h-[300px] rounded-lg border p-2">
              <div className="space-y-2">
                {messages.map((message) => (
                  <div
                    key={message._id}
                    className="flex items-start gap-2 rounded-lg p-2 hover:bg-accent"
                  >
                    <Checkbox
                      checked={includedMessageIds.has(message._id)}
                      onCheckedChange={() => toggleMessageInclusion(message._id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="h-3 w-3" />
                        <span className="text-xs font-medium">
                          {message.role === "user" ? "You" : 
                           message.role === "assistant" ? "Assistant" : 
                           message.role}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Depth: {message.depth}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Extracted Content */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Attached Sources</h3>
            <div className="space-y-2">
              {extractedContent ? (
                <div className="rounded-lg border p-3 bg-secondary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">extracted_content.md</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {(extractedContent.length / 1024).toFixed(1)}KB
                    </span>
                    {extractionLevel && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {extractionLevel} extraction
                        </span>
                      </>
                    )}
                  </div>
                  {documentTitle && (
                    <p className="text-xs text-muted-foreground mb-2">
                      From: {documentTitle}
                    </p>
                  )}
                  <ScrollArea className="h-[100px] rounded border bg-background p-2">
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                      {extractedContent.substring(0, 500)}
                      {extractedContent.length > 500 && '...'}
                    </pre>
                  </ScrollArea>
                  <p className="text-xs text-green-600 mt-1">
                    ✓ This content is included as context for the AI
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border p-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">No sources attached yet</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Context
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}