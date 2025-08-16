import { cn } from "@/lib/utils";
import React from "react";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/50 dark:bg-muted/30",
        className
      )}
    />
  );
}

export default Skeleton;