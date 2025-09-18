import { PostList } from 'app/components/posts'
import { getResearchPosts } from 'app/research/utils'

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
        <PostList basePath="/research" posts={posts} />
      </div>
    </section>
  )
}


