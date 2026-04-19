// Shared brand logo — Wise-themed variant
// Sprint 3 Story 14 — re-coloured from the legacy navy/sky palette to the
// Wise lime + warm-black tokens. Keeps the same variant + size API so every
// caller (TopNav, Footer, AdminLeftPanel) continues to work.
//
// Usage: <Logo /> · <Logo variant="dark" /> · <Logo size="lg" />

interface LogoProps {
  /** 'light' = warm-black text on white/canvas bg (default), 'dark' = white text on #0e0f0c */
  variant?: 'light' | 'dark'
  /** sm = compact nav, md = default nav (default), lg = marketing hero */
  size?: 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
  className?: string
}

const SIZES = {
  sm: { spark: 22, wordmark: 17, pill: 8,  gap: 9 },
  md: { spark: 28, wordmark: 21, pill: 9,  gap: 11 },
  lg: { spark: 36, wordmark: 27, pill: 10, gap: 13 },
}

// Wise token values kept inline here because the logo renders SVG fills —
// SVG `fill` attributes don't resolve CSS custom properties across every
// browser target we support, so we read the same raw values the token file
// declares.
const WISE = {
  // Lime primary (9fe870) · deep pill text (163300) · warm black (0e0f0c)
  primary: '#9fe870',
  primaryLight: '#cdffad',
  primaryText: '#163300',
  text: '#0e0f0c',
  mint: '#e2f6d5',
}

export function Logo({ variant = 'light', size = 'md', style, className }: LogoProps) {
  const s = SIZES[size]
  const isDark = variant === 'dark'

  // On the dark (#0e0f0c) panels we use a translucent lime pill so the
  // "NEXT" tag reads against the darker surface without fighting the logo.
  const pillBg   = isDark ? 'rgba(159,232,112,0.15)' : WISE.mint
  const dotColor = isDark ? WISE.primary : WISE.primaryText
  const tagColor = isDark ? WISE.primary : WISE.primaryText
  const wordColor= isDark ? '#ffffff' : WISE.text

  // Spark mark palette — lime anchors + softer lime-on-mint mid ring so the
  // mark reads on both white and the warm-black dark panel.
  const sparkOuter = WISE.primary
  const sparkMid   = WISE.primaryLight
  const sparkInnerBg = isDark ? 'rgba(159,232,112,0.18)' : WISE.mint
  const sparkInner = WISE.primary
  const sparkCoreDot = isDark ? '#ffffff' : WISE.primaryText
  const sparkCenter = WISE.primaryText

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: s.gap,
        textDecoration: 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* ── Spark mark ── */}
      <svg
        width={s.spark}
        height={s.spark}
        viewBox="0 0 56 56"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {/* cardinal rays */}
        <rect x="24" y="0"  width="8"  height="10" fill={sparkOuter} />
        <rect x="24" y="46" width="8"  height="10" fill={sparkOuter} />
        <rect x="0"  y="24" width="10" height="8"  fill={sparkOuter} />
        <rect x="46" y="24" width="10" height="8"  fill={sparkOuter} />
        {/* diagonal rays */}
        <rect x="8"  y="8"  width="7" height="7" fill={sparkMid} />
        <rect x="41" y="8"  width="7" height="7" fill={sparkMid} />
        <rect x="8"  y="41" width="7" height="7" fill={sparkMid} />
        <rect x="41" y="41" width="7" height="7" fill={sparkMid} />
        {/* mid ring */}
        <rect x="16" y="10" width="8" height="8" fill={sparkMid} />
        <rect x="32" y="10" width="8" height="8" fill={sparkMid} />
        <rect x="10" y="16" width="8" height="8" fill={sparkMid} />
        <rect x="38" y="16" width="8" height="8" fill={sparkMid} />
        <rect x="16" y="38" width="8" height="8" fill={sparkMid} />
        <rect x="32" y="38" width="8" height="8" fill={sparkMid} />
        <rect x="10" y="32" width="8" height="8" fill={sparkMid} />
        <rect x="38" y="32" width="8" height="8" fill={sparkMid} />
        {/* inner ring */}
        <rect x="18" y="18" width="20" height="20" fill={sparkInnerBg} />
        <rect x="20" y="20" width="16" height="16" fill={sparkInner} />
        <rect x="22" y="22" width="12" height="12" fill={sparkCenter} />
        {/* center pixel */}
        <rect x="24" y="24" width="8"  height="8"  fill={sparkCoreDot} />
      </svg>

      {/* ── Wordmark ── */}
      <div style={{ lineHeight: 1.1 }}>
        {/* pill label */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: pillBg,
            borderRadius: 20,
            padding: '2px 8px 3px',
            marginBottom: 3,
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: dotColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: s.pill,
              fontWeight: 700,
              color: tagColor,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            NEXT
          </span>
        </div>

        {/* main wordmark */}
        <div
          style={{
            fontSize: s.wordmark,
            fontWeight: 900,
            color: wordColor,
            letterSpacing: '-0.8px',
            fontFamily: "'Inter', sans-serif",
            lineHeight: 1,
          }}
        >
          aibuilder
        </div>
      </div>
    </div>
  )
}
