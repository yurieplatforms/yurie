"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type ReasoningProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Whether the model is currently streaming reasoning tokens.
   */
  isStreaming?: boolean;
  /**
   * Whether the model is currently loading/streaming
   */
  isLoading?: boolean;
};

export function Reasoning({
  isStreaming: _isStreaming,
  isLoading: _isLoading,
  className,
  children,
  ...props
}: ReasoningProps) {
  // Note: isLoading are passed via props for future use
  // but the actual display logic is handled by children components
  void _isLoading;
  void _isStreaming;

  return (
    <div
      className={cn(
        "w-full",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type ReasoningTriggerProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  label?: ReactNode;
  isLoading?: boolean;
  thinkingLabel?: ReactNode;
};

export function ReasoningTrigger({
  title: _title = "Thought",
  className,
  label,
  isLoading: _isLoading,
  thinkingLabel,
  ...props
}: ReasoningTriggerProps) {
  // Suppress unused vars
  void _title;
  void _isLoading;

  // Build dynamic label - only show when actively thinking
  let dynamicLabel: ReactNode = null;

  if (thinkingLabel) {
    // Show thinking label (shimmer while thinking)
    dynamicLabel = thinkingLabel;
  } else if (label) {
    dynamicLabel = label;
  }

  // Don't render anything if there's no active status to show
  if (!dynamicLabel) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex w-full items-start gap-2 py-2 text-base font-medium text-zinc-500 select-none",
        className
      )}
      {...props}
    >
      {dynamicLabel}
    </div>
  );
}

export type ReasoningContentProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export function ReasoningContent({
  className,
  children,
  ...props
}: ReasoningContentProps) {
  return (
    <div
      className={cn(
        "hidden sm:block py-2",
        className
      )}
      {...props}
    >
      <div className="text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
