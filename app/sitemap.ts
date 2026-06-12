import type { MetadataRoute } from 'next'

const BASE = 'https://korvacoach.com'

/**
 * Public, indexable routes only. The authed app (/coach, /client, /admin) and
 * transactional pages are intentionally omitted — they redirect to login and
 * carry no public content.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/browse`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/refunds`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
