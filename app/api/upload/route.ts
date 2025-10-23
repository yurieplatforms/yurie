import { NextRequest } from 'next/server'
import { handleUpload } from '@vercel/blob/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

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
    ]

    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (_pathname, _clientPayload, _multipart) => {
        return {
          allowedContentTypes,
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
          allowOverwrite: false,
        }
      },
      // Optionally, update your DB when uploads finish
      // onUploadCompleted: async ({ blob }) => {}
    })

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to handle upload' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}


