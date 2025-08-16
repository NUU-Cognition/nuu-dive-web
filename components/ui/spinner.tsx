import { cn } from "@/lib/utils";
import React from "react";

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
};

export function Spinner({ size = "md", className, label }: SpinnerProps) {
  const dim = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        aria-label="Loading"
        className={cn(
          "animate-spin rounded-full border-2 border-primary/30 border-t-primary",
          dim
        )}
      />
      {label ? (
        <span className="text-sm text-muted-foreground">{label}</span>
      ) : null}
    </div>
  );
}

export default Spinner;