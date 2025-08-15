"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, GitBranch, Paperclip, Info, ChevronDown } from "lucide-react";
import MessageItem from "./MessageItem";
import ContextInspector from "./ContextInspector";

interface Message {
  _id: string;
  role: "system" | "user" | "assistant" | "note";
  content: string;
  parentMessageId?: string;
  depth: number;
  createdAt: number;
  children?: Message[];
}

interface ChatPanelProps {
  chatId: string;
  conceptId: string | null;
  onClose: () => void;
}

export default function ChatPanel({ chatId, conceptId, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextInspectorOpen, setContextInspectorOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock messages with tree structure
  useEffect(() => {
    const mockMessages: Message[] = [
      {
        _id: "m1",
        role: "note",
        content: "# Quantum Entanglement\n\n> When two particles become entangled, the quantum state of each particle cannot be described independently...\n\nSource: https://example.com/quantum",
        depth: 0,
        createdAt: Date.now() - 7200000,
      },
      {
        _id: "m2",
        role: "user",
        content: "What are the practical applications of quantum entanglement?",
        parentMessageId: "m1",
        depth: 1,
        createdAt: Date.now() - 7000000,
      },
      {
        _id: "m3",
        role: "assistant",
        content: "Quantum entanglement has several important practical applications:\n\n1. **Quantum Computing**: Entangled qubits enable quantum computers to perform certain calculations exponentially faster than classical computers.\n\n2. **Quantum Cryptography**: Quantum key distribution uses entanglement to create unbreakable encryption keys.\n\n3. **Quantum Teleportation**: Information about a quantum state can be transmitted using entangled particles.\n\n4. **Quantum Sensors**: Enhanced precision in measurements for applications like GPS and medical imaging.",
        parentMessageId: "m2",
        depth: 2,
        createdAt: Date.now() - 6800000,
      },
      {
        _id: "m4",
        role: "user",
        content: "Tell me more about quantum cryptography specifically.",
        parentMessageId: "m3",
        depth: 3,
        createdAt: Date.now() - 6600000,
      },
      {
        _id: "m5",
        role: "assistant",
        content: "Quantum cryptography, particularly Quantum Key Distribution (QKD), leverages the principles of quantum mechanics to ensure secure communication:\n\n**Key Principles:**\n- Uses quantum states (typically photons) to transmit encryption keys\n- Any attempt to intercept or measure the quantum states disturbs them\n- This disturbance is detectable, alerting parties to eavesdropping\n\n**BB84 Protocol:**\nThe most common QKD protocol, where:\n1. Sender encodes bits using different photon polarizations\n2. Receiver measures using randomly chosen bases\n3. They compare bases publicly and keep matching measurements\n4. Any eavesdropping introduces errors, revealing the intrusion\n\n**Current Applications:**\n- Banking and financial sectors for ultra-secure transactions\n- Government and military communications\n- Several countries have established quantum communication networks",
        parentMessageId: "m4",
        depth: 4,
        createdAt: Date.now() - 6400000,
      },
    ];
    setMessages(mockMessages);
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const newUserMessage: Message = {
      _id: `m${Date.now()}`,
      role: "user",
      content: inputValue,
      parentMessageId: messages[messages.length - 1]?._id,
      depth: messages.length,
      createdAt: Date.now(),
    };

    setMessages([...messages, newUserMessage]);
    setInputValue("");
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        _id: `m${Date.now() + 1}`,
        role: "assistant",
        content: "This is a simulated response. In production, this would stream from the LLM.",
        parentMessageId: newUserMessage._id,
        depth: messages.length + 1,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleBranch = (fromMessageId: string) => {
    setSelectedBranchId(fromMessageId);
    // In production, this would create a new branch in the conversation tree
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Chat</h2>
          {messages.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {messages.length} messages
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <MessageItem
              key={message._id}
              message={message}
              isLatest={index === messages.length - 1}
              onBranch={() => handleBranch(message._id)}
              depth={message.depth}
            />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-pulse">Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Context & Attachments Bar */}
      <div className="border-t px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setContextInspectorOpen(true)}
            className="text-xs"
          >
            <Info className="mr-1 h-3 w-3" />
            Context
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            <Paperclip className="mr-1 h-3 w-3" />
            Attach
          </Button>
        </div>
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Context Inspector */}
      <ContextInspector
        open={contextInspectorOpen}
        onClose={() => setContextInspectorOpen(false)}
        messages={messages}
      />
    </div>
  );
}