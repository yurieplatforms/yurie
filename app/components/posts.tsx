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
  const sorted = posts
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
          className="mb-1 flex flex-col rounded-xl px-3 py-3 transition-colors last:mb-0 hover:bg-[var(--surface-hover)] hover:opacity-100 focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:outline-none sm:px-4 dark:focus-visible:ring-neutral-700"
          href={`${basePath}/${post.slug}`}
        >
          <div className="flex w-full items-center gap-3 sm:gap-4">
            {post.metadata.image ? (
              <img
                src={post.metadata.image}
                alt={post.metadata.title}
                loading="lazy"
                className="h-16 w-16 flex-shrink-0 rounded-md bg-neutral-100 object-cover dark:bg-neutral-800"
              />
            ) : null}
            <div className="flex flex-col space-y-1">
              <p className="text-xs leading-4 text-neutral-600 tabular-nums dark:text-neutral-400">
                {formatDate(post.metadata.publishedAt, false)}
              </p>
              <p className="text-base leading-tight tracking-tight text-neutral-900 dark:text-neutral-100">
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
  const { getBlogPosts } =
    require('app/blog/utils') as typeof import('app/blog/utils')
  const allBlogs = getBlogPosts()
  return <PostList basePath="/blog" posts={allBlogs} limit={limit} />
}
