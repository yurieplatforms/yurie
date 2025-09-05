import { BlogPosts } from 'app/components/posts'

export default function Page() {
  return (
    <section>
      <h1 className="mb-8 text-2xl font-semibold tracking-tighter pl-4 pr-4">
        Welcome to Yurie
      </h1>
      <p className="mb-4 pl-4 pr-4">
        {`a quiet corner of the internet for clear, thoughtful reporting on complex tech and science. We cut through noise and hype to explain what matters, with context you can trust and zero doomscroll. Settle in, follow your curiosity, and leave with clarity, not anxiety.`}
      </p>
      <div className="my-8">
        <BlogPosts />
      </div>
    </section>
  )
}
