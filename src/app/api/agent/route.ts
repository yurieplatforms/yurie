import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Agent modules
import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { convertToOpenAIContent } from '@/lib/agent/message-converter'
import { runAgent } from '@/lib/agent/runner'

// API types
import type { AgentRequestBody } from '@/lib/api/types'

// User context
import {
  getUserPersonalizationContext,
  getUserName,
} from '@/lib/agent/user-context'
import { env } from '@/lib/config/env'

export async function POST(request: Request) {
  let body: AgentRequestBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: 'Request must include at least one message' },
      { status: 400 },
    )
  }

  const { messages, userContext, userLocation } = body

  const apiKey = env.XAI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'XAI_API_KEY is not set. Add it to your environment variables.',
      },
      { status: 500 },
    )
  }

  // Fetch user personalization context if user is authenticated
  let userName: string | null = null
  let userId: string | undefined
  let userPreferences: { birthday?: string | null; location?: string | null; timezone?: string | null } = {}
  let focusedRepo: {
    owner: string
    name: string
    fullName: string
    description: string | null
    htmlUrl: string
    private: boolean
    language: string | null
    defaultBranch: string
  } | null = null
  
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      userId = user.id
      const personalizationContext = await getUserPersonalizationContext(supabase, user.id)
      userName = getUserName(personalizationContext)
      
      // Extract user preferences from profile
      if (personalizationContext.profile) {
        userPreferences = {
          birthday: personalizationContext.profile.birthday,
          location: personalizationContext.profile.location,
          timezone: personalizationContext.profile.timezone,
        }
      }
      
      // Get focused GitHub repo if set
      const githubFocusedRepo = user.user_metadata?.github_focused_repo as {
        owner: string
        name: string
        fullName: string
        description: string | null
        htmlUrl: string
        private: boolean
        language: string | null
        defaultBranch: string
      } | undefined
      if (githubFocusedRepo) {
        focusedRepo = githubFocusedRepo
        console.log(`[agent] Using focused GitHub repo: ${githubFocusedRepo.fullName}`)
      }
    }
  } catch (e) {
    // Silently continue without personalization if it fails
    console.error('[agent] Failed to fetch user personalization', e)
  }

  // Build system prompt with user context and preferences
  const systemPrompt = buildSystemPrompt({
    userName,
    userContext,
    userPreferences,
    focusedRepo,
  })

  // Convert messages to OpenAI format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openAIMessages: any[] = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: convertToOpenAIContent(msg.content),
  }))

  try {
    return await runAgent({
      apiKey,
      messages: openAIMessages,
      systemPrompt,
      userLocation,
      userId,
      focusedRepo,
    })
  } catch (error) {
    console.error('[agent] Unexpected error', error)

    return NextResponse.json(
      { error: 'Unexpected error while contacting xAI' },
      { status: 500 },
    )
  }
}
