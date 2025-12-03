/**
 * Chat History Module
 *
 * Manages chat persistence for both authenticated (Supabase) and
 * guest (localStorage) users. Provides CRUD operations for chats.
 *
 * @module lib/chat/history
 */

import { createClient } from '@/services/supabase/client'
import { SavedChat, ChatMessage } from '@/types'
import { SupabaseClient } from '@supabase/supabase-js'

const STORAGE_KEY = 'yurie-chat-history'

const getSupabase = () => createClient()

// ============================================================================
// LocalStorage Helpers (DRY)
// ============================================================================

/**
 * Get all chats from localStorage
 */
function getLocalChats(): SavedChat[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored) as SavedChat[]
  } catch {
    return []
  }
}

/**
 * Set chats in localStorage
 */
function setLocalChats(chats: SavedChat[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
}

/**
 * Remove all chats from localStorage
 */
function clearLocalChats(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Dispatch the history-updated event to notify components of changes
 */
function dispatchHistoryUpdate(): void {
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new Event('history-updated'))
  }
}

// ============================================================================
// Database Message Type
// ============================================================================

type DatabaseMessage = {
  id: string
  role: string
  content: string
  created_at: string
  rich_content?: ChatMessage['richContent']
  reasoning?: string
  thinking_duration_seconds?: number
  suggestions?: string[]
  name?: string
}

// ============================================================================
// Supabase Helpers
// ============================================================================

export async function getUserChats(
  userId: string,
  supabase: SupabaseClient,
): Promise<SavedChat[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('*, chat_messages:messages(id, role, content, created_at)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch chats', error)
    return []
  }

  return data.map((chat) => {
    // Sort messages by created_at to ensure correct order
    const sortedMessages = (
      (chat.chat_messages || []) as DatabaseMessage[]
    ).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

    return {
      id: chat.id,
      title: chat.title,
      createdAt: new Date(chat.created_at).getTime(),
      updatedAt: new Date(chat.updated_at).getTime(),
      messages: sortedMessages.map((m) => ({
        id: m.id,
        role: m.role as ChatMessage['role'],
        content: m.content,
      })),
    }
  })
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get all chats for a user
 *
 * @param userId - User ID for authenticated users, undefined for guests
 * @returns Array of saved chats, sorted by updatedAt descending
 */
export async function getChats(userId?: string): Promise<SavedChat[]> {
  if (userId) {
    const supabase = getSupabase()
    return getUserChats(userId, supabase)
  }

  const chats = getLocalChats()
  return chats.sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Get a specific chat by ID
 *
 * @param id - Chat ID
 * @param userId - User ID for authenticated users, undefined for guests
 * @returns The saved chat or null if not found
 */
export async function getChat(
  id: string,
  userId?: string,
): Promise<SavedChat | null> {
  if (userId) {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('chats')
      .select('*, chat_messages:messages(*)')
      .eq('id', id)
      .single()

    if (error) return null

    const sortedMessages = (
      (data.chat_messages || []) as DatabaseMessage[]
    ).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

    return {
      id: data.id,
      title: data.title,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      messages: sortedMessages.map((m) => ({
        id: m.id,
        role: m.role as ChatMessage['role'],
        content: m.content,
        richContent: m.rich_content,
        reasoning: m.reasoning,
        thinkingDurationSeconds: m.thinking_duration_seconds,
        suggestions: m.suggestions,
        name: m.name,
      })),
    }
  }

  const chats = getLocalChats()
  return chats.find((chat) => chat.id === id) || null
}

/**
 * Save or update a chat
 *
 * For authenticated users, upserts to Supabase.
 * For guests, saves to localStorage and dispatches 'history-updated' event.
 *
 * @param chat - The chat to save
 * @param userId - User ID for authenticated users, undefined for guests
 */
export async function saveChat(chat: SavedChat, userId?: string) {
  if (userId) {
    const supabase = getSupabase()

    // 1. Upsert chat metadata
    const { error: chatError } = await supabase.from('chats').upsert({
      id: chat.id,
      user_id: userId,
      title: chat.title,
      created_at: new Date(chat.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (chatError) {
      console.error('Failed to save chat', chatError)
      return
    }

    // 2. Upsert messages
    const messagesPayload = chat.messages.map((m) => ({
      id: m.id,
      chat_id: chat.id,
      role: m.role,
      content: m.content,
      rich_content: m.richContent,
      reasoning: m.reasoning,
      thinking_duration_seconds: m.thinkingDurationSeconds,
      suggestions: m.suggestions,
      name: m.name,
    }))

    const { error: msgError } = await supabase
      .from('messages')
      .upsert(messagesPayload)
    if (msgError) {
      console.error('Failed to save messages', msgError)
    }

    // 3. Delete messages that are no longer in the chat (e.g. deleted by user)
    const currentIds = chat.messages.map((m) => m.id)
    if (currentIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chat.id)
        .filter('id', 'not.in', `(${currentIds.join(',')})`)

      if (deleteError) {
        console.error('Failed to delete pruned messages', deleteError)
      }
    } else {
      await supabase.from('messages').delete().eq('chat_id', chat.id)
    }

    return
  }

  // LocalStorage path
  const chats = getLocalChats()
  const index = chats.findIndex((c) => c.id === chat.id)

  if (index >= 0) {
    chats[index] = chat
  } else {
    chats.push(chat)
  }

  setLocalChats(chats)
  dispatchHistoryUpdate()
}

/**
 * Delete a chat by ID
 *
 * @param id - Chat ID to delete
 * @param userId - User ID for authenticated users, undefined for guests
 */
export async function deleteChat(id: string, userId?: string) {
  if (userId) {
    const supabase = getSupabase()
    await supabase.from('chats').delete().eq('id', id)
    // Messages will be deleted automatically via ON DELETE CASCADE
    return
  }

  const chats = getLocalChats()
  const newChats = chats.filter((c) => c.id !== id)
  setLocalChats(newChats)
  dispatchHistoryUpdate()
}

/**
 * Clear all chat history for a user
 *
 * @param userId - User ID for authenticated users, undefined for guests
 */
export async function clearHistory(userId?: string) {
  if (userId) {
    const supabase = getSupabase()
    await supabase.from('chats').delete().eq('user_id', userId)
    // Messages will be deleted automatically via ON DELETE CASCADE
    return
  }

  clearLocalChats()
  dispatchHistoryUpdate()
}

/**
 * Create a new chat with default values
 *
 * @param messages - Optional initial messages
 * @returns A new SavedChat object with generated ID
 */
export function createChat(messages: ChatMessage[] = []): SavedChat {
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages,
  }
}
