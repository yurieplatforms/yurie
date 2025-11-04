"use client"

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/app/lib/supabase/client";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Fallback: if session is already present after redirect, consider ready
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#212121] px-4 py-12">
      <div className="w-full max-w-md border border-border dark:border-neutral-800 rounded-2xl bg-card dark:bg-neutral-900 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white text-center">Reset password</h1>
        <p className="text-sm text-muted-foreground dark:text-white mt-1 text-center">Set a new password for your account.</p>

        {!ready && !success && (
          <div className="mt-6 text-sm text-muted-foreground dark:text-white">Validating your reset link…</div>
        )}

        {ready && !success && (
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-neutral-900 dark:text-white">New password</label>
              <div className="relative w-full bg-white dark:bg-[#303030] text-neutral-900 dark:text-white border border-gray-200 dark:border-[#444444] p-px rounded-[32px] shadow-sm">
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-0 outline-0 rounded-[31px] py-2 text-[15px] bg-transparent px-3 text-neutral-900 dark:text-white placeholder:text-neutral-500 disabled:opacity-60"
                  placeholder="At least 6 characters"
                />
              </div>
            </div>

            {error && <div className="text-sm rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-primary text-primary-foreground px-3 font-medium transition-colors disabled:opacity-60"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        {success && (
          <div className="mt-6 space-y-3">
            <div className="text-sm rounded-md border border-green-600/20 bg-green-600/10 px-3 py-2 text-green-600">Your password has been updated.</div>
            <Link className="text-primary text-sm hover:underline" href="/sign-in">Return to sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
}


