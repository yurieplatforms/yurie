import { getBlogPosts } from 'app/blog/utils'
import { getResearchPosts } from 'app/research/utils'

export const baseUrl = 'https://yurie.ai'

export default async function sitemap() {
  const blogs = getBlogPosts().map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.metadata.publishedAt,
  }))

  const research = getResearchPosts().map((post) => ({
    url: `${baseUrl}/research/${post.slug}`,
    lastModified: post.metadata.publishedAt,
  }))

  const routes = ['/', '/blog', '/research'].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
  }))

  return [...routes, ...blogs, ...research]
}
