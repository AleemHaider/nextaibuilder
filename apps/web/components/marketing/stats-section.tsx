'use client'

import * as React from 'react'
import { useRef } from 'react'
import { useInView, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/use-count-up'
import { FadeInSection } from './fade-in-section'

// ---------------------------------------------------------------------------
// Stats data
// ---------------------------------------------------------------------------

interface Stat {
  value: number
  suffix: string
  label: string
  description: string
}

const stats: Stat[] = [
  {
    value: 10,
    suffix: 'x',
    label: 'Faster Delivery',
    description: 'Students ship features 10x faster than before joining the cohort',
  },
  {
    value: 47,
    suffix: '',
    label: 'Course Steps',
    description: 'Hands-on project steps covering every layer of modern AI-powered development',
  },
  {
    value: 5,
    suffix: 'hrs',
    label: 'Saved Per Week',
    description: 'Average time saved weekly by applying Claude Code to real work tasks',
  },
  {
    value: 94,
    suffix: '%',
    label: 'Completion Rate',
    description: 'Of students who start the cohort complete all steps and earn their certificate',
  },
]

// ---------------------------------------------------------------------------
// Single animated stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  stat: Stat
  inView: boolean
  index: number
}

function StatCard({ stat, inView, index }: StatCardProps) {
  const count = useCountUp({
    target: stat.value,
    duration: 1800,
    start: inView,
  })

  return (
    <FadeInSection delay={index * 0.1}>
      <div className="text-center p-6">
        {/* Animated number + suffix — pulse fires after the 1.8s count-up completes */}
        <motion.span
          className="flex items-end justify-center gap-0.5"
          animate={inView ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.4, delay: 1.6 }}
        >
          <span className="text-5xl md:text-6xl font-bold text-[#ff8c5a] leading-none tabular-nums">
            {count}
          </span>
          {stat.suffix && (
            <span className="text-5xl font-bold text-[#ff8c5a] leading-none mb-0.5">
              {stat.suffix}
            </span>
          )}
        </motion.span>

        {/* Label */}
        <p className="text-xl font-semibold text-[#1a2744] mt-2">{stat.label}</p>

        {/* Description */}
        <p className="text-muted-foreground text-sm mt-1 max-w-[200px] mx-auto leading-relaxed">
          {stat.description}
        </p>
      </div>
    </FadeInSection>
  )
}

// ---------------------------------------------------------------------------
// Stats Section
// ---------------------------------------------------------------------------

interface StatsSectionProps {
  className?: string
}

function StatsSection({ className }: StatsSectionProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const inView = useInView(gridRef, { once: true, amount: 0.5 })

  return (
    <section
      id="stats"
      data-slot="stats-section"
      className={cn('bg-white py-20', className)}
    >
      <div className="container mx-auto px-6 lg:px-8 max-w-7xl">
        {/* Section header */}
        <FadeInSection>
          <div className="text-center mb-16">
            <p className="text-[#ff8c5a] text-sm font-semibold uppercase tracking-widest mb-3">
              The Impact
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2744]">
              Real Results from Real Builders
            </h2>
            <p className="text-muted-foreground text-lg mt-3 max-w-2xl mx-auto">
              Students in the Claude Code cohort report dramatic improvements in speed, quality,
              and confidence.
            </p>
          </div>
        </FadeInSection>

        {/* Stats grid — 2-col on mobile/tablet, 4-col on lg+ */}
        <div
          ref={gridRef}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
        >
          {stats.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} inView={inView} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

export { StatsSection }
