import { PublicNav } from '@/components/landing/PublicNav'
import { Footer } from '@/components/landing/Footer'
import { BrowseCoachesContent } from './BrowseCoachesContent'

export const metadata = {
  title: 'Browse coaches',
  description: 'Find martial arts, fitness, and nutrition coaches. Join their dojo and start training.',
}

export default function BrowseCoachesPage() {
  return (
    <main className="bg-[var(--bg-app)] min-h-screen">
      <PublicNav />
      <div className="pt-16">
        <BrowseCoachesContent />
      </div>
      <Footer />
    </main>
  )
}
