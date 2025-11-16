import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yurie',
    short_name: 'Yurie',
    description:
      'Yurie is a free and open-source personal website template built with Next.js 15, React 19 and Motion-Primitives.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}


