'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { FadeInSection } from './fade-in-section'
import { trackEvent } from '@/lib/analytics'

interface FaqItem {
  question: string
  answer: string
}

const faqs: FaqItem[] = [
  {
    question: 'Do I need to be a developer to join?',
    answer:
      'No prior coding experience is required. We have students ranging from complete beginners to senior engineers. The curriculum is structured so beginners build a solid foundation while experienced developers can move faster through early steps and focus on the advanced AI patterns.',
  },
  {
    question: 'How long does the cohort take to complete?',
    answer:
      'Most students complete the 47-step curriculum in 6–10 weeks, spending roughly 5–8 hours per week. The cohort is self-paced within the cohort window, so you can go faster or slower based on your schedule. You keep lifetime access to all materials.',
  },
  {
    question: 'What exactly is Claude Code?',
    answer:
      "Claude Code is Anthropic's official CLI tool that turns Claude into an agentic coding assistant. Unlike chat-based AI tools, Claude Code can read your entire codebase, run commands, write and edit files, and execute multi-step engineering tasks with minimal hand-holding — dramatically accelerating how fast you can ship.",
  },
  {
    question: 'What do I build during the cohort?',
    answer:
      "You build real, production-grade projects — not toy tutorials. By the end, you'll have shipped a full-stack web application with authentication, database, API, frontend, CI/CD pipeline, and monitoring. Everything is deployed to a real server, not just localhost.",
  },
  {
    question: 'What are the expert support calls?',
    answer:
      "Every enrolled student can book 1-on-1 calls with PBA expert builders directly from the student dashboard. These are 30-minute sessions where you share your screen, walk through your code, and get unblocked on whatever you're stuck on. There's no limit on how many calls you can book.",
  },
  {
    question: 'Is there a money-back guarantee?',
    answer:
      "Yes. If you complete the first 10 steps and feel the cohort isn't right for you, we'll refund 100% of your payment within 30 days of enrollment. No questions asked, no hoops to jump through.",
  },
  {
    question: 'What happens after I enroll?',
    answer:
      "Within 24 hours of enrollment you'll receive an invitation email with your login credentials. From there you can start Step 1 immediately. You'll also be added to the cohort community channel where you can introduce yourself and meet your peers.",
  },
  {
    question: 'Do I keep access after the cohort ends?',
    answer:
      'Yes — lifetime access. All course materials, your submission history, your certificate, and the community are yours forever. When we update the curriculum (which we do as Claude Code evolves), you get those updates at no additional cost.',
  },
]

interface FaqSectionProps {
  className?: string
}

function FaqSection({ className }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null)

  return (
    <section
      id="faq"
      data-slot="faq-section"
      className={cn('bg-[#f8fafc] py-20', className)}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <FadeInSection>
          <div className="text-center">
            <p className="text-[#ff8c5a] text-sm font-semibold uppercase tracking-widest mb-3">
              Questions
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2744] text-center">
              Everything You Need to Know
            </h2>
            <p className="text-muted-foreground text-lg text-center mt-3 max-w-2xl mx-auto">
              Still on the fence? These are the most common questions from prospective students.
            </p>
          </div>
        </FadeInSection>

        {/* FAQ accordion — mx-4 on mobile for horizontal padding, auto on md+ */}
        <FadeInSection delay={0.15}>
          <div className="max-w-3xl mx-4 md:mx-auto mt-12 bg-white rounded-2xl border border-black/5 shadow-sm divide-y divide-black/5 px-6">
            {faqs.map((faq, i) => {
              const isOpen = openIndex === i
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between py-5 text-left gap-4 group cursor-pointer"
                    aria-expanded={isOpen}
                    onClick={() => {
                      const nextOpen = isOpen ? null : i
                      setOpenIndex(nextOpen)
                      if (nextOpen !== null) {
                        trackEvent('faq_open', { question: faq.question.slice(0, 60) })
                      }
                    }}
                  >
                    <span
                      className={cn(
                        'font-semibold text-[#1a2744] text-base transition-colors',
                        'group-hover:text-[#4a9ad4]',
                      )}
                    >
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 text-muted-foreground transition-transform duration-300 flex-shrink-0',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <p className="text-muted-foreground text-sm leading-relaxed pb-5">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </FadeInSection>
      </div>
    </section>
  )
}

export { FaqSection }
