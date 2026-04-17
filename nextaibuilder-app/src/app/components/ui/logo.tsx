import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const logoVariants = cva('flex items-center gap-2.5', {
  variants: {
    size: {
      sm: '',
      md: '',
      lg: '',
      xl: '',
    },
  },
  defaultVariants: { size: 'md' },
})

const iconSizes = { sm: 32, md: 48, lg: 64, xl: 96 } as const

// Explicit readable text sizes per icon size (not computed from tiny px values)
const wordmarkSizes = {
  sm: { primary: 14, secondary: 9 },
  md: { primary: 18, secondary: 11 },
  lg: { primary: 24, secondary: 15 },
  xl: { primary: 36, secondary: 22 },
} as const

interface LogoMarkProps {
  size?: number
  onDark?: boolean
}

function LogoMark({ size = 48 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path opacity="0.9" d="M9.60001 41.6C9.60001 41.6 16 35.2 25.6 37.12C35.2 39.04 41.6 44.8 48 41.6C51.2 39.68 52.48 37.12 52.48 35.2V48C52.48 48 51.2 50.56 48 52.48C41.6 55.68 35.2 49.92 25.6 48C16 46.08 9.60001 52.48 9.60001 52.48V41.6Z" fill="url(#lg0)"/>
      <path opacity="0.95" d="M12.8 28.8C12.8 28.8 19.2 22.4 28.8 25.6C38.4 28.8 44.8 33.28 51.2 30.72C54.4 29.44 56.32 26.88 56.32 24.32V37.12C56.32 37.12 54.4 39.68 51.2 41.6C44.8 44.8 38.4 39.68 28.8 36.48C19.2 33.28 12.8 38.4 12.8 38.4V28.8Z" fill="url(#lg1)"/>
      <path d="M16 17.92C16 17.92 22.4 11.52 32 14.08C41.6 16.64 48 22.4 54.4 19.2C56.32 17.92 57.6 16 57.6 14.08V26.88C57.6 26.88 56.32 29.44 54.4 30.72C48 33.92 41.6 28.8 32 25.6C22.4 22.4 16 28.16 16 28.16V17.92Z" fill="url(#lg2)"/>
      <path d="M44.8 7.68C44.8 7.68 49.92 5.12 54.4 7.68C56.32 8.96 57.6 11.52 57.6 14.08V19.2C57.6 19.2 56.32 16.64 54.4 15.36C49.92 12.8 44.8 15.36 44.8 15.36V7.68Z" fill="url(#lg3)"/>
      <ellipse opacity="0.8" cx="52.48" cy="11.52" rx="2.56" ry="3.2" fill="url(#lg4)"/>
      <defs>
        <linearGradient id="lg0" x1="9.6" y1="35.2" x2="52.48" y2="52.48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A2744"/>
          <stop offset="1" stopColor="#4A90C4"/>
        </linearGradient>
        <linearGradient id="lg1" x1="56.32" y1="24.32" x2="12.8" y2="38.4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7BB8E0"/>
          <stop offset="1" stopColor="#4A9AD4"/>
        </linearGradient>
        <linearGradient id="lg2" x1="16" y1="28.16" x2="57.6" y2="14.08" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A8D4F0"/>
          <stop offset="1" stopColor="#D4E8F7"/>
        </linearGradient>
        <linearGradient id="lg3" x1="44.8" y1="6.54" x2="57.6" y2="19.2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8C5A"/>
          <stop offset="0.5" stopColor="#FF6347"/>
          <stop offset="1" stopColor="#D73027"/>
        </linearGradient>
        <linearGradient id="lg4" x1="49.92" y1="8.32" x2="55.04" y2="14.72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8C5A"/>
          <stop offset="0.5" stopColor="#FF6347"/>
          <stop offset="1" stopColor="#D73027"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

interface LogoProps extends VariantProps<typeof logoVariants> {
  variant?: 'full' | 'icon'
  onDark?: boolean
  className?: string
}

function Logo({ variant = 'full', size = 'md', onDark = false, className }: LogoProps) {
  const px = iconSizes[size ?? 'md']
  const textSizes = wordmarkSizes[size ?? 'md']

  return (
    <div data-slot="logo" className={cn(logoVariants({ size }), className)}>
      <LogoMark size={px} onDark={onDark} />
      {variant === 'full' && (
        <div className="flex flex-col leading-none">
          <span
            className="font-bold leading-tight"
            style={{
              fontSize: textSizes.primary,
              color: onDark ? '#ffffff' : '#1a2744',
            }}
          >
            Product Builder
          </span>
          <span
            className="font-medium tracking-[0.15em] uppercase"
            style={{
              fontSize: textSizes.secondary,
              color: onDark ? '#7bb8e0' : '#4a9ad4',
            }}
          >
            Academy
          </span>
        </div>
      )}
    </div>
  )
}

export { Logo, LogoMark }
