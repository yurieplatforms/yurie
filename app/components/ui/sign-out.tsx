"use client"

import { getSupabaseClient } from "@/app/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  className?: string;
  children?: React.ReactNode;
  redirectTo?: string;
}

export default function SignOutButton({ className, children = "Sign out", redirectTo = "/sign-in" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace(redirectTo);
  };

  return (
    <button onClick={onClick} disabled={loading} className={className}>
      {loading ? "Signing out…" : children}
    </button>
  );
}




