import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yurie',
    short_name: 'Yurie',
    description:
      'Yurie is a personal website template focused on intuitive, performant web experiences.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#fafafa',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '16x16 32x32 48x48',
        type: 'image/x-icon',
      },
    ],
  }
}


