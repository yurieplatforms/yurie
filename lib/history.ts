import { SavedChat, ChatMessage } from './types'

const STORAGE_KEY = 'yurie-chat-history'

export function getChats(): SavedChat[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return []
  try {
    const chats = JSON.parse(stored)
    // Sort by updatedAt desc
    return chats.sort((a: SavedChat, b: SavedChat) => b.updatedAt - a.updatedAt)
  } catch (e) {
    console.error('Failed to parse chat history', e)
    return []
  }
}

export function getChat(id: string): SavedChat | null {
  const chats = getChats()
  return chats.find((chat) => chat.id === id) || null
}

export function saveChat(chat: SavedChat) {
  if (typeof window === 'undefined') return
  const chats = getChats()
  const index = chats.findIndex((c) => c.id === chat.id)

  if (index >= 0) {
    chats[index] = chat
  } else {
    chats.push(chat)
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  window.dispatchEvent(new Event('history-updated'))
}

export function deleteChat(id: string) {
  if (typeof window === 'undefined') return
  const chats = getChats()
  const newChats = chats.filter((c) => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newChats))
  window.dispatchEvent(new Event('history-updated'))
}

export function clearHistory() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('history-updated'))
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

