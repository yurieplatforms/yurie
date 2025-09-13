import Link from 'next/link'
import { getResearchPosts, formatDate } from 'app/research/utils'

export const metadata = {
  title: 'Research',
  description: 'In-depth explorations and technical investigations.',
}

export default function Page() {
  let posts = getResearchPosts()

  return (
    <section>
      <h1 className="font-semibold text-2xl mb-8 tracking-tighter px-3 sm:px-4">Research</h1>
      <div className="my-8">
        {posts
          .sort((a, b) => {
            if (new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)) {
              return -1
            }
            return 1
          })
          .map((post) => (
            <Link
              key={post.slug}
              className="flex flex-col mb-1 last:mb-0 rounded-xl px-3 sm:px-4 py-3 transition-colors hover:bg-[var(--surface-hover)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700"
              href={`/research/${post.slug}`}
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
    </section>
  )
}


