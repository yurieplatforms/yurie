"use client";

import { cn } from "@/app/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import Image from "next/image";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
  width: number;
  setWidth: React.Dispatch<React.SetStateAction<number>>;
  pinned: boolean;
  setPinned: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [openState, setOpenState] = useState(false);
  const [width, setWidth] = useState(300);
  const [pinned, setPinned] = useState(false);

  // derive effective state from controlled/uncontrolled
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  // load persisted state (avoid auto-opening on mobile)
  useEffect(() => {
    try {
      const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
      const storedOpen = localStorage.getItem("sidebar:open");
      const storedWidth = localStorage.getItem("sidebar:width");
      const storedPinned = localStorage.getItem("sidebar:pinned");
      if (isDesktop) {
      if (storedOpen !== null) setOpen(storedOpen === "1");
      if (storedPinned !== null) setPinned(storedPinned === "1");
      } else {
        setOpen(false);
      }
      if (storedWidth !== null) {
        const parsed = parseInt(storedWidth, 10);
        if (!Number.isNaN(parsed)) setWidth(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist state
  useEffect(() => {
    try {
      localStorage.setItem("sidebar:open", open ? "1" : "0");
    } catch {}
  }, [open]);

  useEffect(() => {
    try {
      localStorage.setItem("sidebar:width", String(Math.round(width)));
    } catch {}
  }, [width]);

  // persist pin state
  useEffect(() => {
    try {
      localStorage.setItem("sidebar:pinned", pinned ? "1" : "0");
    } catch {}
  }, [pinned]);

  // ensure open when pinned
  useEffect(() => {
    if (pinned && !open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned]);

  const shouldAnimate = animate && !prefersReducedMotion;
  return (
    <SidebarContext.Provider value={{ open, setOpen, animate: shouldAnimate, width, setWidth, pinned, setPinned }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  const { children, ...rest } = props;
  return (
    <>
      <DesktopSidebar {...(rest as Omit<React.ComponentProps<typeof motion.div>, 'children'>)}>
        {children as React.ReactNode}
      </DesktopSidebar>
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

type DesktopSidebarProps = Omit<React.ComponentProps<typeof motion.div>, 'children'> & { children?: React.ReactNode };

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: DesktopSidebarProps) => {
  const { open, setOpen, animate, width, setWidth, pinned } = useSidebar();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const collapsedWidth = 60;

  const startResize = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const raw = clientX - rect.left;
    const clamped = Math.max(220, Math.min(420, raw));
    setWidth(clamped);
    if (!open) setOpen(true);
  };

  const onMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => startResize(ev.clientX);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onTouchStartResize = (_e: React.TouchEvent) => {
    const move = (ev: TouchEvent) => {
      if (ev.touches && ev.touches[0]) startResize(ev.touches[0].clientX);
    };
    const end = () => {
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
  };
  return (
    <motion.div
      ref={containerRef as any}
      className={cn(
        "relative h-full pt-4 pb-4 hidden md:flex md:flex-col bg-neutral-100 dark:bg-neutral-800 w-[300px] flex-shrink-0 border-r border-neutral-200 dark:border-neutral-700 shadow-sm",
        open ? "px-4" : "px-2",
        className
      )}
      animate={{
        width: animate ? (open ? Math.round(width) : collapsedWidth) : Math.round(width),
      }}
      style={{ width: open ? Math.round(width) : collapsedWidth }}
      {...props}
    >
      <div
        onMouseDown={onMouseDownResize}
        onTouchStart={onTouchStartResize}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-neutral-300/40 dark:hover:bg-neutral-600/40"
        aria-hidden="true"
      />
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      window.addEventListener("keydown", onKey);
      // focus close button when opening
      setTimeout(() => closeBtnRef.current?.focus(), 0);
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Close drawer on route change (mobile only)
  useEffect(() => {
    try {
      const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
      if (!isDesktop) setOpen(false);
    } catch {}
  }, [pathname, setOpen]);
  return (
    <>
      <div
        id="nav"
        className={cn(
          "md:hidden fixed top-0 inset-x-0 z-20 flex h-12 items-center px-3 bg-white dark:bg-[#212121] w-full"
        )}
        {...props}
      >
          <button
            type="button"
            aria-label="Toggle sidebar"
            aria-controls="mobile-sidebar"
            aria-expanded={open}
            className="rounded-md p-2 cursor-pointer hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 text-neutral-800 dark:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600"
            onClick={() => setOpen(!open)}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700 mx-3" />
          <Link
            href="/"
            className="flex items-center gap-1.5 font-normal text-sm !text-black dark:!text-white"
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
            <span className="font-medium">
              Yurie
            </span>
          </Link>
        </div>
        <AnimatePresence>
          {open && (
          <>
            {/* Scrim */}
            <motion.button
              type="button"
              aria-label="Close sidebar"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[95] bg-transparent md:hidden"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className={cn(
                "fixed inset-y-0 left-0 z-[100] w-[min(100vw,420px)] max-w-[100vw] bg-white dark:bg-[#212121] overflow-y-auto md:hidden relative",
                // safe-area paddings
                "pt-[max(env(safe-area-inset-top),0)] pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]",
                className
              )}
              role="dialog"
              aria-modal="true"
              aria-label="Mobile sidebar"
              id="mobile-sidebar"
            >
              {/* Close button moved into brand header on mobile for alignment */}
              <div className="mt-0 flex flex-col min-h-full justify-between gap-6">
              {children}
              </div>
            </motion.aside>
          </>
          )}
        </AnimatePresence>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
  props?: LinkProps;
}) => {
  const { open, animate } = useSidebar();
  const pathname = usePathname();
  const isActive = React.useMemo(() => {
    if (!pathname || !link?.href) return false;
    if (link.href === "#") return false;
    if (link.href === "/") return pathname === "/";
    return pathname.startsWith(link.href);
  }, [pathname, link?.href]);
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-2 group/sidebar py-2 px-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600",
        !open ? "justify-center" : "justify-start",
        isActive
          ? "bg-neutral-200 dark:bg-neutral-700"
          : "hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60",
        className
      )}
      aria-current={isActive ? "page" : undefined}
      aria-label={link.label}
      title={!open ? link.label : undefined}
      {...props}
    >
      {link.icon}
      <motion.span
        layout
        initial={false}
        animate={{ opacity: animate ? (open ? 1 : 0) : 1 }}
        aria-hidden={!open}
        className={cn(
          "text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition-all duration-150 whitespace-pre inline-block !p-0 !m-0 overflow-hidden",
          open ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
        )}
      >
        {link.label}
      </motion.span>
    </Link>
  );
};


