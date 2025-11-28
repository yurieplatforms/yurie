import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Agent modules
import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { convertToAnthropicContent } from '@/lib/agent/message-converter'
import { runAgent } from '@/lib/agent/runner'

// API types
import type { AgentRequestBody } from '@/lib/api/types'
import type { EffortLevel } from '@/lib/agent/types'

// User context
import {
  getUserPersonalizationContext,
  getUserName,
  formatMemoriesForPrompt,
} from '@/lib/agent/user-context'
import { env } from '@/lib/env'

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

  const { messages, userContext, userLocation, effort } = body

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
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      userId = user.id
      const personalizationContext = await getUserPersonalizationContext(supabase, user.id)
      userName = getUserName(personalizationContext)
      memoriesPrompt = formatMemoriesForPrompt(personalizationContext)
    }
  } catch (e) {
    // Silently continue without personalization if it fails
    console.error('[agent] Failed to fetch user personalization', e)
  }

  // Build system prompt with user context
  const systemPrompt = buildSystemPrompt({
    userName,
    userContext,
    memoriesPrompt,
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
      effort: validatedEffort,
    })
  } catch (error) {
    console.error('[agent] Unexpected error', error)

    return NextResponse.json(
      { error: 'Unexpected error while contacting Claude' },
      { status: 500 },
    )
  }
}
