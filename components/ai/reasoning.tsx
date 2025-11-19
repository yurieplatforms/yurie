"use client";

import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type ReasoningProps = React.ComponentProps<typeof Collapsible> & {
  /**
   * Whether the model is currently streaming reasoning tokens.
   * When true, the panel auto-opens; when streaming finishes once,
   * it auto-closes, but users can always manually reopen it.
   */
  isStreaming?: boolean;
};

export function Reasoning({
  isStreaming,
  className,
  children,
  ...props
}: ReasoningProps) {
  const [open, setOpen] = useState<boolean>(Boolean(isStreaming));
  const wasStreamingRef = useRef<boolean>(false);

  // Auto-open while streaming, auto-close once when streaming finishes.
  useEffect(() => {
    if (isStreaming) {
      setOpen(true);
      wasStreamingRef.current = true;
      return;
    }

    if (!isStreaming && wasStreamingRef.current) {
      setOpen(false);
      wasStreamingRef.current = false;
    }
  }, [isStreaming]);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "group rounded-lg border bg-muted/40 shadow-sm dark:border-zinc-800",
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
};

export function ReasoningTrigger({
  title = "Thought",
  className,
  label,
  ...props
}: ReasoningTriggerProps) {
  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-2 px-3 py-2 text-[11px] font-medium tracking-wide text-zinc-500 transition-colors cursor-pointer",
        "hover:text-zinc-900 dark:hover:text-zinc-100",
        className
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-1.5">
        <Lightbulb className="h-4 w-4" />
        {label ?? <span className="text-base">{title}</span>}
      </span>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-normal text-zinc-400">
        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </span>
    </CollapsibleTrigger>
  );
}

export type ReasoningContentProps = React.ComponentProps<
  typeof CollapsibleContent
>;

export function ReasoningContent({
  className,
  ...props
}: ReasoningContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        "border-t px-3 py-2 dark:border-zinc-800",
        "data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down",
        className
      )}
      {...props}
    />
  );
}


