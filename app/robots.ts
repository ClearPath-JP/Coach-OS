import type { MetadataRoute } from 'next'

/**
 * Crawl directives. Public marketing/legal pages are indexable; the entire
 * authed surface (coach/client/admin) + API are disallowed so they don't
 * waste crawl budget or land in the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/coach/', '/client/', '/admin/', '/api/', '/onboarding/', '/auth/'],
    },
    sitemap: 'https://korvacoach.com/sitemap.xml',
    host: 'https://korvacoach.com',
  }
}
