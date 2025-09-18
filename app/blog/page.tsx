import { PostList } from 'app/components/posts'
import { getBlogPosts } from 'app/blog/utils'

export const metadata = {
  title: 'Blog',
  description: 'Read my blog.',
}

export default function Page() {
  let posts = getBlogPosts()
  return (
    <section>
      <h1 className="font-semibold text-2xl mb-8 tracking-tighter px-3 sm:px-4">Blog</h1>
      <PostList basePath="/blog" posts={posts} />
    </section>
  )
}
