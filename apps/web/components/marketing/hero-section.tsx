'use client'

import * as React from 'react'
import { Lock, ChevronDown, CheckCircle2, Circle } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FadeInSection } from './fade-in-section'
import { trackEvent } from '@/lib/analytics'

// ---------------------------------------------------------------------------
// Dashboard Mockup — decorative student progress preview
// ---------------------------------------------------------------------------

interface StepCardProps {
  number: number
  title: string
  completed: boolean
  inProgress?: boolean
}

function StepCard({ number, title, completed, inProgress = false }: StepCardProps) {
  return (
    <div className="rounded-lg p-4 flex items-center gap-3 bg-[#1a2744]">
      {/* Number badge */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
          inProgress
            ? 'bg-[#ff8c5a]/20 text-[#ff8c5a]'
            : 'bg-[#4a9ad4] text-white'
        )}
      >
        {number}
      </div>

      {/* Title */}
      <span className="flex-1 text-white text-sm font-medium leading-tight">
        {title}
      </span>

      {/* Status indicator */}
      {completed ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      ) : inProgress ? (
        <span className="text-[#ff8c5a] text-xs font-semibold whitespace-nowrap flex-shrink-0">
          In Progress
        </span>
      ) : (
        <Circle className="w-4 h-4 text-white/30 flex-shrink-0" />
      )}
    </div>
  )
}

function DashboardMockup() {
  return (
    <div
      className="pointer-events-none select-none transform rotate-1 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0f1829]"
      aria-hidden="true"
    >
      {/* Mac-style window top bar */}
      <div className="bg-[#1a2744] px-4 py-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <span className="ml-3 text-white/40 text-xs">student dashboard</span>
      </div>

      {/* Content area */}
      <div className="bg-[#0d1526] p-6">
        {/* Step cards */}
        <div className="flex flex-col gap-3">
          <StepCard
            number={1}
            title="Setup Claude Code Environment"
            completed={true}
          />
          <StepCard
            number={2}
            title="Build Your First AI Feature"
            completed={true}
          />
          <StepCard
            number={3}
            title="Deploy to Production"
            completed={false}
            inProgress={true}
          />
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <p className="text-white/60 text-xs mb-2">Course Progress</p>
          <div className="bg-white/10 rounded-full h-2">
            <div className="bg-gradient-to-r from-[#4a9ad4] to-[#ff8c5a] rounded-full h-2 w-2/3" />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-white/40 text-xs">32 of 47 steps</span>
            <span className="text-[#ff8c5a] text-xs font-semibold">68%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------

interface HeroSectionProps {
  className?: string
}

function HeroSection({ className }: HeroSectionProps) {
  return (
    <section
      id="hero"
      data-slot="hero-section"
      className={cn('relative min-h-screen flex items-center py-20 overflow-hidden', className)}
      style={{
        background: 'radial-gradient(ellipse at 80% 10%, #4a9ad4 0%, #1a2744 60%)',
        backgroundColor: '#1a2744',
      }}
    >
      {/* Content container */}
      <div className="container mx-auto px-6 lg:px-8 max-w-7xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left column — copy */}
          <FadeInSection delay={0}>
            <div className="flex flex-col">
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-[#ff8c5a] flex-shrink-0" />
                <span className="text-[#ff8c5a] text-sm font-semibold uppercase tracking-widest">
                  Claude Code Cohort Training
                </span>
              </div>

              {/* H1 — fluid sizing for mobile through desktop */}
              <h1 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight">
                Build Production Products{' '}
                <span className="text-[#ff8c5a]">10x Faster</span>{' '}
                with Claude Code
              </h1>

              {/* Subheadline */}
              <p className="text-white/70 text-lg md:text-xl mt-4 max-w-xl leading-relaxed">
                Join expert builders who are shipping full-stack features in hours, not weeks
                — powered by Claude Code's agentic loop.
              </p>

              {/* CTA buttons — stack on mobile, row on sm+ */}
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    size="lg"
                    className="bg-[#ff8c5a] hover:bg-[#ff6347] text-[#1a2744] font-semibold border-0 shadow-lg"
                    asChild
                    onClick={() => trackEvent('cta_click', { label: 'enroll_now', section: 'hero' })}
                  >
                    <a href="/signup">Enroll Now →</a>
                  </Button>
                </motion.div>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white/10 hover:text-white bg-transparent"
                  asChild
                >
                  <a href="#how-it-works">See How It Works</a>
                </Button>
              </div>

              {/* Trust line */}
              <div className="mt-6 flex items-center gap-2 text-white/50 text-sm">
                <Lock size={14} className="flex-shrink-0" />
                <span>No risk. 30-day money-back guarantee.</span>
              </div>
            </div>
          </FadeInSection>

          {/* Right column — dashboard mockup */}
          <FadeInSection delay={0.2}>
            <div className="w-full max-w-md mx-auto lg:max-w-none mt-8 lg:mt-0">
              <DashboardMockup />
            </div>
          </FadeInSection>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40 text-xs">
        <span>Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={18} />
        </motion.div>
      </div>
    </section>
  )
}

export { HeroSection }
