"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { memo, useMemo, useEffect, useState } from "react";
import { ExternalLink, ChevronDown } from "lucide-react";
import { StatusShimmer } from "@/components/ai/shimmer";

// =============================================================================
// Types
// =============================================================================

export type ResearchStage = 
  | 'starting'
  | 'searching'
  | 'analyzing'
  | 'synthesizing'
  | 'completed'
  | 'failed';

export type ResearchSource = {
  url: string;
  title?: string;
  status: 'found' | 'analyzing' | 'analyzed';
};

export type ResearchProgressState = {
  stage: ResearchStage;
  sourcesFound: number;
  sourcesAnalyzed: number;
  currentActivity?: string;
  sources: ResearchSource[];
  startTime?: number;
  searchQueries: string[];
};

export type ResearchProgressProps = {
  state: ResearchProgressState;
  className?: string;
};

// =============================================================================
// Elapsed Time Hook
// =============================================================================

function useElapsedTime(startTime?: number, isActive: boolean = true) {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    if (!startTime || !isActive) return;
    
    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, isActive]);
  
  return elapsed;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

// =============================================================================
// Source Item Component
// =============================================================================

const SourceItem = memo(({ source, index }: { source: ResearchSource; index: number }) => {
  const { hostname, faviconUrl } = useMemo(() => {
    try {
      const url = new URL(source.url);
      const host = url.hostname.replace('www.', '');
      // Use Google's favicon service for reliable favicons
      const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
      return { hostname: host, faviconUrl: favicon };
    } catch {
      return { hostname: source.url, faviconUrl: null };
    }
  }, [source.url]);

  return (
    <motion.a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200",
        "text-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {/* Favicon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted overflow-hidden transition-colors group-hover:bg-background/80">
        {faviconUrl ? (
          <img 
            src={faviconUrl} 
            alt="" 
            className="h-4 w-4"
            onError={(e) => {
              // Hide broken favicon
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="text-xs font-medium text-muted-foreground">
            {hostname.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      
      {/* Site info */}
      <div className="flex-1 min-w-0">
        {/* Site title */}
        <p className="text-sm font-medium truncate">
          {source.title || hostname}
        </p>
        {/* Site name / hostname */}
        <p className="text-xs text-muted-foreground transition-colors group-hover:text-accent-foreground truncate">
          {hostname}
        </p>
      </div>
      
      {/* External link icon */}
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all group-hover:text-accent-foreground" />
    </motion.a>
  );
});

SourceItem.displayName = "SourceItem";

// =============================================================================
// Sources Section Component
// =============================================================================

const SourcesSection = memo(({ 
  sources, 
  isExpanded, 
  onToggle 
}: { 
  sources: ResearchSource[];
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  if (sources.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-3 pt-3 border-t border-border/50"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
        <span>{sources.length} source{sources.length > 1 ? 's' : ''} found</span>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ 
              height: 'auto', 
              opacity: 1,
              transition: {
                height: {
                  duration: 0.3,
                  ease: "easeOut"
                },
                opacity: { duration: 0.2, delay: 0.1 }
              }
            }}
            exit={{ 
              height: 0, 
              opacity: 0,
              transition: {
                height: { duration: 0.2, ease: "easeIn" },
                opacity: { duration: 0.1 }
              }
            }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pt-2 space-y-1 max-h-64 overflow-y-auto no-scrollbar">
              {sources.map((source, index) => (
                <SourceItem key={source.url} source={source} index={index} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

SourcesSection.displayName = "SourcesSection";

// =============================================================================
// Main Component - Matches Thinking/Tool Use Pattern
// =============================================================================

export const ResearchProgress = memo(({ state, className }: ResearchProgressProps) => {
  const isActive = state.stage !== 'completed' && state.stage !== 'failed';
  const elapsed = useElapsedTime(state.startTime, isActive);
  const [sourcesExpanded, setSourcesExpanded] = useState(true);
  
  // Build status label
  const statusLabel = useMemo(() => {
    switch (state.stage) {
      case 'starting':
        return 'Researching';
      case 'searching':
        return state.sourcesFound > 0 
          ? `Browsing (${state.sourcesFound} found)` 
          : 'Browsing';
      case 'analyzing':
        return state.sourcesFound > 0 
          ? `Analyzing ${state.sourcesFound} sources` 
          : 'Analyzing';
      case 'synthesizing':
        return 'Crafting';
      case 'completed':
        return 'Researched';
      case 'failed':
        return 'Research failed';
      default:
        return 'Researching';
    }
  }, [state.stage, state.sourcesFound]);

  return (
    <div className={cn("w-full", className)}>
      {/* Status row - matches ReasoningTrigger style */}
      <div className="flex w-full items-start gap-2 py-2 text-base font-medium text-zinc-500 select-none">
        {isActive ? (
          <StatusShimmer>{statusLabel}</StatusShimmer>
        ) : (
          <span className="text-base font-normal text-muted-foreground">
            {statusLabel}
            {state.startTime && elapsed > 0 && (
              <> for {formatTime(elapsed)}</>
            )}
          </span>
        )}
      </div>
      
      {/* Sources section */}
      {state.sources.length > 0 && (
        <SourcesSection 
          sources={state.sources}
          isExpanded={sourcesExpanded}
          onToggle={() => setSourcesExpanded(!sourcesExpanded)}
        />
      )}
    </div>
  );
});

ResearchProgress.displayName = "ResearchProgress";

// =============================================================================
// Minimal Research Indicator (for inline use without sources)
// =============================================================================

export const ResearchIndicator = memo(({ 
  stage, 
  sourcesFound = 0,
  className 
}: { 
  stage: ResearchStage;
  sourcesFound?: number;
  className?: string;
}) => {
  const isActive = stage !== 'completed' && stage !== 'failed';
  
  const label = useMemo(() => {
    if (stage === 'analyzing' && sourcesFound > 0) {
      return `Analyzing ${sourcesFound} sources`;
    }
    if (stage === 'searching' && sourcesFound > 0) {
      return `Browsing (${sourcesFound} found)`;
    }
    switch (stage) {
      case 'starting': return 'Researching';
      case 'searching': return 'Browsing';
      case 'analyzing': return 'Analyzing';
      case 'synthesizing': return 'Crafting';
      case 'completed': return 'Researched';
      case 'failed': return 'Research failed';
      default: return 'Researching';
    }
  }, [stage, sourcesFound]);
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isActive ? (
        <StatusShimmer>{label}</StatusShimmer>
      ) : (
        <span className="text-base font-normal text-muted-foreground">{label}</span>
      )}
    </div>
  );
});

ResearchIndicator.displayName = "ResearchIndicator";
