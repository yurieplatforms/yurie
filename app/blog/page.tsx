import { PostList } from '@/components/posts'
import { getBlogPosts } from 'app/blog/utils'

export const metadata = {
  title: 'Blog',
  description: 'Read my blog.',
}

export default function Page() {
  const posts = getBlogPosts()
  return (
    <section>
      <h1 className="mb-8 px-3 text-2xl font-semibold tracking-tighter sm:px-4">
        Blog
      </h1>
      <PostList basePath="/blog" posts={posts} />
    </section>
  )
}
