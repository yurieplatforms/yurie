import { handleAgentPOST } from '@/lib/ai/api/agent/handler'

export async function POST(request: Request) {
  return handleAgentPOST(request)
}
