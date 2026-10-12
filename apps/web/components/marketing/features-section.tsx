'use client'

import * as React from 'react'
import {
  Zap,
  Code2,
  GitBranch,
  Shield,
  BarChart3,
  Users,
  Award,
  Headphones,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { FadeInSection } from './fade-in-section'

// ---------------------------------------------------------------------------
// Features data
// ---------------------------------------------------------------------------

interface Feature {
  Icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    Icon: Zap,
    title: 'Agentic Development Loop',
    description:
      'Master the Claude Code agentic loop to handle entire features end-to-end with minimal back-and-forth.',
  },
  {
    Icon: Code2,
    title: 'Full-Stack AI Integration',
    description:
      'Build React frontends, Node.js APIs, and MongoDB schemas — all with Claude Code as your pair programmer.',
  },
  {
    Icon: GitBranch,
    title: 'Production Git Workflows',
    description:
      'Real branching strategies, PR reviews with AI, and CI/CD pipelines that deploy confidently.',
  },
  {
    Icon: Shield,
    title: 'Security & Best Practices',
    description:
      'Write secure, maintainable code that passes code review — not just code that works.',
  },
  {
    Icon: BarChart3,
    title: 'Monitoring & Observability',
    description:
      'Instrument your apps with logging, error tracking, and performance monitoring from day one.',
  },
  {
    Icon: Users,
    title: 'Cohort Community',
    description:
      'Build alongside peers in a structured cohort. Weekly calls, async support, and lifetime access to the community.',
  },
  {
    Icon: Award,
    title: 'Verified Certificate',
    description:
      'Earn a blockchain-verified certificate that proves your skills to employers and clients.',
  },
  {
    Icon: Headphones,
    title: 'Expert Support Calls',
    description:
      'Book 1-on-1 calls with expert builders whenever you get stuck. Real humans, real help.',
  },
]

// ---------------------------------------------------------------------------
// Feature Card
// ---------------------------------------------------------------------------

interface FeatureCardProps {
  feature: Feature
}

function FeatureCard({ feature }: FeatureCardProps) {
  const { Icon, title, description } = feature

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border border-black/5 bg-white p-6',
        'hover:shadow-lg hover:border-[#4a9ad4]/30 transition-all duration-200 group'
      )}
    >
      {/* Icon wrapper */}
      <div className="w-10 h-10 rounded-lg bg-[#4a9ad4]/10 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-[#4a9ad4] group-hover:text-[#ff8c5a] transition-colors" />
      </div>

      {/* Title */}
      <h3 className="font-semibold text-[#1a2744] mb-2">{title}</h3>

      {/* Description */}
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Features Section
// ---------------------------------------------------------------------------

interface FeaturesSectionProps {
  className?: string
}

function FeaturesSection({ className }: FeaturesSectionProps) {
  return (
    <section
      id="features"
      data-slot="features-section"
      className={cn('bg-white py-20', className)}
    >
      <div className="container mx-auto px-6 lg:px-8 max-w-7xl">
        {/* Section header */}
        <FadeInSection>
          <div className="text-center mb-16">
            <p className="text-[#ff8c5a] text-sm font-semibold uppercase tracking-widest mb-3">
              What You'll Master
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2744]">
              Everything You Need to Build with AI
            </h2>
            <p className="text-muted-foreground text-lg mt-3 max-w-2xl mx-auto">
              The Claude Code cohort covers every skill modern builders need to ship
              production-grade products.
            </p>
          </div>
        </FadeInSection>

        {/* Features grid */}
        <FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </FadeInSection>
      </div>
    </section>
  )
}

export { FeaturesSection }
