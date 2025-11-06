"use client"

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/app/lib/supabase/client";
import Link from "next/link";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      const redirect = searchParams.get("redirect") || "/";
      router.replace(redirect);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#212121] px-4 py-12">
      <div className="w-full max-w-md border border-border dark:border-neutral-800 rounded-2xl bg-card dark:bg-neutral-900 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white text-center">Sign in</h1>
        <p className="text-sm text-muted-foreground dark:text-white mt-1 text-center">Welcome back. Enter your credentials to continue.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-neutral-900 dark:text-white">Email</label>
            <div className="relative w-full bg-white dark:bg-[#303030] text-neutral-900 dark:text-white border border-gray-200 dark:border-[#444444] p-px rounded-[32px] shadow-sm">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full border-0 outline-0 rounded-[31px] py-2 text-[15px] bg-transparent px-3 text-neutral-900 dark:text-white placeholder:text-neutral-500 disabled:opacity-60"
                placeholder="you@example.com"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "form-error" : undefined}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-neutral-900 dark:text-white">Password</label>
            <div className="relative w-full bg-white dark:bg-[#303030] text-neutral-900 dark:text-white border border-gray-200 dark:border-[#444444] p-px rounded-[32px] shadow-sm">
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full border-0 outline-0 rounded-[31px] py-2 text-[15px] bg-transparent px-3 text-neutral-900 dark:text-white placeholder:text-neutral-500 disabled:opacity-60"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div id="form-error" className="text-sm rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground px-3 font-medium transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
          <span className="text-muted-foreground dark:text-white">
            No account? <Link href="/sign-up" className="text-primary hover:underline">Sign up</Link>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
