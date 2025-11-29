"use client";

import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, Wrench, Search, Globe, History, Code, Calculator, Terminal, FileCode, Play } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Shimmer } from "./shimmer";
import type { ToolUseEvent } from "@/lib/types";

const toolLabels: Record<string, string> = {
  web_search: 'Searching the web',
  web_fetch: 'Fetching page content',
  calculator: 'Calculating',
  memory: 'Recalling',
  memory_save: 'Saving to memory',
  memory_retrieve: 'Searching memory',
  run_code: 'Running code',
  code_execution: 'Executing code',
  bash_code_execution: 'Running command',
  text_editor_code_execution: 'Editing file',
};

const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  web_search: Search,
  web_fetch: Globe,
  calculator: Calculator,
  memory: History,
  memory_save: History,
  memory_retrieve: History,
  run_code: Code,
  code_execution: Play,
  bash_code_execution: Terminal,
  text_editor_code_execution: FileCode,
};

export type ReasoningProps = React.ComponentProps<typeof Collapsible> & {
  /**
   * Whether the model is currently streaming reasoning tokens.
   * When true, the panel auto-opens; when streaming finishes once,
   * it auto-closes, but users can always manually reopen it.
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
  isStreaming,
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
  const [open, setOpen] = useState<boolean>(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "group rounded-lg bg-muted/40",
        className
      )}
      {...props}
    >
      {children}
    </Collapsible>
  );
}

export type ReasoningTriggerProps = React.ComponentProps<
  typeof CollapsibleTrigger
> & {
  title?: string;
  label?: ReactNode;
  toolUses?: ToolUseEvent[];
  isLoading?: boolean;
  thinkingLabel?: ReactNode;
};

export function ReasoningTrigger({
  title = "Thought",
  className,
  label,
  toolUses,
  isLoading,
  thinkingLabel,
  ...props
}: ReasoningTriggerProps) {
  // Determine what to show based on tool use status
  const activeTools = toolUses?.filter((t) => t.status === 'start') ?? [];
  const hasActiveTools = activeTools.length > 0 && isLoading;

  // Get the current active tool for display
  const currentActiveTool = activeTools[activeTools.length - 1];
  const activeToolLabel = currentActiveTool 
    ? toolLabels[currentActiveTool.name] || `Using ${currentActiveTool.name}`
    : null;
  const ActiveToolIcon = currentActiveTool ? toolIcons[currentActiveTool.name] || Wrench : null;

  // Build dynamic label
  let dynamicLabel: ReactNode = label;
  let ToolIcon: React.ComponentType<{ className?: string }> | null = null;

  if (!label) {
    if (hasActiveTools && activeToolLabel) {
      // Show active tool with shimmer
      ToolIcon = ActiveToolIcon || Wrench;
      dynamicLabel = <Shimmer className="text-base">{activeToolLabel}</Shimmer>;
    } else if (thinkingLabel) {
      // Show thinking label (shimmer while thinking)
      dynamicLabel = thinkingLabel;
    } else {
      dynamicLabel = <span className="text-base">{title}</span>;
    }
  }

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium tracking-wide text-zinc-500 transition-colors cursor-pointer",
        "hover:text-zinc-900 dark:hover:text-zinc-100",
        className
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-zinc-100/90 dark:hover:bg-[#202020] transition-colors">
        {ToolIcon ? (
          <ToolIcon className="h-4 w-4" />
        ) : (
          <img src="/favicon.ico" alt="" className="h-5 w-5" />
        )}
        {dynamicLabel}
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90 text-zinc-400" />
      </span>
    </CollapsibleTrigger>
  );
}

export type ReasoningContentProps = React.ComponentProps<
  typeof CollapsibleContent
> & {
  children?: ReactNode;
};

export function ReasoningContent({
  className,
  children,
  ...props
}: ReasoningContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        "px-3 py-2",
        "data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down",
        className
      )}
      {...props}
    >
      <div className="relative pl-5 ml-[18px] border-l border-zinc-700/50">
        {children}
      </div>
    </CollapsibleContent>
  );
}
