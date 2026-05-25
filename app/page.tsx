import { PublicNav } from '@/components/landing/PublicNav'
import { HeroSection } from '@/components/landing/HeroSection'
import { HowItWorksSection } from '@/components/landing/HowItWorksSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { FounderSection } from '@/components/landing/FounderSection'
import { PricingSection } from '@/components/landing/PricingSection'
import { CTASection } from '@/components/landing/CTASection'
import { Footer } from '@/components/landing/Footer'

export default function LandingPage() {
  return (
    <main className="bg-[var(--bg-app)] min-h-screen">
      <PublicNav />
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <FounderSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  )
}
