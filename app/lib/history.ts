"use client"

import type { ChatMessage } from '@/app/types/chat'
import { getSupabaseClient } from '@/app/lib/supabase/client'
import { 
  fetchHistoryRemote, 
  getConversationByIdRemote, 
  upsertConversationFromMessagesRemote, 
  deleteConversationRemote, 
  clearAllConversationsRemote 
} from '@/app/lib/history-remote'

export type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

const STORAGE_KEY = 'chat:history:v1'

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) as T } catch { return fallback }
}

export function loadHistory(): Conversation[] {
  if (typeof window === 'undefined') return []
  const arr = safeParse<Conversation[]>(localStorage.getItem(STORAGE_KEY), [])
  if (!Array.isArray(arr)) return []
  return arr.filter(Boolean)
}

export function saveHistory(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
    window.dispatchEvent(new CustomEvent('history:updated'))
  } catch {}
}

export function getConversation(id: string): Conversation | undefined {
  return loadHistory().find((c) => c.id === id)
}

export function removeConversation(id: string) {
  const list = loadHistory().filter((c) => c.id !== id)
  saveHistory(list)
}

export function clearHistory() {
  saveHistory([])
  try {
    sessionStorage.removeItem('chat:currentId')
  } catch {}
}

function generateId(): string {
  try { return crypto.randomUUID() } catch { return 'c_' + Math.random().toString(36).slice(2) }
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  const base = (firstUser?.content || '').trim()
  if (!base) return 'New chat'
  const singleLine = base.replace(/\s+/g, ' ').slice(0, 64)
  return singleLine || 'New chat'
}

export function upsertFromMessages(messages: ChatMessage[], existingId?: string): { id: string; conversations: Conversation[] } {
  if (!messages || messages.length === 0) {
    // Nothing to save; return existing list
    return { id: existingId || '', conversations: loadHistory() }
  }
  const now = Date.now()
  const title = deriveTitle(messages)
  const list = loadHistory()
  let id = existingId
  let updated: Conversation
  if (id) {
    const idx = list.findIndex((c) => c.id === id)
    if (idx >= 0) {
      updated = { ...list[idx], title, updatedAt: now, messages: messages }
      const next = [...list]
      next.splice(idx, 1)
      const finalList = [updated, ...next].sort((a, b) => b.updatedAt - a.updatedAt)
      saveHistory(finalList)
      return { id, conversations: finalList }
    }
  }
  id = generateId()
  updated = { id, title, createdAt: now, updatedAt: now, messages }
  const finalList = [updated, ...list].sort((a, b) => b.updatedAt - a.updatedAt)
  saveHistory(finalList)
  return { id, conversations: finalList }
}


// Async, remote-first wrappers with guest fallback
export async function loadHistoryAsync(): Promise<Conversation[]> {
  try {
    const supabase = getSupabaseClient()
    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      return await fetchHistoryRemote()
    }
  } catch {}
  return loadHistory().sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getConversationAsync(id: string): Promise<Conversation | null> {
  try {
    const supabase = getSupabaseClient()
    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      return await getConversationByIdRemote(id)
    }
  } catch {}
  return getConversation(id) || null
}

export async function upsertFromMessagesAsync(messages: ChatMessage[], existingId?: string): Promise<{ id: string; conversations?: Conversation[] }> {
  try {
    const supabase = getSupabaseClient()
    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      const res = await upsertConversationFromMessagesRemote(messages, existingId)
      return { id: res.id }
    }
  } catch {}
  const res = upsertFromMessages(messages, existingId)
  return { id: res.id, conversations: res.conversations }
}

export async function removeConversationAsync(id: string): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      await deleteConversationRemote(id)
      return
    }
  } catch {}
  removeConversation(id)
}

export async function clearHistoryAsync(): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      await clearAllConversationsRemote()
      try { sessionStorage.removeItem('chat:currentId') } catch {}
      return
    }
  } catch {}
  clearHistory()
}

