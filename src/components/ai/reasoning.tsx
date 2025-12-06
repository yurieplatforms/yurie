"use client";

import { cn } from "@/lib/utils";
import { Search, Globe, History, Calculator, Sparkles, Link2 } from "lucide-react";
import type { ReactNode } from "react";
import { Shimmer } from "./shimmer";
import type { ToolUseEvent } from "@/lib/types";

const toolLabels: Record<string, string> = {
  web_search: 'Searching',
  web_fetch: 'Fetching',
  composio_search_web: 'Browsing',
  calculator: 'Calculating',
};

const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  web_search: Search,
  web_fetch: Globe,
  composio_search_web: Search,
  calculator: Calculator,
};

// Keep toolIcons export for potential future use
void toolIcons;

export type ReasoningProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Whether the model is currently streaming reasoning tokens.
   */
  isStreaming?: boolean;
  /**
   * Tool uses to display dynamic status in the trigger
   */
  toolUses?: ToolUseEvent[];
  /**
   * Whether the model is currently loading/streaming
   */
  isLoading?: boolean;
};

export function Reasoning({
  isStreaming: _isStreaming,
  toolUses: _toolUses,
  isLoading: _isLoading,
  className,
  children,
  ...props
}: ReasoningProps) {
  // Note: toolUses and isLoading are passed via props for future use
  // but the actual display logic is handled by children components
  void _toolUses;
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
  toolUses?: ToolUseEvent[];
  isLoading?: boolean;
  thinkingLabel?: ReactNode;
};

export function ReasoningTrigger({
  title: _title = "Thought",
  className,
  label: _label,
  toolUses,
  isLoading,
  thinkingLabel,
  ...props
}: ReasoningTriggerProps) {
  // Suppress unused vars
  void _title;
  void _label;

  // Determine what to show based on tool use status
  const activeTools = toolUses?.filter((t) => t.status === 'start') ?? [];
  const hasActiveTools = activeTools.length > 0 && isLoading;

  // Get the current active tool for display
  const currentActiveTool = activeTools[activeTools.length - 1];
  const activeToolLabel = currentActiveTool 
    ? toolLabels[currentActiveTool.name] || `Using ${currentActiveTool.name.replace(/_/g, ' ').replace(/github/i, 'GitHub')}`
    : null;

  // Build dynamic label - only show when actively thinking or using tools
  let dynamicLabel: ReactNode = null;

  if (hasActiveTools && activeToolLabel) {
    // Show active tool with shimmer
    dynamicLabel = <Shimmer className="text-base">{activeToolLabel}</Shimmer>;
  } else if (thinkingLabel) {
    // Show thinking label (shimmer while thinking)
    dynamicLabel = thinkingLabel;
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
