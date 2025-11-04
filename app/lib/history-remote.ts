"use client"

import type { ChatMessage } from '@/app/types/chat'
import type { Conversation } from '@/app/lib/history'
import { getSupabaseClient } from '@/app/lib/supabase/client'

type RemoteConversationRow = {
  id: string
  user_id: string
  title: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

function toConversation(row: RemoteConversationRow): Conversation {
  const created = Date.parse(row.created_at || '')
  const updated = Date.parse(row.updated_at || '')
  return {
    id: row.id,
    title: row.title,
    messages: Array.isArray(row.messages) ? row.messages : [],
    createdAt: Number.isFinite(created) ? created : Date.now(),
    updatedAt: Number.isFinite(updated) ? updated : Date.now(),
  }
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  const base = (firstUser?.content || '').trim()
  if (!base) return 'New chat'
  const singleLine = base.replace(/\s+/g, ' ').slice(0, 64)
  return singleLine || 'New chat'
}

export async function fetchHistoryRemote(): Promise<Conversation[]> {
  const supabase = getSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return []
  const { data, error } = await supabase
    .from('conversations')
    .select('id,user_id,title,messages,created_at,updated_at')
    .order('updated_at', { ascending: false })
  if (error) return []
  return (data as RemoteConversationRow[] | null | undefined)?.map(toConversation) || []
}

export async function getConversationByIdRemote(id: string): Promise<Conversation | null> {
  const supabase = getSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return null
  const { data, error } = await supabase
    .from('conversations')
    .select('id,user_id,title,messages,created_at,updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return toConversation(data as RemoteConversationRow)
}

export async function upsertConversationFromMessagesRemote(messages: ChatMessage[], existingId?: string): Promise<{ id: string }> {
  const supabase = getSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) throw new Error('Not authenticated')
  const title = deriveTitle(messages)
  const nowIso = new Date().toISOString()
  if (existingId) {
    const { error } = await supabase
      .from('conversations')
      .update({ title, messages, updated_at: nowIso })
      .eq('id', existingId)
    if (!error) {
      try { window.dispatchEvent(new CustomEvent('history:updated')) } catch {}
      return { id: existingId }
    }
  }
  const { data, error } = await supabase
    .from('conversations')
    .insert([{ user_id: user.id, title, messages, created_at: nowIso, updated_at: nowIso }])
    .select('id')
    .single()
  if (error) throw error
  const id = (data as any)?.id as string
  try { window.dispatchEvent(new CustomEvent('history:updated')) } catch {}
  return { id }
}

export async function deleteConversationRemote(id: string): Promise<void> {
  const supabase = getSupabaseClient()
  await supabase.from('conversations').delete().eq('id', id)
  try { window.dispatchEvent(new CustomEvent('history:updated')) } catch {}
}

export async function clearAllConversationsRemote(): Promise<void> {
  const supabase = getSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) return
  await supabase.from('conversations').delete().eq('user_id', user.id)
  try { window.dispatchEvent(new CustomEvent('history:updated')) } catch {}
}


