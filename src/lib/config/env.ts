import { z } from 'zod'

const envSchema = z.object({
  // Server-side variables
  OPENAI_API_KEY: z.string().min(1).optional(),
  
  // Client-side variables (NEXT_PUBLIC_)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

// Validate environment variables
// Note: Next.js automatically inlines NEXT_PUBLIC_ variables at build time,
// but process.env access is still required for runtime validation in this file.
const parsed = envSchema.safeParse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

if (!parsed.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(parsed.error.format(), null, 4)
  )
}

export const env = parsed.success ? parsed.data : (process.env as unknown as z.infer<typeof envSchema>)
