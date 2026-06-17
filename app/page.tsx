import { PublicNav } from '@/components/landing/PublicNav'
import { HeroSection } from '@/components/landing/HeroSection'
import { HowItWorksSection } from '@/components/landing/HowItWorksSection'
import { ShowcaseSection } from '@/components/landing/ShowcaseSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { FounderSection } from '@/components/landing/FounderSection'
import { PricingSection } from '@/components/landing/PricingSection'
import { CTASection } from '@/components/landing/CTASection'
import { Footer } from '@/components/landing/Footer'

// Structured data so Google + answer engines understand what Korva is and what
// it costs. No review/rating schema (we have no real reviews yet — fabricating
// them is penalized).
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Korva',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'All-in-one coaching platform for solo martial-arts and fitness coaches — scheduling, classes, payments, belts, and video.',
  url: 'https://korvacoach.com',
  offers: [
    { '@type': 'Offer', name: 'Starter', price: '79', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro', price: '149', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Scale', price: '299', priceCurrency: 'USD' },
  ],
  publisher: {
    '@type': 'Organization',
    name: 'Korva',
    email: 'hello@foundos.ai',
    url: 'https://korvacoach.com',
  },
}

export default function LandingPage() {
  return (
    <>
      <PublicNav />
      <main id="main-content" className="bg-[var(--bg-app)] min-h-screen">
        <HeroSection />
        <HowItWorksSection />
        <ShowcaseSection />
        <FeaturesSection />
        <FounderSection />
        <PricingSection />
        <CTASection />
        <Footer />
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  )
}
