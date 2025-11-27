import { createClient } from '@/app/supabase/client'
import { SavedChat, ChatMessage } from '@/lib/types'
import { SupabaseClient } from '@supabase/supabase-js'

const STORAGE_KEY = 'yurie-chat-history'

const getSupabase = () => createClient()

export async function getUserChats(
  userId: string,
  supabase: SupabaseClient
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
    const sortedMessages = (chat.chat_messages || []).sort(
      (a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

    return {
      id: chat.id,
      title: chat.title,
      createdAt: new Date(chat.created_at).getTime(),
      updatedAt: new Date(chat.updated_at).getTime(),
      messages: sortedMessages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        // Only include minimal fields for list view
      })),
    }
  })
}

export async function getChats(userId?: string): Promise<SavedChat[]> {
  if (userId) {
    const supabase = getSupabase()
    return getUserChats(userId, supabase)
  }

  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return []
  try {
    const chats = JSON.parse(stored)
    return chats.sort((a: SavedChat, b: SavedChat) => b.updatedAt - a.updatedAt)
  } catch (e) {
    console.error('Failed to parse chat history', e)
    return []
  }
}

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

    const sortedMessages = (data.chat_messages || []).sort(
      (a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

    return {
      id: data.id,
      title: data.title,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      messages: sortedMessages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        richContent: m.rich_content,
        reasoning: m.reasoning,
        thinkingDurationSeconds: m.thinking_duration_seconds,
        suggestions: m.suggestions,
        name: m.name,
      })),
    }
  }

  if (typeof window === 'undefined') return null
  // Local storage fallback
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  try {
    const chats = JSON.parse(stored) as SavedChat[]
    return chats.find((chat) => chat.id === id) || null
  } catch {
    return null
  }
}

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

    const { error: msgError } = await supabase.from('messages').upsert(messagesPayload)
    if (msgError) {
      console.error('Failed to save messages', msgError)
    }

    // 3. Delete messages that are no longer in the chat (e.g. deleted by user)
    const currentIds = chat.messages.map((m) => m.id)
    if (currentIds.length > 0) {
      // Correct usage for Supabase JS client: .not('id', 'in', array_of_values)
      // The client handles serialization. Previous attempt with manual string formatting caused "invalid input syntax for type uuid"
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

  if (typeof window === 'undefined') return
  const stored = localStorage.getItem(STORAGE_KEY)
  const chats: SavedChat[] = stored ? JSON.parse(stored) : []
  const index = chats.findIndex((c) => c.id === chat.id)

  if (index >= 0) {
    chats[index] = chat
  } else {
    chats.push(chat)
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new Event('history-updated'))
  }
}

export async function deleteChat(id: string, userId?: string) {
  if (userId) {
    const supabase = getSupabase()
    await supabase.from('chats').delete().eq('id', id)
    // Messages will be deleted automatically via ON DELETE CASCADE
    return
  }

  if (typeof window === 'undefined') return
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return
  const chats: SavedChat[] = JSON.parse(stored)
  const newChats = chats.filter((c) => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newChats))
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new Event('history-updated'))
  }
}

export async function clearHistory(userId?: string) {
  if (userId) {
    const supabase = getSupabase()
    await supabase.from('chats').delete().eq('user_id', userId)
    // Messages will be deleted automatically via ON DELETE CASCADE
    return
  }

  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new Event('history-updated'))
  }
}

export function createChat(messages: ChatMessage[] = []): SavedChat {
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages,
  }
}

