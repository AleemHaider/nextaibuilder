'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useScrollY } from '@/hooks/use-scroll-y'
import { useIsMobile } from '@/hooks/use-mobile'
import { trackEvent } from '@/lib/analytics'

interface NavLink {
  label: string
  href: string
}

const NAV_LINKS: NavLink[] = [
  { label: "What You'll Learn", href: '#features' },
  { label: 'How It Works',      href: '#how-it-works' },
  { label: 'Pricing',           href: '#pricing' },
  { label: 'FAQ',               href: '#faq' },
]

function scrollToSection(href: string) {
  const id = href.replace('#', '')
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

interface MarketingNavProps {
  className?: string
}

function MarketingNav({ className }: MarketingNavProps) {
  const scrollY = useScrollY()
  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const isScrolled = scrollY > 80

  return (
    <nav
      data-slot="marketing-nav"
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        isScrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm'
          : 'bg-transparent',
        className
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="flex-shrink-0"
          aria-label="Product Builder Academy — scroll to top"
        >
          <Logo
            variant="full"
            size="sm"
            onDark={!isScrolled}
          />
        </a>

        {/* Center: Desktop nav links */}
        {!isMobile && (
          <ul className="hidden md:flex items-center gap-1" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToSection(link.href)
                  }}
                  className={cn(
                    'relative px-3 py-1.5 text-sm font-medium transition-colors duration-200',
                    'after:absolute after:bottom-0 after:left-3 after:h-0.5 after:w-0 after:transition-all after:duration-300',
                    isScrolled
                      ? 'text-[#1a2744]/70 hover:text-[#1a2744] after:bg-[#1a2744] hover:after:w-[calc(100%-24px)]'
                      : 'text-white/70 hover:text-white after:bg-white hover:after:w-[calc(100%-24px)]'
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* Right: CTA button (desktop) + Hamburger (mobile) */}
        <div className="flex items-center gap-3">
          {!isMobile && (
            <Button
              size="sm"
              className={cn(
                'transition-all duration-300',
                isScrolled
                  ? 'bg-primary text-primary-foreground hover:bg-primary/85'
                  : 'border border-white bg-transparent text-white hover:bg-white/10'
              )}
              onClick={() => {
                trackEvent('cta_click', { label: 'enroll_now', section: 'nav' })
                scrollToSection('#pricing')
              }}
            >
              Enroll Now
            </Button>
          )}

          {/* Mobile: hamburger */}
          {isMobile && (
            <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <Dialog.Trigger asChild>
                <button
                  aria-label="Open navigation menu"
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                    isScrolled
                      ? 'text-foreground hover:bg-accent'
                      : 'text-white hover:bg-white/10'
                  )}
                >
                  <Menu className="h-5 w-5" />
                </button>
              </Dialog.Trigger>

              <Dialog.Portal>
                {/* Overlay */}
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                {/* Drawer panel — slides in from right */}
                <Dialog.Content
                  className="fixed right-0 top-0 z-50 h-full w-72 bg-white shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
                  aria-describedby={undefined}
                >
                  <div className="flex h-full flex-col">
                    {/* Drawer header */}
                    <div className="flex items-center justify-between border-b border-border px-4 py-4">
                      <Logo variant="full" size="sm" />
                      <Dialog.Close asChild>
                        <button
                          aria-label="Close navigation menu"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </Dialog.Close>
                    </div>

                    {/* Nav links */}
                    <nav className="flex flex-col gap-1 px-3 pt-4" aria-label="Mobile navigation">
                      {NAV_LINKS.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          onClick={(e) => {
                            e.preventDefault()
                            setMobileMenuOpen(false)
                            // Small delay to let the drawer close before scrolling
                            setTimeout(() => scrollToSection(link.href), 300)
                          }}
                          className="flex items-center rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          {link.label}
                        </a>
                      ))}
                    </nav>

                    {/* CTA at the bottom of drawer */}
                    <div className="mt-auto border-t border-border px-4 py-4">
                      <Button
                        className="w-full"
                        onClick={() => {
                          trackEvent('cta_click', { label: 'enroll_now', section: 'nav' })
                          setMobileMenuOpen(false)
                          setTimeout(() => scrollToSection('#pricing'), 300)
                        }}
                      >
                        Enroll Now
                      </Button>
                    </div>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>
      </div>
    </nav>
  )
}

export { MarketingNav }
