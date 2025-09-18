import Link from 'next/link'
import { formatDate } from 'app/lib/posts'

export type PostListItem = {
  slug: string
  metadata: {
    title: string
    publishedAt: string
    image?: string
  }
}

type ListProps = {
  basePath: '/blog' | '/research'
  posts: PostListItem[]
  limit?: number
}

export function PostList({ basePath, posts, limit }: ListProps) {
  let sorted = posts
    .sort((a, b) => {
      if (new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)) {
        return -1
      }
      return 1
    })
    .slice(0, limit ?? posts.length)

  return (
    <div>
      {sorted.map((post) => (
        <Link
          key={post.slug}
          className="flex flex-col mb-1 last:mb-0 rounded-xl px-3 sm:px-4 py-3 transition-colors hover:bg-[var(--surface-hover)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700"
          href={`${basePath}/${post.slug}`}
        >
          <div className="w-full flex items-center gap-3 sm:gap-4">
            {post.metadata.image ? (
              <img
                src={post.metadata.image}
                alt={post.metadata.title}
                loading="lazy"
                className="w-16 h-16 rounded-md object-cover bg-neutral-100 dark:bg-neutral-800 flex-shrink-0"
              />
            ) : null}
            <div className="flex flex-col space-y-1">
              <p className="text-neutral-600 dark:text-neutral-400 tabular-nums text-xs leading-4">
                {formatDate(post.metadata.publishedAt, false)}
              </p>
              <p className="text-neutral-900 dark:text-neutral-100 tracking-tight text-base leading-tight">
                {post.metadata.title}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// Back-compat wrapper for Blog listing
export function BlogPosts({ limit }: { limit?: number }) {
  // Import locally to avoid circular deps if utils import PostList in future
  const { getBlogPosts } = require('app/blog/utils') as typeof import('app/blog/utils')
  let allBlogs = getBlogPosts()
  return <PostList basePath="/blog" posts={allBlogs} limit={limit} />
}
