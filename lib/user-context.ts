import { SupabaseClient } from '@supabase/supabase-js'

export type UserProfile = {
  id: string
  name: string | null
  email: string | null
}

export type ConversationMemory = {
  title: string
  date: string
  // All user messages - captures everything they've shared
  userMessages: string[]
  // All assistant responses for full context
  assistantMessages: string[]
  // Total message count
  totalMessages: number
}

export type UserPersonalizationContext = {
  profile: UserProfile | null
  memories: ConversationMemory[]
  totalConversations: number
  totalUserMessages: number
}

/**
 * Fetches user profile information from Supabase auth
 */
export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  return {
    id: user.id,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email ?? null,
  }
}

/**
 * Fetches ALL conversation memories - no limits
 * Extracts every message to build complete user knowledge
 */
export async function getConversationMemories(
  supabase: SupabaseClient,
  userId: string
): Promise<{ memories: ConversationMemory[]; totalUserMessages: number }> {
  // Fetch ALL conversations - no limit
  const { data: chats, error } = await supabase
    .from('chats')
    .select(`
      id,
      title,
      updated_at,
      messages:messages(content, role, created_at)
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error || !chats) {
    console.error('Failed to fetch conversation memories', error)
    return { memories: [], totalUserMessages: 0 }
  }

  let totalUserMessages = 0

  const memories = chats.map((chat) => {
    const messages = (chat.messages || []).sort(
      (a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Extract ALL user messages (filter out very short/empty ones)
    const userMessages = messages
      .filter((m: any) => m.role === 'user' && m.content && m.content.trim().length > 10)
      .map((m: any) => cleanText(m.content, 500))

    // Extract ALL assistant messages for context
    const assistantMessages = messages
      .filter((m: any) => m.role === 'assistant' && m.content && m.content.trim().length > 20)
      .map((m: any) => cleanText(m.content, 300))

    totalUserMessages += userMessages.length

    return {
      title: chat.title,
      date: formatDate(chat.updated_at),
      userMessages,
      assistantMessages,
      totalMessages: messages.length,
    }
  }).filter(memory => memory.userMessages.length > 0)

  return { memories, totalUserMessages }
}

/**
 * Gets the full user personalization context for the agent
 */
export async function getUserPersonalizationContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPersonalizationContext> {
  const [profile, { memories, totalUserMessages }] = await Promise.all([
    getUserProfile(supabase, userId),
    getConversationMemories(supabase, userId),
  ])

  return {
    profile,
    memories,
    totalConversations: memories.length,
    totalUserMessages,
  }
}

/**
 * Gets just the user's name from the context
 */
export function getUserName(context: UserPersonalizationContext): string | null {
  return context.profile?.name ?? null
}

/**
 * Formats ALL memories into a comprehensive prompt
 * Prioritizes recent conversations but includes everything
 */
export function formatMemoriesForPrompt(
  context: UserPersonalizationContext
): string {
  if (context.memories.length === 0) {
    return ''
  }

  const parts: string[] = []
  
  // Stats header
  parts.push(`[${context.totalConversations} conversations, ${context.totalUserMessages} messages in memory]\n`)

  // Recent conversations (last 10) - full detail
  const recentMemories = context.memories.slice(0, 10)
  if (recentMemories.length > 0) {
    parts.push('## Recent Conversations (Full Detail)\n')
    
    recentMemories.forEach((memory) => {
      parts.push(`### ${memory.title} (${memory.date})`)
      
      // All user messages
      memory.userMessages.forEach((msg, i) => {
        parts.push(`User[${i + 1}]: "${msg}"`)
      })
      
      // Summary of assistant responses
      if (memory.assistantMessages.length > 0) {
        const firstResponse = memory.assistantMessages[0]
        parts.push(`You helped with: ${firstResponse}`)
      }
      parts.push('')
    })
  }

  // Older conversations (10+) - condensed but still included
  const olderMemories = context.memories.slice(10)
  if (olderMemories.length > 0) {
    parts.push('\n## Older Conversations (Condensed)\n')
    
    olderMemories.forEach((memory) => {
      // Include first few messages from each older conversation
      const keyMessages = memory.userMessages.slice(0, 2).join(' | ')
      if (keyMessages) {
        parts.push(`• **${memory.title}** (${memory.date}): ${keyMessages}`)
      }
    })
  }

  return parts.join('\n')
}

/**
 * Cleans and truncates text while preserving meaning
 */
function cleanText(text: string, maxLength: number): string {
  if (!text) return ''
  // Clean up excessive whitespace, newlines, and normalize
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
  
  if (cleaned.length <= maxLength) return cleaned
  
  // Try to cut at a sentence boundary
  const truncated = cleaned.slice(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastQuestion = truncated.lastIndexOf('?')
  const lastExclaim = truncated.lastIndexOf('!')
  const lastSentence = Math.max(lastPeriod, lastQuestion, lastExclaim)
  
  if (lastSentence > maxLength * 0.6) {
    return truncated.slice(0, lastSentence + 1)
  }
  
  return truncated + '...'
}

/**
 * Formats date in a readable way
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}
