"use client";

import { Button } from "@/components/ui/button";
import { GitBranch, User, Bot, FileText, Copy, MoreVertical, Sparkles, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Message {
  _id: string;
  role: "system" | "user" | "assistant" | "note";
  content: string;
  parentMessageId?: string;
  depth: number;
  createdAt: number;
}

interface MessageItemProps {
  message: Message;
  isLatest: boolean;
  onBranch: () => void;
  onCopy: () => void;
  onExtractConcept: () => void;
  depth: number;
}

export default function MessageItem({ 
  message, 
  isLatest, 
  onBranch,
  onCopy,
  onExtractConcept,
  depth 
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";
  const isUser = message.role === "user";
  const isNote = message.role === "note";

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className={`group relative flex gap-3 ${
        depth > 0 ? `ml-${Math.min(depth * 4, 16)}` : ""
      }`}
      style={{ marginLeft: depth > 0 ? `${depth * 16}px` : 0 }}
    >
      {/* Branch indicator for nested messages */}
      {depth > 0 && (
        <div className="absolute -left-3 top-4 h-px w-3 bg-border" />
      )}

      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
          isUser ? "bg-primary text-primary-foreground" :
          isAssistant ? "bg-secondary" :
          "bg-muted"
        }`}>
          {isUser ? (
            <User className="h-4 w-4" />
          ) : isAssistant ? (
            <Bot className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isUser ? "You" : isAssistant ? "Assistant" : "Note"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(message.createdAt, { addSuffix: true })}
          </span>
          {depth > 0 && (
            <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              Branch
            </span>
          )}
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none">
          {isNote || isAssistant ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isAssistant && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBranch}
              className="h-7 text-xs"
            >
              <GitBranch className="mr-1 h-3 w-3" />
              Branch
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>

          {(isAssistant || isUser) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExtractConcept}
              className="h-7 text-xs"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              Extract
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="mr-2 h-3 w-3" />
                Copy
              </DropdownMenuItem>
              {isAssistant && (
                <DropdownMenuItem onClick={onBranch}>
                  <GitBranch className="mr-2 h-3 w-3" />
                  Branch from here
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onExtractConcept}>
                <Sparkles className="mr-2 h-3 w-3" />
                Extract as Concept
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}