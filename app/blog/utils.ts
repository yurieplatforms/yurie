import path from 'path'
import { getMDXData, formatDate } from '@/lib/posts'

export function getBlogPosts() {
  return getMDXData(path.join(process.cwd(), 'app', 'blog', 'posts'))
}

export { formatDate }
