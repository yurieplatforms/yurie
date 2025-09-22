import { PostList } from '@/components/posts'
import { getResearchPosts } from 'app/research/utils'

export const metadata = {
  title: 'Research',
  description: 'In-depth explorations and technical investigations.',
}

export default function Page() {
  const posts = getResearchPosts()

  return (
    <section>
      <h1 className="mb-8 px-3 text-2xl font-semibold tracking-tighter sm:px-4">
        Research
      </h1>
      <div className="my-8">
        <PostList basePath="/research" posts={posts} />
      </div>
    </section>
  )
}
