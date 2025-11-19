type BlogPost = {
  title: string
  description: string
  link: string
  uid: string
}

export const BLOG_POSTS: BlogPost[] = [
  {
    title: 'Exploring the Intersection of Design, AI, and Design Engineering',
    description: 'How AI is changing the way we design',
    link: '/blog/exploring-the-intersection-of-design-ai-and-design-engineering',
    uid: 'blog-1',
  },
  {
    title: 'How to Export Metadata from MDX for Next.js SEO',
    description: 'A guide on exporting metadata from MDX files to leverage Next.js SEO features.',
    link: '/blog/example-mdx-metadata',
    uid: 'blog-4',
  },
  {
    title: 'Building Your First AI Agent',
    description:
      'A practical walkthrough for going from a blank repo to a working agent in this starter.',
    link: '/blog/building-your-first-ai-agent',
    uid: 'blog-2',
  },
  {
    title: 'Designing Better Agent Conversations',
    description:
      'Patterns for prompts, memory, and UX that make agents feel more helpful and coherent.',
    link: '/blog/designing-better-agent-conversations',
    uid: 'blog-3',
  },
  {
    title: 'Shipping Agent Features Safely',
    description:
      'A checklist for taking experimental agent behavior into production without breaking everything.',
    link: '/blog/shipping-agent-features-safely',
    uid: 'blog-5',
  },
]
