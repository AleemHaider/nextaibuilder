import * as React from 'react'
import {
  Terminal,
  Code2,
  Brain,
  Rocket,
  Award,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeInSection } from './fade-in-section'

// ---------------------------------------------------------------------------
// Steps data
// ---------------------------------------------------------------------------

interface Step {
  number: string
  title: string
  description: string
  Icon: LucideIcon
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Environment Setup & Fundamentals',
    description:
      'Configure Claude Code, set up your development environment, and understand the agentic loop that makes AI pair programming possible.',
    Icon: Terminal,
  },
  {
    number: '02',
    title: 'Build Your First AI-Powered Feature',
    description:
      'Use Claude Code to scaffold, implement, and test a real full-stack feature from scratch — frontend to database.',
    Icon: Code2,
  },
  {
    number: '03',
    title: 'Advanced Prompting & Agent Patterns',
    description:
      'Master multi-turn conversations, context management, and the agent patterns that 10x your output on complex features.',
    Icon: Brain,
  },
  {
    number: '04',
    title: 'Ship to Production',
    description:
      'Deploy your project with CI/CD, monitoring, and the production-grade practices that separate hobbyists from professionals.',
    Icon: Rocket,
  },
  {
    number: '05',
    title: 'Build Your Portfolio & Get Certified',
    description:
      'Complete your capstone project, earn your PBA certificate, and walk away with real proof of your skills.',
    Icon: Award,
  },
]

// ---------------------------------------------------------------------------
// Step content block — reused for both desktop and mobile layouts
// ---------------------------------------------------------------------------

interface StepContentProps {
  step: Step
  align?: 'left' | 'right'
}

function StepContent({ step, align = 'left' }: StepContentProps) {
  const { Icon, number, title, description } = step
  return (
    <div className={cn('flex flex-col', align === 'right' ? 'items-start text-left' : 'items-end text-right')}>
      <div className="flex items-center gap-2 mb-1" style={{ flexDirection: align === 'right' ? 'row' : 'row-reverse' }}>
        <Icon className="w-5 h-5 text-[#4a9ad4]" />
        <span className="text-[#ff8c5a] text-sm font-bold">Step {number}</span>
      </div>
      <h3 className="text-[#1a2744] font-bold text-lg mb-2 max-w-xs">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{description}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// How It Works Section
// ---------------------------------------------------------------------------

interface HowItWorksSectionProps {
  className?: string
}

function HowItWorksSection({ className }: HowItWorksSectionProps) {
  return (
    <section
      id="how-it-works"
      data-slot="how-it-works-section"
      className={cn('bg-[#f8fafc] py-20', className)}
    >
      <div className="container mx-auto px-6 lg:px-8 max-w-5xl">
        {/* Section header */}
        <FadeInSection>
          <div className="text-center mb-16">
            <p className="text-[#ff8c5a] text-sm font-semibold uppercase tracking-widest mb-3">
              The Journey
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2744]">
              From Zero to AI-Powered Builder
            </h2>
            <p className="text-muted-foreground text-lg mt-3 max-w-2xl mx-auto">
              A structured, hands-on curriculum that takes you from setup to shipping real
              products.
            </p>
          </div>
        </FadeInSection>

        {/* ----------------------------------------------------------------
            Desktop zigzag timeline
            ---------------------------------------------------------------- */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Vertical center line */}
            <div
              className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5"
              style={{
                background: 'linear-gradient(to bottom, #4a9ad4, #ff8c5a)',
              }}
              aria-hidden="true"
            />

            {steps.map((step, index) => {
              const isOdd = index % 2 === 0 // 0-indexed, so step 01 is index 0 (odd position)
              return (
                <FadeInSection key={step.number} delay={index * 0.1}>
                  <div className="grid grid-cols-2 gap-8 relative mb-12 last:mb-0">
                    {isOdd ? (
                      <>
                        {/* Content left, right-aligned */}
                        <div className="flex justify-end items-center pr-10">
                          <StepContent step={step} align="right" />
                        </div>

                        {/* Badge centered on the line */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10">
                          <div className="w-12 h-12 rounded-full bg-[#ff8c5a] text-white font-bold flex items-center justify-center text-sm shadow-lg border-4 border-[#f8fafc]">
                            {step.number}
                          </div>
                        </div>

                        {/* Empty right col */}
                        <div />
                      </>
                    ) : (
                      <>
                        {/* Empty left col */}
                        <div />

                        {/* Badge centered on the line */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10">
                          <div className="w-12 h-12 rounded-full bg-[#4a9ad4] text-white font-bold flex items-center justify-center text-sm shadow-lg border-4 border-[#f8fafc]">
                            {step.number}
                          </div>
                        </div>

                        {/* Content right, left-aligned */}
                        <div className="flex justify-start items-center pl-10">
                          <StepContent step={step} align="left" />
                        </div>
                      </>
                    )}
                  </div>
                </FadeInSection>
              )
            })}
          </div>
        </div>

        {/* ----------------------------------------------------------------
            Mobile single-column timeline
            ---------------------------------------------------------------- */}
        <div className="md:hidden">
          <div className="ml-4 border-l-2 border-[#4a9ad4] pl-6 flex flex-col gap-10">
            {steps.map((step, index) => (
              <FadeInSection key={step.number} delay={index * 0.08}>
                <div className="relative">
                  {/* Badge on the left border */}
                  <div className="absolute -left-[3.15rem] top-0 w-10 h-10 rounded-full bg-[#ff8c5a] text-white font-bold flex items-center justify-center text-xs shadow-md border-4 border-[#f8fafc]">
                    {step.number}
                  </div>

                  <div className="flex flex-col items-start text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <step.Icon className="w-5 h-5 text-[#4a9ad4]" />
                      <span className="text-[#ff8c5a] text-sm font-bold">
                        Step {step.number}
                      </span>
                    </div>
                    <h3 className="text-[#1a2744] font-bold text-lg mb-2">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export { HowItWorksSection }
