import type { Variants } from 'motion/react'

/**
 * Shared Framer Motion variants for the marketing landing page.
 * Import these into any marketing section component for consistent animation.
 */

/** Slides up from below while fading in — use on individual elements */
export const fadeUpVariant: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
}

/** Container that staggers its children animations */
export const staggerContainerVariant: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
}

/** Simple opacity fade — use for overlays or background elements */
export const fadeInVariant: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
}
