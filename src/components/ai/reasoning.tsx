"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { ToolUseStatus } from "@/lib/types";
import { StatusShimmer } from "@/components/ai/shimmer";

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
  /** Active tool use status to display */
  activeToolUse?: ToolUseStatus | null;
  /** Tool use label component (for custom rendering) */
  toolUseLabel?: ReactNode;
};

/**
 * Get display name for a tool
 */
function getToolDisplayName(tool: string): string {
  // Normalize tool name for comparison
  const normalizedTool = tool.toLowerCase().replace(/\s+/g, '_');
  
  switch (normalizedTool) {
    case 'web_search':
      return 'Searching the web';
    case 'code_interpreter':
      return 'Running code';
    case 'file_search':
      return 'Searching files';
    case 'image_generation':
      return 'Generating an image';
    case 'gmail_fetch_emails':
      return 'Fetching emails';
    case 'gmail_send_email':
      return 'Sending email';
    case 'gmail_create_email_draft':
      return 'Creating draft';
    default:
      // Handle other Gmail tools or unknown tools
      if (normalizedTool.startsWith('gmail_')) {
        return 'Using Gmail';
      }
      // Return the tool name as-is if it's already nicely formatted
      // (e.g., "Web search" becomes "Searching" not "Using Web search")
      return tool;
  }
}

export function ReasoningTrigger({
  title: _title = "Thought",
  className,
  label,
  isLoading: _isLoading,
  thinkingLabel,
  activeToolUse,
  toolUseLabel,
  ...props
}: ReasoningTriggerProps) {
  // Suppress unused vars
  void _title;
  void _isLoading;

  // Build dynamic label - prioritize tool use over thinking
  let dynamicLabel: ReactNode = null;

  if (toolUseLabel) {
    // Custom tool use label
    dynamicLabel = toolUseLabel;
  } else if (activeToolUse && (activeToolUse.status === 'in_progress' || activeToolUse.status === 'searching')) {
    // Active tool use display with dynamic shimmer label
    const displayName = getToolDisplayName(activeToolUse.tool);
    dynamicLabel = <StatusShimmer>{displayName}</StatusShimmer>;
  } else if (thinkingLabel) {
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

// Re-export the shimmer components for external use
export { StatusShimmer } from "@/components/ai/shimmer";
