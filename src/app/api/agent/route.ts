import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'

// Agent modules
import { buildSystemPrompt } from '@/agent/system-prompt'
import { convertToAnthropicContent } from '@/agent/message-converter'
import { runAgent } from '@/agent/runner'

// API types
import type { AgentRequestBody } from '@/types/api'
import type { EffortLevel } from '@/agent/types'

// User context
import {
  getUserPersonalizationContext,
  getUserName,
  formatMemoriesForPrompt,
} from '@/agent/user-context'
import { env } from '@/config/env'
import { findSpotifyConnectionId, isSpotifyToolsAvailable } from '@/services/composio'

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

  const { messages, userContext, userLocation, effort, selectedTools } = body

  // Validate effort level if provided
  const validEffortLevels: EffortLevel[] = ['low', 'medium', 'high']
  const validatedEffort: EffortLevel =
    effort && validEffortLevels.includes(effort) ? effort : 'high'

  const apiKey = env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'ANTHROPIC_API_KEY is not set. Add it to your environment variables.',
      },
      { status: 500 },
    )
  }

  // Fetch user personalization context if user is authenticated
  let userName: string | null = null
  let memoriesPrompt = ''
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
  let spotifyContext: { isConnected: boolean; connectionId?: string } | null = null
  
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      userId = user.id
      const personalizationContext = await getUserPersonalizationContext(supabase, user.id)
      userName = getUserName(personalizationContext)
      memoriesPrompt = formatMemoriesForPrompt(personalizationContext)
      
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

      // Get Spotify connection
      if (isSpotifyToolsAvailable()) {
        const connectionId = await findSpotifyConnectionId(user.id)
        if (connectionId) {
          spotifyContext = { isConnected: true, connectionId }
          console.log(`[agent] Using Spotify connection: ${connectionId}`)
        }
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
    memoriesPrompt,
    focusedRepo,
    spotifyContext,
  })

  // Convert messages to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: convertToAnthropicContent(msg.content),
  }))

  try {
    return await runAgent({
      apiKey,
      messages: anthropicMessages,
      systemPrompt,
      userLocation,
      userId,
      focusedRepo,
      effort: validatedEffort,
      selectedTools,
    })
  } catch (error) {
    console.error('[agent] Unexpected error', error)

    return NextResponse.json(
      { error: 'Unexpected error while contacting Claude' },
      { status: 500 },
    )
  }
}
