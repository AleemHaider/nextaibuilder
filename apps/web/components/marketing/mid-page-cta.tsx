'use client'

import * as React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FadeInSection } from './fade-in-section'
import { trackEvent } from '@/lib/analytics'

interface MidPageCtaProps {
  className?: string
}

function MidPageCta({ className }: MidPageCtaProps) {
  return (
    <section
      data-slot="mid-page-cta"
      className={cn('bg-[#ff8c5a] py-16', className)}
    >
      <div className="container mx-auto px-6 lg:px-8 max-w-4xl">
        <FadeInSection>
          <div className="flex flex-col items-center">
            {/* Heading */}
            <h2 className="text-[#1a2744] text-3xl md:text-4xl font-bold text-center">
              Ready to 10x Your Output?
            </h2>

            {/* Subline */}
            <p className="text-[#1a2744]/70 text-lg text-center mt-3 max-w-xl">
              Join the builders already shipping faster with Claude Code.
            </p>

            {/* CTA */}
            <div className="mt-8">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  size="lg"
                  className="bg-[#1a2744] text-white hover:bg-[#1a2744]/90 border-0 shadow-lg font-semibold"
                  asChild
                  onClick={() => trackEvent('cta_click', { label: 'enroll_now', section: 'mid_page' })}
                >
                  <a href="/signup">Enroll in the Next Cohort →</a>
                </Button>
              </motion.div>
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  )
}

export { MidPageCta }
