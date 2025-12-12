/**
 * Agent API handler (Next.js route logic)
 *
 * Keeps `src/app/api/agent/route.ts` thin by moving orchestration here.
 */

import { NextResponse } from 'next/server'
import {
  buildSystemPrompt,
  classifyRequest,
  type ClassificationResult,
  type RequestMode,
} from '@/lib/ai/agent'
import {
  convertToOpenAIContent,
  sanitizeMessageContent,
} from '@/lib/ai/agent/message-converter'
import type { AgentRequestBody } from '@/lib/ai/api/types'
import {
  checkRateLimit,
  createOpenAIClient,
  generateRequestId,
  getRateLimitWaitTime,
  getOpenAIConfigForMode,
  validateMessages,
} from '@/lib/ai/api/openai'
import { env } from '@/lib/config/env'
import { loadIntegrationTools } from './integrations'
import { createAgentSSEResponse } from './stream'
import { getAgentUserContext } from './user'

function buildToolsForRequest(options: {
  mode: RequestMode
  classification: ClassificationResult
  gmailTools: unknown[]
  spotifyTools: unknown[]
  githubTools: unknown[]
}): unknown[] | undefined {
  const { mode, classification, gmailTools, spotifyTools, githubTools } = options

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tools: any[] | undefined

  if (mode === 'agent') {
    tools = [{ type: 'web_search' }, { type: 'image_generation' }]

    if (gmailTools.length > 0) tools.push(...gmailTools)
    if (spotifyTools.length > 0) tools.push(...spotifyTools)
    if (githubTools.length > 0) tools.push(...githubTools)

    console.log(
      '[agent] Agent mode tools:',
      tools.map((t) => t.type || t.function?.name || 'unknown').join(', '),
    )

    return tools
  }

  // Chat mode: include only explicitly recommended builtin tools
  const recommended = new Set(classification.toolsRecommended)

  if (recommended.has('web_search')) {
    tools = [{ type: 'web_search' }]
  }

  if (recommended.has('image_generation')) {
    tools = tools ? [...tools, { type: 'image_generation' }] : [{ type: 'image_generation' }]
  }

  if (tools?.length) {
    console.log(
      '[agent] Chat mode tools:',
      tools.map((t) => t.type || t.function?.name || 'unknown').join(', '),
    )
  } else {
    console.log('[agent] Chat mode without tools')
  }

  return tools
}

export async function handleAgentPOST(request: Request): Promise<Response> {
  const requestId = generateRequestId()
  const startTime = Date.now()

  let body: AgentRequestBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', requestId }, { status: 400 })
  }

  if (!Array.isArray(body?.messages)) {
    return NextResponse.json(
      { error: 'Messages must be an array', requestId },
      { status: 400 },
    )
  }

  const sanitizedMessages = body.messages.map((msg) => ({
    ...msg,
    content: sanitizeMessageContent(msg.content),
  }))

  const validation = validateMessages(sanitizedMessages)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error, requestId }, { status: 400 })
  }

  const {
    userContext,
    selectedTools = [],
    chatId,
    messageId,
    researchMode = false,
    imageGenMode = false,
  } = body

  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'OPENAI_API_KEY is not set. Add it to your environment variables.',
        requestId,
      },
      { status: 500 },
    )
  }

  const openai = createOpenAIClient({ apiKey, timeout: 120000 })

  // Auth + personalization (best-effort)
  const { userId, userName, userPreferences, supabase } =
    await getAgentUserContext()

  // Rate limiting: 10 requests per user, refill 1 per second
  const rateLimitKey =
    userId || request.headers.get('x-forwarded-for') || 'anonymous'

  if (!checkRateLimit(rateLimitKey, 10, 1)) {
    const waitTime = getRateLimitWaitTime(rateLimitKey, 10, 1)

    return NextResponse.json(
      {
        error: `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`,
        requestId,
        retryAfter: Math.ceil(waitTime / 1000),
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(waitTime / 1000)) },
      },
    )
  }

  const forceImageGen = Boolean(imageGenMode)

  // Image generation mode is mutually exclusive with app tools.
  // It forces the built-in image generation tool and skips Composio loading.
  const effectiveSelectedTools = forceImageGen ? [] : selectedTools

  // Fetch integration tools (Composio) based on selected apps
  const { gmailTools, spotifyTools, githubTools, enabledCapabilities } =
    await loadIntegrationTools({ userId, selectedTools: effectiveSelectedTools })

  // Classify with all capabilities (even if tool is conditionally enabled)
  const classification = classifyRequest(sanitizedMessages, {
    selectedTools: effectiveSelectedTools,
    connectedIntegrations: [...enabledCapabilities, 'image_generation'],
  })

  const mode: RequestMode = forceImageGen ? 'agent' : classification.mode
  const effectiveMode: 'chat' | 'agent' | 'research' = researchMode ? 'research' : mode
  const { model: selectedModel, reasoningEffort } = getOpenAIConfigForMode(effectiveMode)
  console.log(
    `[agent] Mode: ${mode} (${classification.reason}, confidence: ${classification.confidence})${researchMode ? ' [RESEARCH MODE]' : ''}`,
  )
  console.log(
    `[agent] Model: ${selectedModel}, reasoning effort: ${reasoningEffort}, tools recommended: ${classification.toolsRecommended.join(', ') || 'none'}`,
  )

  const tools = forceImageGen
    ? [{ type: 'image_generation' }]
    : buildToolsForRequest({
        mode,
        classification,
        gmailTools,
        spotifyTools,
        githubTools,
      })

  // Only include capabilities that are actually available as tools
  const enabledCapabilitiesForPrompt = [...enabledCapabilities]
  if (tools?.some((t) => (t as { type?: string })?.type === 'image_generation')) {
    enabledCapabilitiesForPrompt.push('image_generation')
  }

  const systemPrompt = buildSystemPrompt({
    userName,
    userContext,
    userPreferences,
    enabledCapabilities: enabledCapabilitiesForPrompt,
    mode: researchMode ? 'research' : mode,
  })

  // Convert messages to OpenAI format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openAIMessages: any[] = sanitizedMessages.map((msg) => {
    const openAIRole = msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant'
    const contentRole = openAIRole === 'assistant' ? 'assistant' : 'user'

    return {
      role: openAIRole,
      content: convertToOpenAIContent(msg.content, contentRole),
    }
  })

  try {
    return createAgentSSEResponse({
      requestId,
      startTime,
      openai,
      userId,
      supabase,
      chatId,
      messageId,
      systemPrompt,
      openAIMessages,
      tools,
      mode,
      classification,
      researchMode,
      imageGenMode: forceImageGen,
      messageCount: sanitizedMessages.length,
    })
  } catch (error) {
    console.error('[agent] Unexpected error', error)
    return NextResponse.json(
      { error: 'Unexpected error while contacting agent', requestId },
      { status: 500 },
    )
  }
}

