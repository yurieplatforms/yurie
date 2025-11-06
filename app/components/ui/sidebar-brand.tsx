"use client";

import Image from "next/image";
import Link from "next/link";
import { useSidebar } from "./sidebar";
import { cn } from "@/app/lib/utils";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useState } from "react";

export function SidebarBrand() {
  const { open, setOpen } = useSidebar();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative min-h-12 flex items-center justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!open && (
        <>
          <Link
            href="/"
            className={cn(
              "flex items-center justify-center font-normal text-sm !text-black dark:!text-white rounded-md p-2 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600",
              isHovered ? "opacity-0 pointer-events-none" : "opacity-100"
            )}
            aria-label="Yurie Home"
            title="Yurie"
          >
            <div className="flex-shrink-0">
              <Image
                src="/favicon.ico?v=3"
                alt="Yurie"
                width={20}
                height={20}
                className="h-5 w-5"
              />
            </div>
          </Link>
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-md p-2 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 cursor-pointer",
              isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            aria-label="Open sidebar"
          >
            <PanelLeft className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
          </button>
        </>
      )}
      {open && (
        <div className="flex items-center justify-between w-full">
          <Link
            href="/"
            className="flex items-center gap-1.5 font-normal text-sm !text-black dark:!text-white rounded-md p-2 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600"
            aria-label="Yurie Home"
          >
            <div className="flex-shrink-0">
              <Image
                src="/favicon.ico?v=3"
                alt="Yurie"
                width={20}
                height={20}
                className="h-5 w-5"
              />
            </div>
            <span className="font-medium whitespace-nowrap">
              Yurie
            </span>
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              setIsHovered(false);
            }}
            className="p-2 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 cursor-pointer"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
          </button>
        </div>
      )}
    </div>
  );
}
