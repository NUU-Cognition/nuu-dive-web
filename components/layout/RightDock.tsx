"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type RightDockProps = {
  /** Unique key for localStorage persistence */
  storageKey?: string;
  /** Label shown on the collapsed tab */
  label?: string;
  /** Initial width in px */
  defaultWidth?: number;
  /** Min/max widths in px */
  minWidth?: number;
  maxWidth?: number;
  /** Children (chat panel, etc.) */
  children: React.ReactNode;
  /** Optional className for the content container */
  className?: string;
};

export default function RightDock({
  storageKey = "dock.chat",
  label = "Chat",
  defaultWidth = 560,
  minWidth = 320,
  maxWidth = 800,
  children,
  className,
}: RightDockProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [collapsed, setCollapsed] = useState(false);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Load persisted state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { width?: number; collapsed?: boolean };
        if (typeof parsed.width === "number") {
          setWidth(Math.min(Math.max(parsed.width, minWidth), maxWidth));
        }
        if (typeof parsed.collapsed === "boolean") {
          setCollapsed(parsed.collapsed);
        }
      } else {
        // Mobile-friendly default: collapse if viewport is narrow
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
          setCollapsed(true);
        }
      }
    } catch {}
  }, [storageKey, minWidth, maxWidth]);

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ width, collapsed }));
    } catch {}
  }, [storageKey, width, collapsed]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    // Mouse move on window to keep resizing outside the panel
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const dx = startXRef.current - ev.clientX; // dragging left handle to left increases width
      const next = Math.min(Math.max(startWidthRef.current + dx, minWidth), maxWidth);
      setWidth(next);
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [minWidth, maxWidth, width]);

  return (
    <div className="relative h-full flex-shrink-0">
      {/* Collapsed tab */}
      {collapsed ? (
        <button
          aria-label={`Open ${label} panel`}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-l-md border bg-background px-2 py-3 shadow hover:bg-accent transition"
          onClick={() => setCollapsed(false)}
        >
          <div className="flex flex-col items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span className="text-[10px] writing-vertical-lr rotate-180">
              {label}
            </span>
          </div>
        </button>
      ) : (
        <div
          className={cn(
            "h-full border-l bg-background relative flex flex-col",
            className
          )}
          style={{ width }}
          role="complementary"
          aria-label={`${label} panel`}
        >
          {/* Resize handle (left edge) */}
          <div
            role="separator"
            aria-label={`Resize ${label} panel`}
            tabIndex={0}
            onMouseDown={onMouseDown}
            className={cn(
              "absolute left-0 top-0 h-full w-1 cursor-col-resize",
              "bg-transparent hover:bg-border/60 transition"
            )}
          />

          {/* Collapse button (small, overlaid near top-right) */}
          <button
            aria-label={`Collapse ${label} panel`}
            className="absolute -right-3 top-3 z-10 rounded-full border bg-background p-1 shadow hover:bg-accent transition"
            onClick={() => setCollapsed(true)}
            title="Collapse"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="h-full w-full overflow-hidden">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}