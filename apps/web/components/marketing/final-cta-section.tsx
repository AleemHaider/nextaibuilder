'use client'

import * as React from 'react'
import { Star, ShieldCheck, Lock, Users, Clock } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FadeInSection } from './fade-in-section'
import { trackEvent } from '@/lib/analytics'

interface FinalCtaSectionProps {
  className?: string
}

function FinalCtaSection({ className }: FinalCtaSectionProps) {
  return (
    <section
      data-slot="final-cta-section"
      className={cn('bg-[#1a2744] py-24 relative overflow-hidden', className)}
    >
      {/* Background decorations */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 w-96 h-96 rounded-full bg-[#4a9ad4]/10 blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-[#ff8c5a]/10 blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="max-w-3xl mx-auto text-center">
            {/* Star decorations */}
            <div className="flex justify-center gap-2 mb-8" aria-hidden="true">
              <Star className="w-5 h-5 text-[#ff8c5a]/40" />
              <Star className="w-5 h-5 text-[#ff8c5a]/40" />
              <Star className="w-5 h-5 text-[#ff8c5a]/40" />
            </div>

            {/* Heading */}
            <h2 className="text-white text-4xl md:text-5xl font-bold leading-tight mb-6">
              Your Next Cohort Starts Soon
            </h2>

            {/* Subline */}
            <p className="text-white/60 text-lg mb-4 max-w-xl mx-auto">
              Spots are limited. Students who enroll early get priority access to expert support calls.
            </p>

            {/* Urgency line */}
            <p className="text-[#ff8c5a] font-semibold mb-10 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 flex-shrink-0" />
              Next cohort opens: Cohort 4 — Apply now to reserve your spot
            </p>

            {/* CTA Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="inline-block"
            >
              <Button
                size="lg"
                className={cn(
                  'bg-[#ff8c5a] hover:bg-[#ff6347] text-white font-semibold text-lg px-10 py-4 h-auto rounded-xl shadow-lg shadow-[#ff8c5a]/25',
                )}
                asChild
                onClick={() => trackEvent('cta_click', { label: 'enroll_now', section: 'final_cta' })}
              >
                <a href="/signup">Enroll Now — Secure Your Spot →</a>
              </Button>
            </motion.div>

            {/* Trust indicators */}
            <div className="mt-6 flex items-center justify-center gap-6 text-white/40 text-sm flex-wrap">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                30-day guarantee
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                Secure payment
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Limited spots
              </span>
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  )
}

export { FinalCtaSection }
