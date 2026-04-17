import * as React from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { fadeUpVariant } from './animations'

interface FadeInSectionProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

/**
 * Wraps children in a Framer Motion div that fades up when scrolled into view.
 * Respects prefers-reduced-motion — renders without animation when true.
 * Uses viewport once: true so animation only triggers on first entry.
 */
function FadeInSection({ children, delay = 0, className }: FadeInSectionProps) {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return (
      <div data-slot="fade-in-section" className={className}>
        {children}
      </div>
    )
  }

  const variantWithDelay = {
    hidden: fadeUpVariant.hidden,
    visible: {
      ...(typeof fadeUpVariant.visible === 'object' ? fadeUpVariant.visible : {}),
      transition: {
        duration: 0.5,
        ease: 'easeOut' as const,
        delay,
      },
    },
  }

  return (
    <motion.div
      data-slot="fade-in-section"
      className={cn(className)}
      style={{ willChange: 'transform' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={variantWithDelay}
    >
      {children}
    </motion.div>
  )
}

export { FadeInSection }
