import * as React from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { usePageMeta } from '@/hooks/use-page-meta'
import {
  MarketingNav,
  MarketingFooter,
  HeroSection,
  LogoStrip,
  StatsSection,
  HowItWorksSection,
  FeaturesSection,
  MidPageCta,
  TestimonialsSection,
  PricingSection,
  FaqSection,
  FinalCtaSection,
} from '@/app/components/marketing'

function LandingPage() {
  const { user, isLoading } = useAuth()

  usePageMeta({
    title: 'Product Builder Academy — Claude Code Cohort Training',
    description:
      'Learn to build real products faster with AI. Join our cohort-based Claude Code training program and ship your first AI-powered product in weeks.',
    ogTitle: 'Product Builder Academy — Claude Code Cohort Training',
    ogDescription:
      'Cohort-based training that teaches you to build real products with Claude Code. Join the next cohort.',
  })

  // While auth is initialising, render nothing — avoids flash before redirect
  if (isLoading) {
    return null
  }

  // Authenticated users go straight to the app
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="light min-h-screen bg-white">
      <MarketingNav />
      <main>
        <HeroSection />
        <LogoStrip />
        <StatsSection />
        <HowItWorksSection />
        <FeaturesSection />
        <MidPageCta />
        <TestimonialsSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <MarketingFooter />
    </div>
  )
}

export { LandingPage }
