import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yurie',
    short_name: 'Yurie',
    description: 'Yurie',
    start_url: '/',
    display: 'standalone',
    background_color: '#212121',
    theme_color: '#212121',
    icons: [
      {
        src: '/favicon.ico?v=3',
        sizes: 'any',
        type: 'image/x-icon',
        purpose: 'any',
      },
    ],
  }
}