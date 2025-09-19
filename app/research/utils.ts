import path from 'path'
import { getMDXData, formatDate } from 'app/lib/posts'

export function getResearchPosts() {
  return getMDXData(path.join(process.cwd(), 'app', 'research', 'posts'))
}

export { formatDate }
