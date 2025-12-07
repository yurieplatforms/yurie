"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import {
  type CSSProperties,
  type ElementType,
  type JSX,
  memo,
  useMemo,
} from "react";

export type TextShimmerProps = {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
};

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const MotionComponent = motion.create(
    Component as keyof JSX.IntrinsicElements
  );

  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread]
  );

  return (
    <MotionComponent
      animate={{ backgroundPosition: "0% center" }}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--shimmer-color),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
        "[--shimmer-color:#ffffff] dark:[--shimmer-color:#f4f4f5]",
        className
      )}
      initial={{ backgroundPosition: "100% center" }}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage:
            "var(--bg), linear-gradient(var(--color-muted-foreground,rgba(24,24,27,1)), var(--color-muted-foreground,rgba(24,24,27,1)))",
        } as CSSProperties
      }
      transition={{
        repeat: Number.POSITIVE_INFINITY,
        duration,
        ease: "linear",
      }}
    >
      {children}
    </MotionComponent>
  );
};

export const Shimmer = memo(ShimmerComponent);

// Animated pulsing dot indicator
const PulsingDot = memo(() => {
  return (
    <span className="relative flex h-4 w-4 items-center justify-center shrink-0">
      {/* Pulsing ring */}
      <motion.span
        className="absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75"
        animate={{
          scale: [1, 2, 1],
          opacity: [0.75, 0, 0.75],
        }}
        transition={{
          duration: 1.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeOut",
        }}
      />
      {/* Static dot */}
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
  );
});

PulsingDot.displayName = "PulsingDot";

// Dynamic status shimmer - shows pulsing dot + shimmer text
export const StatusShimmer = memo(({ 
  children = "Thinking",
  className,
}: { 
  children?: string;
  className?: string;
}) => (
  <span className="inline-flex items-center gap-2.5">
    <PulsingDot />
    <Shimmer
      as="span"
      className={cn("text-base font-medium", className)}
      duration={2.5}
    >
      {children}
    </Shimmer>
  </span>
));

StatusShimmer.displayName = "StatusShimmer";

// Re-export for backwards compatibility
export const ThinkingShimmer = StatusShimmer;
export const ToolUseShimmer = StatusShimmer;
