import type { MetadataRoute } from 'next'

/**
 * PWA manifest — enables a clean "Add to Home Screen" card on mobile.
 * theme/background use the Dojo Arcade cream so the install splash matches the UI.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Korva — Coaching platform',
    short_name: 'Korva',
    description:
      'The all-in-one platform for solo martial-arts and fitness coaches — scheduling, classes, payments, and video.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f0',
    theme_color: '#faf7f0',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
