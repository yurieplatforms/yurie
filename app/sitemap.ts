export const baseUrl = 'https://yurie.ai'

export default async function sitemap() {
  let routes = ['', '/playground'].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
  }))

  return routes
}
