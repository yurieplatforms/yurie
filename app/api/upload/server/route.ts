import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url)
		const filename = searchParams.get('filename') || `upload-${Date.now()}`
		// Server uploads are limited (~4.5 MB). request.body is a ReadableStream.
		const blob = await put(filename, request.body as any, {
			access: 'public',
		})
		return NextResponse.json(blob)
	} catch (err) {
		return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
	}
}
