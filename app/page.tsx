import { BlogPosts, ResearchPosts } from 'app/components/posts'

export default function Page() {
  return (
    <section>
      <h1 className="mb-8 text-2xl font-semibold tracking-tighter px-3 sm:px-4">
        Welcome to Yurie
      </h1>
      <p className="mb-4 px-3 sm:px-4">
        {`a quiet corner for complex tech and finance. what happened, why it matters, what to watch—grounded in documents and data, with definitions, timelines, and next checks.`}
      </p>
      <div className="my-8">
        <h2 className="mb-4 text-lg font-medium px-3 sm:px-4">Read Latest Blog</h2>
        <BlogPosts limit={5} />
      </div>
      <div className="my-8">
        <h2 className="mb-4 text-lg font-medium px-3 sm:px-4">Explore Research Papers</h2>
        <ResearchPosts limit={5} />
      </div>
    </section>
  )
}
