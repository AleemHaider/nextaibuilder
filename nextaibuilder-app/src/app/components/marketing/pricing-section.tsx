import * as React from 'react'
import { CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { FadeInSection } from './fade-in-section'
import { trackEvent } from '@/lib/analytics'

const features: string[] = [
  '47 hands-on project steps',
  'Full-stack curriculum (React, Node.js, MongoDB)',
  'Claude Code mastery from setup to advanced patterns',
  'Expert 1-on-1 support calls (book anytime)',
  'Lifetime cohort community access',
  'Verified completion certificate',
  'Production deployment training',
  '30-day money-back guarantee',
]

interface PricingSectionProps {
  className?: string
}

function PricingSection({ className }: PricingSectionProps) {
  return (
    <section
      id="pricing"
      data-slot="pricing-section"
      className={cn('bg-white py-20', className)}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <FadeInSection>
          <div className="text-center">
            <p className="text-[#ff8c5a] text-sm font-semibold uppercase tracking-widest mb-3">
              Investment
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2744] text-center">
              One Cohort. Lifetime of Skills.
            </h2>
            <p className="text-muted-foreground text-lg text-center mt-3 max-w-2xl mx-auto">
              Everything you need to become an AI-powered builder.
            </p>
          </div>
        </FadeInSection>

        {/* Pricing card */}
        <FadeInSection delay={0.15}>
          {/* mx-4 on mobile for horizontal padding, auto on md+ */}
          <div className="max-w-lg mx-4 md:mx-auto mt-12">
            <motion.div
              whileHover={{ y: -4, boxShadow: '0 25px 50px -12px rgba(74, 154, 212, 0.25)' }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border-2 border-[#4a9ad4] bg-white shadow-xl p-8 relative"
            >
              {/* Most Popular ribbon */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#ff8c5a] text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                Most Popular
              </div>

              {/* Program name */}
              <p className="text-[#1a2744] text-lg font-semibold text-center mb-2">
                Claude Code Cohort
              </p>

              {/* Price */}
              <div className="text-center my-6">
                <span className="text-6xl font-bold text-[#1a2744]">$997</span>
                <span className="text-muted-foreground text-lg ml-2">one-time</span>
              </div>

              {/* Payment plan */}
              <p className="text-center text-sm text-muted-foreground mb-6">
                or 3 × $365
              </p>

              {/* Feature checklist */}
              <ul className="space-y-3 mb-8">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#4a9ad4] flex-shrink-0 mt-0.5" />
                    <span className="text-[#1a2744]/80 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Scarcity indicator */}
              <div className="flex items-center gap-2 justify-center mb-6 bg-[#ff8c5a]/10 rounded-lg py-3 px-4">
                <AlertCircle className="w-4 h-4 text-[#ff8c5a] flex-shrink-0" />
                <span className="text-[#ff8c5a] text-sm font-semibold">
                  Only 8 spots remaining in the current cohort
                </span>
              </div>

              {/* CTA */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  size="lg"
                  className={cn(
                    'w-full bg-[#ff8c5a] hover:bg-[#ff6347] text-white font-semibold text-base',
                  )}
                  onClick={() => trackEvent('cta_click', { label: 'enroll_now', section: 'pricing' })}
                >
                  Enroll Now — Secure Your Spot →
                </Button>
              </motion.div>

              {/* Guarantee note */}
              <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                30-day money-back guarantee. No questions asked.
              </p>
            </motion.div>
          </div>
        </FadeInSection>
      </div>
    </section>
  )
}

export { PricingSection }
