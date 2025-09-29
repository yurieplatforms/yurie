export const runtime = 'nodejs'

import { getPostsFromAppSubdir, type Post } from '@/lib/posts'

type PostListItem = {
  type: 'blog' | 'research'
  slug: string
  title: string
  summary: string
  image?: string
}

function listAll(): PostListItem[] {
  const blog = getPostsFromAppSubdir('blog/posts')
  const research = getPostsFromAppSubdir('research/posts')
  const toItem = (type: 'blog' | 'research') => (p: Post): PostListItem => ({
    type,
    slug: p.slug,
    title: p.metadata.title,
    summary: p.metadata.summary,
    image: p.metadata.image,
  })
  return [
    ...blog.map(toItem('blog')),
    ...research.map(toItem('research')),
  ]
}

function findOne(
  type: 'blog' | 'research' | 'all',
  slug: string
): (Post & { type: 'blog' | 'research' }) | null {
  const tryFind = (t: 'blog' | 'research') => {
    const posts = getPostsFromAppSubdir(`${t}/posts`)
    const found = posts.find((p) => p.slug === slug)
    return found ? { ...found, type: t } : null
  }
  if (type === 'all') {
    return tryFind('blog') || tryFind('research')
  }
  return tryFind(type)
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const typeParam = (url.searchParams.get('type') || 'all').toLowerCase()
    const type: 'blog' | 'research' | 'all' =
      typeParam === 'blog' || typeParam === 'research' ? (typeParam as any) : 'all'
    const slug = url.searchParams.get('slug')

    if (slug) {
      const found = findOne(type, slug)
      if (!found) {
        return new Response(
          JSON.stringify({ error: { code: 404, message: 'Post not found' } }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({
          post: {
            type: found.type,
            slug: found.slug,
            title: found.metadata.title,
            summary: found.metadata.summary,
            content: found.content,
            image: found.metadata.image,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const items = listAll()
    return new Response(
      JSON.stringify({ posts: items }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return new Response(
      JSON.stringify({ error: { code: 500, message: msg } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}


