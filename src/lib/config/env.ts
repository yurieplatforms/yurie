import { z } from 'zod'

const envSchema = z.object({
  // Server-side variables
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  EXA_API_KEY: z.string().min(1).optional(),
  COMPOSIO_API_KEY: z.string().min(1).optional(),
  
  // Client-side variables (NEXT_PUBLIC_)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

// Validate environment variables
// Note: Next.js automatically inlines NEXT_PUBLIC_ variables at build time,
// but process.env access is still required for runtime validation in this file.
const parsed = envSchema.safeParse({
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  EXA_API_KEY: process.env.EXA_API_KEY,
  COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

if (!parsed.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(parsed.error.format(), null, 4)
  )
  // Only throw in production to avoid crashing dev server unnecessarily if something is temporarily missing,
  // but generally we want to fail fast.
  // However, for build time, we might need to be careful if env vars aren't present.
  // For now, we'll just log error if it's not valid.
}

export const env = parsed.success ? parsed.data : (process.env as unknown as z.infer<typeof envSchema>)

