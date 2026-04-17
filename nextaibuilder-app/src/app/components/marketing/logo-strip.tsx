import * as React from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Tech pill data
// ---------------------------------------------------------------------------

const pills = [
  'Anthropic',
  'Claude Code',
  'GitHub',
  'VS Code',
  'React',
  'TypeScript',
  'Node.js',
]

// ---------------------------------------------------------------------------
// Pill component
// ---------------------------------------------------------------------------

interface TechPillProps {
  label: string
}

function TechPill({ label }: TechPillProps) {
  return (
    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium hover:border-[#4a9ad4] hover:text-[#4a9ad4] transition-colors cursor-default whitespace-nowrap mx-2">
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Logo Strip
// ---------------------------------------------------------------------------

interface LogoStripProps {
  className?: string
}

function LogoStrip({ className }: LogoStripProps) {
  return (
    <section
      id="social-proof"
      data-slot="logo-strip"
      className={cn('bg-white border-y border-black/5 py-6', className)}
    >
      {/* Desktop/tablet: static flex row (sm and above) */}
      <div className="hidden sm:flex items-center justify-center flex-wrap gap-2 px-6 max-w-5xl mx-auto">
        <span className="text-muted-foreground text-sm font-medium mr-4 whitespace-nowrap">
          Built with &amp; for:
        </span>
        {pills.map((label) => (
          <TechPill key={label} label={label} />
        ))}
      </div>

      {/* Mobile only: marquee scroll (below sm) */}
      <div className="flex sm:hidden overflow-hidden">
        <div className="w-full">
          <div className="flex items-center mb-3 justify-center">
            <span className="text-muted-foreground text-sm font-medium">
              Built with &amp; for:
            </span>
          </div>
          <div className="overflow-hidden relative">
            <div className="flex">
              {/* First set */}
              <div
                className="flex items-center flex-shrink-0"
                style={{ animation: 'logo-strip-marquee 20s linear infinite' }}
              >
                {pills.map((label) => (
                  <TechPill key={`a-${label}`} label={label} />
                ))}
              </div>
              {/* Duplicate for seamless loop */}
              <div
                className="flex items-center flex-shrink-0"
                style={{ animation: 'logo-strip-marquee 20s linear infinite' }}
              >
                {pills.map((label) => (
                  <TechPill key={`b-${label}`} label={label} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Marquee keyframes injected as a style tag */}
      <style>{`
        @keyframes logo-strip-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </section>
  )
}

export { LogoStrip }
