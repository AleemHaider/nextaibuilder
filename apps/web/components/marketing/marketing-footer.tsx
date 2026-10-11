'use client'

import * as React from 'react'
import { Linkedin, Twitter } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

interface FooterLinkGroup {
  heading: string
  links: Array<{ label: string; href: string }>
}

const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    heading: 'Program',
    links: [
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Features',     href: '#features' },
      { label: 'Pricing',      href: '#pricing' },
      { label: 'FAQ',          href: '#faq' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Privacy Policy',    href: '#' },
      { label: 'Terms of Service',  href: '#' },
    ],
  },
]

function scrollToSection(href: string) {
  if (href === '#') return
  const id = href.replace('#', '')
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

interface MarketingFooterProps {
  className?: string
}

function MarketingFooter({ className }: MarketingFooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer
      data-slot="marketing-footer"
      className={cn('bg-[#1a2744] text-white', className)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main footer grid */}
        <div className="flex flex-col gap-10 py-12 md:flex-row md:items-start md:justify-between">
          {/* Left: logo + tagline */}
          <div className="flex flex-col gap-3">
            {/* Logo rendered on dark background */}
            <Logo variant="full" size="sm" onDark />
            <p className="text-sm text-white/60 max-w-[220px] leading-relaxed">
              Build products faster with AI
            </p>
          </div>

          {/* Right: link columns */}
          <div className="flex flex-wrap gap-10 sm:gap-16">
            {FOOTER_LINK_GROUPS.map((group) => (
              <div key={group.heading} className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                  {group.heading}
                </h3>
                <ul className="flex flex-col gap-2" role="list">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        onClick={(e) => {
                          if (link.href.startsWith('#') && link.href !== '#') {
                            e.preventDefault()
                            scrollToSection(link.href)
                          }
                        }}
                        className="text-sm text-white/70 hover:text-white transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col-reverse gap-3 border-t border-white/10 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/40">
            &copy; {year} Product Builder Academy. All rights reserved.
          </p>

          {/* Social icons */}
          <div className="flex items-center gap-4">
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Product Builder Academy on LinkedIn"
              className="text-white/60 hover:text-white transition-colors duration-200"
            >
              <Linkedin className="h-4 w-4" />
            </a>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Product Builder Academy on Twitter / X"
              className="text-white/60 hover:text-white transition-colors duration-200"
            >
              <Twitter className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export { MarketingFooter }
