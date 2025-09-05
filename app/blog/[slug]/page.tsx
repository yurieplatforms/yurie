import { notFound } from 'next/navigation'
import { marked } from 'marked'
import { formatDate, getBlogPosts } from 'app/blog/utils'
import { baseUrl } from 'app/sitemap'

export async function generateStaticParams() {
  let posts = getBlogPosts()

  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let post = getBlogPosts().find((post) => post.slug === slug)
  if (!post) {
    return
  }

  const safePost = post!

  let {
    title,
    publishedAt: publishedTime,
    summary: description,
    image,
  } = safePost.metadata
  let ogImage = image
    ? image
    : `${baseUrl}/og?title=${encodeURIComponent(title)}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime,
      url: `${baseUrl}/blog/${safePost.slug}`,
      images: [
        {
          url: ogImage,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function Blog({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let post = getBlogPosts().find((post) => post.slug === slug)

  if (!post) {
    notFound()
  }

  // TypeScript still thinks post might be undefined, so we use non-null assertion
  const safePost = post!

  return (
    <section className="px-3 sm:px-4">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: safePost.metadata.title,
            datePublished: safePost.metadata.publishedAt,
            dateModified: safePost.metadata.publishedAt,
            description: safePost.metadata.summary,
            image: safePost.metadata.image
              ? `${baseUrl}${safePost.metadata.image}`
              : `/og?title=${encodeURIComponent(safePost.metadata.title)}`,
            url: `${baseUrl}/blog/${safePost.slug}`,
            author: {
              '@type': 'Person',
              name: 'Yurie',
            },
          }),
        }}
      />
      <h1 className="title font-semibold text-2xl tracking-tighter">
        {safePost.metadata.title}
      </h1>
      <div className="flex justify-between items-center mt-2 mb-8 text-sm">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {formatDate(safePost.metadata.publishedAt)}
        </p>
      </div>
      <article className="prose prose-neutral dark:prose-invert">
        <div
          dangerouslySetInnerHTML={{ __html: marked.parse(safePost.content) as string }}
        />
      </article>
    </section>
  )
}
