import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getComposioClient } from '@/lib/composio/client'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const composio = getComposioClient()
  if (!composio) {
    return NextResponse.json({ error: 'Composio not configured' }, { status: 500 })
  }

  try {
    // List connected accounts to get connection IDs for each toolkit
    const connectedAccounts = await composio.connectedAccounts.list({
      userIds: [user.id],
    })

    const connectedToolkitMap = new Map()
    connectedAccounts.items.forEach((account) => {
      if (account.toolkit) {
        connectedToolkitMap.set(account.toolkit.slug.toUpperCase(), account.id)
      }
    })

    const SUPPORTED_TOOLKITS = ['GMAIL', 'GOOGLECALENDAR', 'NOTION']

    // Fetch toolkit data from slugs
    const toolkitPromises = SUPPORTED_TOOLKITS.map(async (slug) => {
      try {
        const toolkit = await composio.toolkits.get(slug)
        const connectionId = connectedToolkitMap.get(slug.toUpperCase())

        return {
          name: toolkit.name,
          slug: toolkit.slug,
          description: toolkit.meta?.description,
          logo: toolkit.meta?.logo,
          categories: toolkit.meta?.categories,
          isConnected: !!connectionId,
          connectionId: connectionId || undefined,
        }
      } catch (e) {
        console.error(`Failed to fetch toolkit ${slug}`, e)
        return null
      }
    })

    const toolkits = (await Promise.all(toolkitPromises)).filter(Boolean)
    return NextResponse.json({ toolkits })
  } catch (error) {
    console.error('Error fetching toolkits:', error)
    return NextResponse.json({ error: 'Failed to fetch toolkits' }, { status: 500 })
  }
}

