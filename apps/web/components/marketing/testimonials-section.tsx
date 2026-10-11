'use client'

import * as React from 'react'
import { Star, ShieldCheck, Users, TrendingUp } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { FadeInSection } from './fade-in-section'

interface Testimonial {
  name: string
  role: string
  company: string
  initials: string
  avatarColor: string
  quote: string
  stars: number
  highlight: string
}

const testimonials: Testimonial[] = [
  {
    name: 'Sarah Chen',
    role: 'Senior Product Manager',
    company: 'TechCorp',
    initials: 'SC',
    avatarColor: '#4a9ad4',
    quote:
      'I went from spending 3 days on a feature to shipping it in an afternoon. Claude Code changed how I think about building products. The cohort structure kept me accountable and the step-by-step approach made complex concepts click.',
    stars: 5,
    highlight: 'Shipped features 5x faster',
  },
  {
    name: 'Marcus Rivera',
    role: 'Founder',
    company: 'BuildFast.io',
    initials: 'MR',
    avatarColor: '#ff8c5a',
    quote:
      'As a non-technical founder, I was skeptical. But by week 2 I was writing and deploying real code. The expert support calls are worth the price alone — I unblocked myself in 20 minutes on problems that had stopped me for days.',
    stars: 5,
    highlight: 'Non-technical → shipped MVP in 3 weeks',
  },
  {
    name: 'Priya Patel',
    role: 'Full-Stack Developer',
    company: 'Freelance',
    initials: 'PP',
    avatarColor: '#1a2744',
    quote:
      'The production deployment section alone saved me from 3 embarrassing mistakes I would have made in client projects. This cohort teaches you to build like a professional, not just someone who can write code that works.',
    stars: 5,
    highlight: 'Doubled freelance project capacity',
  },
]

interface TestimonialsSectionProps {
  className?: string
}

function TestimonialsSection({ className }: TestimonialsSectionProps) {
  return (
    <section
      id="testimonials"
      data-slot="testimonials-section"
      className={cn('bg-[#f0f7ff] py-20', className)}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <FadeInSection>
          <div className="text-center">
            <p className="text-[#ff8c5a] text-sm font-semibold uppercase tracking-widest mb-3">
              Student Results
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2744] text-center">
              Builders Who Leveled Up
            </h2>
            <p className="text-muted-foreground text-lg text-center mt-3 max-w-2xl mx-auto">
              Real feedback from students who completed the Claude Code cohort.
            </p>
          </div>
        </FadeInSection>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          {testimonials.map((testimonial, index) => (
            <FadeInSection key={testimonial.name} delay={index * 0.15}>
              <motion.div
                whileHover={{ y: -4, boxShadow: '0 20px 40px -8px rgba(0,0,0,0.1)' }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'rounded-2xl bg-white p-6 shadow-sm border border-black/5 border-l-4 border-l-[#ff8c5a] flex flex-col h-full',
                )}
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: testimonial.stars }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4"
                      fill="#ff8c5a"
                      stroke="#ff8c5a"
                    />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="text-[#1a2744]/80 text-sm leading-relaxed flex-1 mb-4">
                  {testimonial.quote}
                </blockquote>

                {/* Highlight badge */}
                <div className="inline-flex items-center gap-1.5 bg-[#4a9ad4]/10 text-[#4a9ad4] text-xs font-semibold px-3 py-1 rounded-full mb-4 self-start">
                  <TrendingUp className="w-3 h-3" />
                  {testimonial.highlight}
                </div>

                {/* Author row */}
                <div className="flex items-center gap-3 mt-auto pt-4 border-t border-black/5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: testimonial.avatarColor }}
                  >
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-[#1a2744] text-sm">{testimonial.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {testimonial.role} · {testimonial.company}
                    </p>
                  </div>
                </div>
              </motion.div>
            </FadeInSection>
          ))}
        </div>

        {/* Trust bar */}
        <FadeInSection delay={0.4}>
          <div className="mt-12 flex flex-col items-center gap-3">
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <span className="text-[#1a2744]/60 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                30-Day Money-Back Guarantee
              </span>
              <span className="text-[#1a2744]/60 text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                47+ Active Students
              </span>
              <span className="text-[#1a2744]/60 text-sm flex items-center gap-2">
                <Star className="w-4 h-4" />
                4.9/5 Average Rating
              </span>
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  )
}

export { TestimonialsSection }
