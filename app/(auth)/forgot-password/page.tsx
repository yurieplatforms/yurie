"use client"

import { useState } from "react";
import { getSupabaseClient } from "@/app/lib/supabase/client";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }
      setMessage("If an account exists for that email, we've sent a reset link.");
      setLoading(false);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#212121] px-4 py-12">
      <div className="w-full max-w-md border border-border dark:border-neutral-800 rounded-2xl bg-card dark:bg-neutral-900 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white text-center">Forgot password</h1>
        <p className="text-sm text-muted-foreground dark:text-white mt-1 text-center">Enter your email and we'll send you a reset link.</p>

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
              />
            </div>
          </div>

          {error && (
            <div className="text-sm rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
          )}
          {message && (
            <div className="text-sm rounded-md border border-green-600/20 bg-green-600/10 px-3 py-2 text-green-600">{message}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground px-3 font-medium transition-colors disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <div className="mt-6 text-sm flex items-center justify-between">
          <Link href="/sign-in" className="text-primary hover:underline">Back to sign in</Link>
          <Link href="/sign-up" className="text-primary hover:underline">Create account</Link>
        </div>
      </div>
    </div>
  );
}


