"use client";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/components/ui/button-group";
import { cn } from "@/utils";
import type { FileUIPart, UIMessage } from "ai";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactElement } from "react";
import { createContext, memo, useContext, useEffect, useState, useMemo } from "react";
import { Streamdown } from "streamdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkCjkFriendlyGfmStrikethrough from "remark-cjk-friendly-gfm-strikethrough";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full flex-col gap-2",
      from === "user"
        ? "is-user ml-auto max-w-[80%] justify-end"
        : "is-assistant",
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> & {
  from?: UIMessage["role"];
};

export const MessageContent = ({
  children,
  className,
  from,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      // Match assistant text size (blog-style prose)
      "flex max-w-full flex-col gap-2 overflow-hidden text-base",
      from === "user"
        ? [
            // User bubble: align with blog card surfaces
            "w-fit ml-auto rounded-[26px] px-5 py-3.5 text-zinc-900 shadow-sm",
            "bg-zinc-100/90",
            // Dark mode bubble color override
            "dark:bg-[#262628] dark:text-zinc-50",
          ]
        : "w-full text-zinc-900 dark:text-zinc-100",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  return button;
};

type MessageBranchContextType = {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: ReactElement[];
  setBranches: (branches: ReactElement[]) => void;
};

const MessageBranchContext = createContext<MessageBranchContextType | null>(
  null
);

const useMessageBranch = () => {
  const context = useContext(MessageBranchContext);

  if (!context) {
    throw new Error(
      "MessageBranch components must be used within MessageBranch"
    );
  }

  return context;
};

export type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  defaultBranch?: number;
  onBranchChange?: (branchIndex: number) => void;
};

export const MessageBranch = ({
  defaultBranch = 0,
  onBranchChange,
  className,
  ...props
}: MessageBranchProps) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<ReactElement[]>([]);

  const handleBranchChange = (newBranch: number) => {
    setCurrentBranch(newBranch);
    onBranchChange?.(newBranch);
  };

  const goToPrevious = () => {
    const newBranch =
      currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  };

  const goToNext = () => {
    const newBranch =
      currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  };

  const contextValue: MessageBranchContextType = {
    currentBranch,
    totalBranches: branches.length,
    goToPrevious,
    goToNext,
    branches,
    setBranches,
  };

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div
        className={cn("grid w-full gap-2 [&>div]:pb-0", className)}
        {...props}
      />
    </MessageBranchContext.Provider>
  );
};

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageBranchContent = ({
  children,
  ...props
}: MessageBranchContentProps) => {
  const { currentBranch, setBranches, branches } = useMessageBranch();
  const childrenArray = useMemo(() => Array.isArray(children) ? children : [children], [children]);

  // Use useEffect to update branches when they change
  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return childrenArray.map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden"
      )}
      key={branch.key}
      {...props}
    >
      {branch}
    </div>
  ));
};

export type MessageBranchSelectorProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const MessageBranchSelector = ({
  className,
  ...props
}: MessageBranchSelectorProps) => {
  const { totalBranches } = useMessageBranch();

  // Don't render if there's only one branch
  if (totalBranches <= 1) {
    return null;
  }

  return (
    <ButtonGroup
      className={cn(
        "[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md",
        className
      )}
      orientation="horizontal"
      {...props}
    />
  );
};

export type MessageBranchPreviousProps = ComponentProps<typeof Button>;

export const MessageBranchPrevious = ({
  children,
  ...props
}: MessageBranchPreviousProps) => {
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  );
};

export type MessageBranchNextProps = ComponentProps<typeof Button>;

export const MessageBranchNext = ({
  children,
  ...props
}: MessageBranchNextProps) => {
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Next branch"
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  );
};

export type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

export const MessageBranchPage = ({
  className,
  ...props
}: MessageBranchPageProps) => {
  const { currentBranch, totalBranches } = useMessageBranch();

  return (
    <ButtonGroupText
      className={cn(
        "border-none bg-transparent text-muted-foreground shadow-none",
        className
      )}
      {...props}
    >
      {currentBranch + 1} of {totalBranches}
    </ButtonGroupText>
  );
};

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

// Custom remark plugins with singleDollarTextMath enabled for inline LaTeX
const customRemarkPlugins = [
  [remarkGfm, {}],
  [remarkMath, { singleDollarTextMath: true }],
  [remarkCjkFriendly, {}],
  [remarkCjkFriendlyGfmStrikethrough, {}],
];

/**
 * Preprocesses markdown to convert latex/tex code blocks into raw LaTeX.
 * This allows KaTeX to render math that the AI outputs inside code fences.
 */
function preprocessLatexCodeBlocks(content: string): string {
  if (typeof content !== 'string') return content;
  
  // Match ```latex or ```tex code blocks and extract their content
  // This regex handles both inline and display math inside code blocks
  return content.replace(
    /```(?:latex|tex)\s*\n([\s\S]*?)```/gi,
    (_, latexContent: string) => {
      // Trim the content and return it as raw LaTeX
      const trimmed = latexContent.trim();
      // If the content doesn't have math delimiters, wrap in display math
      if (!trimmed.startsWith('$') && !trimmed.startsWith('\\[') && !trimmed.startsWith('\\begin')) {
        return `$$${trimmed}$$`;
      }
      return trimmed;
    }
  );
}

/**
 * Escapes currency dollar signs to prevent them from being parsed as LaTeX math.
 * Uses HTML entity &#36; which renders as $ but won't trigger math parsing.
 * Currency patterns: $177.00, $15, $1,234.56, $4 trillion
 * Math patterns (not escaped): $x$, $\alpha$, $x^2$
 */
function escapeCurrencyDollars(content: string): string {
  if (typeof content !== 'string') return content;
  
  // Match $ followed by digits (with optional commas and decimals)
  // This distinguishes currency ($177.00) from math ($x$)
  // Use HTML entity &#36; to render as $ without math interpretation
  return content.replace(
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/g,
    '&#36;$1'
  );
}

export const MessageResponse = memo(
  ({ className, components, children, ...props }: MessageResponseProps) => {
    // Preprocess content: escape currency dollar signs, then convert latex code blocks
    const processedChildren = useMemo(() => {
      if (typeof children === 'string') {
        return preprocessLatexCodeBlocks(escapeCurrencyDollars(children));
      }
      return children;
    }, [children]);

    return (
      <Streamdown
        className={cn(
          // Match blog typography (see blog layout) for AI-generated content
          // while letting prose handle its own inner spacing.
          "prose prose-gray dark:prose-invert",
          "prose-h4:prose-base",
          "prose-h1:text-xl prose-h1:font-medium",
          "prose-h2:mt-12 prose-h2:scroll-m-20 prose-h2:text-lg prose-h2:font-medium",
          "prose-h3:text-base prose-h3:font-medium",
          "prose-h4:font-medium",
          "prose-h5:text-base prose-h5:font-medium",
          "prose-h6:text-base prose-h6:font-medium",
          "prose-strong:font-medium",
          className
        )}
        // Enable LaTeX math rendering with single dollar signs ($...$)
        remarkPlugins={customRemarkPlugins as ComponentProps<typeof Streamdown>['remarkPlugins']}
        // Use high-contrast themes for better readability in both modes
        shikiTheme={['github-light', 'github-dark']}
        // Keep Streamdown's rich code block UI (header, controls), but make
        // structural elements match blog-style prose.
        components={{
          // Handle custom <suggestions> tags from AI output - suppress React warning
          suggestions: () => null,
          // Handle custom <thinking> tags from AI output - suppress React warning
          thinking: () => null,
          blockquote({ children, ...rest }: React.ComponentPropsWithoutRef<'blockquote'>) {
            return <blockquote {...rest}>{children}</blockquote>;
          },
          hr(rest: React.ComponentPropsWithoutRef<'hr'>) {
            return <hr {...rest} />;
          },
          table({ children, ...rest }: React.ComponentPropsWithoutRef<'table'>) {
            return <table {...rest}>{children}</table>;
          },
          thead({ children, ...rest }: React.ComponentPropsWithoutRef<'thead'>) {
            return <thead {...rest}>{children}</thead>;
          },
          tbody({ children, ...rest }: React.ComponentPropsWithoutRef<'tbody'>) {
            return <tbody {...rest}>{children}</tbody>;
          },
          tr({ children, ...rest }: React.ComponentPropsWithoutRef<'tr'>) {
            return <tr {...rest}>{children}</tr>;
          },
          th({ children, ...rest }: React.ComponentPropsWithoutRef<'th'>) {
            return <th {...rest}>{children}</th>;
          },
          td({ children, ...rest }: React.ComponentPropsWithoutRef<'td'>) {
            return <td {...rest}>{children}</td>;
          },
          ...components,
        } as ComponentProps<typeof Streamdown>['components']}
        {...props}
      >
        {processedChildren}
      </Streamdown>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

MessageResponse.displayName = "MessageResponse";

export type MessageAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: FileUIPart;
  className?: string;
  onRemove?: () => void;
};

export function MessageAttachment({
  data,
  className,
  onRemove,
  ...props
}: MessageAttachmentProps) {
  const filename = data.filename || "";
  const mediaType =
    data.mediaType?.startsWith("image/") && data.url ? "image" : "file";
  const isImage = mediaType === "image";
  const attachmentLabel = filename || (isImage ? "Image" : "Attachment");

  return (
    <div
      className={cn(
        "group relative size-24 overflow-hidden rounded-lg",
        className
      )}
      {...props}
    >
      {isImage ? (
        <>
          <img
            alt={filename || "attachment"}
            className="size-full object-cover"
            height={100}
            src={data.url}
            width={100}
          />
          {onRemove && (
            <Button
              aria-label="Remove attachment"
              className="absolute top-2 right-2 size-6 rounded-full bg-background/80 p-0 opacity-0 backdrop-blur-sm transition-opacity hover:bg-background group-hover:opacity-100 [&>svg]:size-3"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              type="button"
              variant="ghost"
            >
              <XIcon />
              <span className="sr-only">Remove</span>
            </Button>
          )}
        </>
      ) : (
        <>
            <div className="flex size-full shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <PaperclipIcon className="size-4" />
              <span className="sr-only">{attachmentLabel}</span>
            </div>
          {onRemove && (
            <Button
              aria-label="Remove attachment"
              className="size-6 shrink-0 rounded-full p-0 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 [&>svg]:size-3"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              type="button"
              variant="ghost"
            >
              <XIcon />
              <span className="sr-only">Remove</span>
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export type MessageAttachmentsProps = ComponentProps<"div">;

export function MessageAttachments({
  children,
  className,
  ...props
}: MessageAttachmentsProps) {
  if (!children) {
    return null;
  }

  return (
    <div
      className={cn(
        "ml-auto flex w-fit flex-wrap items-start gap-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({
  className,
  children,
  ...props
}: MessageToolbarProps) => (
  <div
    className={cn(
      "mt-4 flex w-full items-center justify-between gap-4",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
