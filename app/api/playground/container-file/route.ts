export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const container_id = url.searchParams.get('container_id') || ''
    const file_id = url.searchParams.get('file_id') || ''
    const filename = url.searchParams.get('filename') || 'file'

    if (!container_id || !file_id) {
      return new Response('Missing container_id or file_id', { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY server env var' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const urlStr = `https://api.openai.com/v1/containers/${encodeURIComponent(container_id)}/files/${encodeURIComponent(file_id)}/content`
    const resp = await fetch(urlStr, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    if (!resp.ok || !resp.body) {
      return new Response('Failed to fetch file content', { status: resp.status })
    }

    return new Response(resp.body as any, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('Container file download error', error)
    return new Response('Internal server error', { status: 500 })
  }
}

