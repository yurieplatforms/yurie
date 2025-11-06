"use client"

import { getSupabaseClient } from '@/app/lib/supabase/client'
import { loadHistory, clearHistory } from '@/app/lib/history'

export async function migrateLocalHistoryToSupabaseOnce(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    if (typeof window === 'undefined') return false
    const flagKey = `chat:migrated:v1:${user.id}`
    try {
      if (localStorage.getItem(flagKey)) return false
    } catch {}

    const { data: existing, error: existingErr } = await supabase
      .from('conversations')
      .select('id')
      .limit(1)
    if (existingErr) return false
    if (existing && existing.length > 0) {
      try { localStorage.setItem(flagKey, '1') } catch {}
      return false
    }

    const locals = loadHistory()
    if (!Array.isArray(locals) || locals.length === 0) {
      try { localStorage.setItem(flagKey, '1') } catch {}
      return false
    }

    const rows = locals.map((c) => ({
      user_id: user.id,
      title: c.title,
      messages: c.messages,
      created_at: new Date(c.createdAt).toISOString(),
      updated_at: new Date(c.updatedAt).toISOString(),
    }))

    const { error: insertErr } = await supabase.from('conversations').insert(rows)
    if (insertErr) return false

    clearHistory()
    try { sessionStorage.removeItem('chat:currentId') } catch {}
    try { localStorage.setItem(flagKey, '1') } catch {}
    try { window.dispatchEvent(new CustomEvent('history:updated')) } catch {}
    return true
  } catch {
    return false
  }
}
