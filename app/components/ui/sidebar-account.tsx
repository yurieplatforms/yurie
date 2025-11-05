"use client"

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { getSupabaseClient } from "@/app/lib/supabase/client";
import SignOutButton from "@/app/components/ui/sign-out";
import { useSidebar } from "./sidebar";
import { migrateLocalHistoryToSupabaseOnce } from "@/app/lib/migrate-history";

export function SidebarAccount() {
  const [displayName, setDisplayName] = useState<string>("Guest");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [open, setOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { open: isSidebarOpen, setOpen: setSidebarOpen } = useSidebar();

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user || null;
      if (user) {
        setIsAuthenticated(true);
        const name = (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || user.email || "Account";
        setDisplayName(name as string);
        setAvatarUrl(((user.user_metadata || {}) as any).avatar_url || null);
        // Trigger one-time migration
        void migrateLocalHistoryToSupabaseOnce();
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user || null;
      if (user) {
        setIsAuthenticated(true);
        const name = (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || user.email || "Account";
        setDisplayName(name as string);
        setAvatarUrl(((user.user_metadata || {}) as any).avatar_url || null);
        // Trigger one-time migration when user signs in
        void migrateLocalHistoryToSupabaseOnce();
      } else {
        setIsAuthenticated(false);
        setDisplayName("Guest");
        setAvatarUrl(null);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Close dropdown when the sidebar is collapsed
  useEffect(() => {
    if (!isSidebarOpen && open) {
      setOpen(false);
    }
  }, [isSidebarOpen, open]);

  const content = (
    isSidebarOpen ? (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between rounded-xl bg-neutral-200/60 dark:bg-neutral-700/60 px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-full ring-1 ring-white/10 bg-gradient-to-br from-fuchsia-500 via-violet-500 to-blue-500 overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="truncate">
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{displayName}</div>
          </div>
        </div>
        <ChevronUp className={`h-4 w-4 text-neutral-600 dark:text-neutral-300 transition-transform ${open ? "rotate-0" : "rotate-180"}`} />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label={isAuthenticated ? displayName : "Login"}
        title={displayName}
        className="mx-auto h-9 w-9 flex items-center justify-center rounded-full ring-1 ring-white/10 bg-gradient-to-br from-fuchsia-500 via-violet-500 to-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 transform md:translate-x-[1px] overflow-hidden"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
        ) : null}
      </button>
    )
  );

  return (
    <div className="w-full relative">
      {content}
      {isSidebarOpen && open && (
        <div className="absolute z-10 left-0 right-0 bottom-[calc(100%+0.5rem)] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#2a2a2a] overflow-hidden shadow-lg">
          {isAuthenticated ? (
            <div className="p-1">
              <Link href="/settings" className="block w-full px-3 py-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-600/50">Account settings</Link>
              <SignOutButton className="w-full text-left px-3 py-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-600/50">Logout</SignOutButton>
            </div>
          ) : (
            <div className="p-1">
              <Link href="/sign-in" className="block w-full px-3 py-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-600/50">Login</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


