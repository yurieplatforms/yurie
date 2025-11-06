"use client"

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/app/lib/supabase/client";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [email, setEmail] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getUser().then(({ data, error: userError }) => {
      if (userError || !data?.user) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      const user = data.user;
      setIsAuthenticated(true);
      setEmail(user.email ?? "");
      const md = (user.user_metadata || {}) as any;
      setFirstName(md.first_name || "");
      setLastName(md.last_name || "");
      setAvatarUrl(md.avatar_url || null);
      setLoading(false);
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          name: fullName,
        },
      });
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      setSuccess("Profile updated");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onChangeAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const onAvatarFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(null);
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      e.target.value = "";
      return;
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError("Image must be 5MB or smaller.");
      e.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    try {
      const supabase = getSupabaseClient();
      const { data: userResp, error: getUserError } = await supabase.auth.getUser();
      if (getUserError || !userResp?.user) {
        setError(getUserError?.message || "You must be signed in.");
        return;
      }
      const user = userResp.user;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setAvatarUrl(publicUrl);
      setSuccess("Profile photo updated");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-neutral-600 dark:text-neutral-300">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen md:min-h-0 flex items-center justify-center bg-white dark:bg-[#212121] px-4 py-12 w-full">
        <div className="w-full max-w-md border border-border dark:border-neutral-800 rounded-2xl bg-card dark:bg-neutral-900 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white text-center">Account settings</h1>
          <p className="text-sm text-muted-foreground dark:text-white mt-2 text-center">Please sign in to manage your profile.</p>
          <div className="mt-6 text-center">
            <Link href="/sign-in?redirect=/settings" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-primary-foreground font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex items-start justify-center p-4 md:p-8 overflow-y-auto">
      <div className="w-full max-w-2xl border border-border dark:border-neutral-800 rounded-2xl bg-card dark:bg-neutral-900 p-6 md:p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Account settings</h1>
        <p className="text-sm text-muted-foreground dark:text-white mt-1">Manage your profile information.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-neutral-900 dark:text-white">Profile photo</label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full ring-1 ring-white/10 bg-gradient-to-br from-fuchsia-500 via-violet-500 to-blue-500 overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onChangeAvatarClick}
                  disabled={uploadingAvatar}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-neutral-200 dark:bg-neutral-700 px-3 text-neutral-900 dark:text-white text-sm font-medium disabled:opacity-60"
                >
                  {uploadingAvatar ? "Uploading…" : "Change photo"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onAvatarFileSelected}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium text-neutral-900 dark:text-white">First name</label>
              <div className="relative w-full bg-white dark:bg-[#303030] text-neutral-900 dark:text-white border border-gray-200 dark:border-[#444444] p-px rounded-[12px] shadow-sm">
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={saving}
                  className="w-full border-0 outline-0 rounded-[11px] py-2 text-[15px] bg-transparent px-3 text-neutral-900 dark:text-white placeholder:text-neutral-500 disabled:opacity-60"
                  placeholder="Jane"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium text-neutral-900 dark:text-white">Last name</label>
              <div className="relative w-full bg-white dark:bg-[#303030] text-neutral-900 dark:text-white border border-gray-200 dark:border-[#444444] p-px rounded-[12px] shadow-sm">
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={saving}
                  className="w-full border-0 outline-0 rounded-[11px] py-2 text-[15px] bg-transparent px-3 text-neutral-900 dark:text-white placeholder:text-neutral-500 disabled:opacity-60"
                  placeholder="Doe"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-neutral-900 dark:text-white">Email</label>
            <div className="relative w-full bg-neutral-100 dark:bg-[#2a2a2a] text-neutral-900 dark:text-white border border-gray-200 dark:border-[#444444] p-px rounded-[12px] shadow-sm">
              <input
                id="email"
                type="email"
                value={email}
                disabled
                className="w-full border-0 outline-0 rounded-[11px] py-2 text-[15px] bg-transparent px-3 text-neutral-900 dark:text-white placeholder:text-neutral-500 disabled:opacity-60"
              />
            </div>
          </div>

          

          {error && (
            <div className="text-sm rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
          )}
          {success && (
            <div className="text-sm rounded-md border border-green-600/20 bg-green-600/10 px-3 py-2 text-green-600">{success}</div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-primary-foreground font-medium disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <Link href="/" className="text-sm text-primary hover:underline">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
