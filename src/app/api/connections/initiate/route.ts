import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getComposioClient } from '@/lib/composio/client'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { authConfigId } = body

  if (!authConfigId) {
    return NextResponse.json({ error: 'authConfigId is required' }, { status: 400 })
  }

  const composio = getComposioClient()
  if (!composio) {
    return NextResponse.json({ error: 'Composio not configured' }, { status: 500 })
  }

  try {
    // Initiate connection with Composio
    const connectionRequest = await composio.connectedAccounts.initiate(
      user.id,
      authConfigId
    )

    return NextResponse.json({
      redirectUrl: connectionRequest.redirectUrl,
      connectionId: connectionRequest.id,
    })
  } catch (error) {
    console.error('Error initiating connection:', error)
    return NextResponse.json({ error: 'Failed to initiate connection' }, { status: 500 })
  }
}

