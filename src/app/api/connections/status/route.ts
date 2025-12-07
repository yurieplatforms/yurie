import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getComposioClient } from '@/lib/composio/client'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const connectionId = searchParams.get('connectionId')

  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId is required' }, { status: 400 })
  }

  const composio = getComposioClient()
  if (!composio) {
    return NextResponse.json({ error: 'Composio not configured' }, { status: 500 })
  }

  try {
    // Wait for connection to complete
    const connection = await composio.connectedAccounts.waitForConnection(connectionId)

    return NextResponse.json({
      id: connection.id,
      status: connection.status,
      authConfig: connection.authConfig,
      data: connection.data,
    })
  } catch (error) {
    console.error('Error checking connection status:', error)
    return NextResponse.json({ error: 'Failed to check connection status' }, { status: 500 })
  }
}

