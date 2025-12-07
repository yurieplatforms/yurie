import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getComposioClient } from '@/lib/composio/client'

export async function DELETE(request: Request) {
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
    // Delete the connection
    await composio.connectedAccounts.delete(connectionId)

    return NextResponse.json({
      success: true,
      message: 'Connection deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting connection:', error)
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 })
  }
}

