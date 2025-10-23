import { NextRequest } from 'next/server'
import { createUploadURL } from '@vercel/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType } = (await request.json?.()) || {}

    const allowedContentTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
      'image/avif',
      'image/heic',
      'image/heif',
    ] as const

    if (typeof contentType === 'string' && contentType.length > 0) {
      if (!allowedContentTypes.includes(contentType as any)) {
        return new Response(JSON.stringify({ error: 'Unsupported content type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    const { url } = await createUploadURL({
      access: 'public',
      allowedContentTypes: allowedContentTypes as unknown as string[],
    })

    return new Response(JSON.stringify({ uploadUrl: url, filename }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to create upload URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}


