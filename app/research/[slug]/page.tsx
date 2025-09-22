import { notFound } from 'next/navigation'
import { marked } from 'marked'
import { formatDate, getResearchPosts } from 'app/research/utils'
import AskAISummary from '@/components/AskAI'
import { baseUrl } from 'app/sitemap'

export async function generateStaticParams() {
  const posts = getResearchPosts()

  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getResearchPosts().find((post) => post.slug === slug)
  if (!post) {
    return
  }

  const safePost = post!

  const {
    title,
    publishedAt: publishedTime,
    summary: description,
    image,
  } = safePost.metadata
  const ogImage = image
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
      url: `${baseUrl}/research/${safePost.slug}`,
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

export default async function Research({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getResearchPosts().find((post) => post.slug === slug)

  if (!post) {
    notFound()
  }

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
            url: `${baseUrl}/research/${safePost.slug}`,
            author: {
              '@type': 'Person',
              name: 'Yurie',
            },
          }),
        }}
      />
      <h1 className="title text-2xl font-semibold tracking-tighter">
        {safePost.metadata.title}
      </h1>
      <div className="mt-2 mb-8 flex items-center justify-between text-sm">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {formatDate(safePost.metadata.publishedAt)}
        </p>
        <AskAISummary
          title={safePost.metadata.title}
          content={safePost.content}
          inline
          portalTargetId="ai-summary-slot"
        />
      </div>
      <article className="prose prose-neutral dark:prose-invert">
        <div id="ai-summary-slot" />
        <div
          dangerouslySetInnerHTML={{
            __html: marked.parse(safePost.content) as string,
          }}
        />
      </article>
    </section>
  )
}
