"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ReactNode, ComponentProps } from "react";

export type GetStartedProps = ComponentProps<"div">;

export const GetStarted = ({ className, children, ...props }: GetStartedProps) => (
  <div
    className={cn(
      "grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-4",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type GetStartedItemProps = {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
};

export const GetStartedItem = ({ label, icon, onClick, className }: GetStartedItemProps) => {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "flex flex-col items-start justify-center gap-2 rounded-2xl p-4 h-[92px]",
        "w-full cursor-pointer border-0 shadow-none",
        "bg-[var(--color-suggestion)] dark:bg-[var(--color-suggestion)]",
        "hover:bg-[#f5f4f2] dark:hover:bg-[#2a2a2a]",
        "text-[#807d78] dark:text-[#807d78]",
        "hover:text-[#6e6b66] dark:hover:text-[#9a9793]",
        "transition-colors duration-300 ease-out",
        className
      )}
      onClick={onClick}
    >
      {icon && <span className="opacity-80">{icon}</span>}
      <span className="text-left text-[12px] leading-[14px] font-medium whitespace-normal break-words">{label}</span>
    </Button>
  );
};


