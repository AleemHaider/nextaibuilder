// Shared brand logo — navy / sky / orange (PBA original) palette
// Sprint 5 Story 24 — restored from the transitional Wise lime scheme back
// to the original Product Builder Academy deep-navy + sky-blue + warm-orange
// gradient system. Keeps the same variant + size API so every caller
// (TopNav, Footer, AdminLeftPanel) continues to work.
//
// Usage: <Logo /> · <Logo variant="dark" /> · <Logo size="lg" />

interface LogoProps {
  /** 'light' = navy text on white/canvas bg (default), 'dark' = white text on navy panel */
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

// Navy / sky / orange palette kept inline here because the logo renders SVG
// fills — SVG `fill` attributes don't resolve CSS custom properties across
// every browser target we support, so we read the same raw values the token
// file declares.
const NAVY = {
  deep: '#1a2744',       // deepBlue start
  deepEnd: '#4a90c4',    // deepBlue end
  sky: '#7bb8e0',        // skyBlue start
  skyEnd: '#4a9ad4',     // skyBlue end / accent
  pale: '#a8d4f0',       // paleBlue start
  paleEnd: '#d4e8f7',    // paleBlue end
  orangeStart: '#ff8c5a',
  orangeMid:   '#ff6347',
  orangeEnd:   '#d73027',
}

export function Logo({ variant = 'light', size = 'md', style, className }: LogoProps) {
  const s = SIZES[size]
  const isDark = variant === 'dark'

  // On the dark (navy) panels we use a translucent sky pill so the "NEXT"
  // tag reads against the darker surface without fighting the logo.
  const pillBg   = isDark ? 'rgba(74, 154, 212, 0.2)' : '#e8f4fd'
  const dotColor = isDark ? NAVY.skyEnd : NAVY.deep
  const tagColor = isDark ? NAVY.skyEnd : NAVY.skyEnd
  const wordColor= isDark ? '#ffffff' : NAVY.deep

  // Unique gradient IDs keep multiple Logo instances from colliding.
  const uid = `${size}-${variant}`
  const idDeep   = `logoDeep-${uid}`
  const idSky    = `logoSky-${uid}`
  const idPale   = `logoPale-${uid}`
  const idOrange = `logoOrange-${uid}`

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
        <defs>
          <linearGradient id={idDeep} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor={NAVY.deep} />
            <stop offset="100%" stopColor={NAVY.deepEnd} />
          </linearGradient>
          <linearGradient id={idSky} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor={NAVY.sky} />
            <stop offset="100%" stopColor={NAVY.skyEnd} />
          </linearGradient>
          <linearGradient id={idPale} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor={NAVY.pale} />
            <stop offset="100%" stopColor={NAVY.paleEnd} />
          </linearGradient>
          <linearGradient id={idOrange} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor={NAVY.orangeStart} />
            <stop offset="50%"  stopColor={NAVY.orangeMid} />
            <stop offset="100%" stopColor={NAVY.orangeEnd} />
          </linearGradient>
        </defs>

        {/* cardinal rays — deep navy foundation */}
        <rect x="24" y="0"  width="8"  height="10" fill={`url(#${idDeep})`} />
        <rect x="24" y="46" width="8"  height="10" fill={`url(#${idDeep})`} />
        <rect x="0"  y="24" width="10" height="8"  fill={`url(#${idDeep})`} />
        <rect x="46" y="24" width="10" height="8"  fill={`url(#${idDeep})`} />
        {/* diagonal rays — sky progression */}
        <rect x="8"  y="8"  width="7" height="7" fill={`url(#${idSky})`} />
        <rect x="41" y="8"  width="7" height="7" fill={`url(#${idSky})`} />
        <rect x="8"  y="41" width="7" height="7" fill={`url(#${idSky})`} />
        <rect x="41" y="41" width="7" height="7" fill={`url(#${idSky})`} />
        {/* mid ring — sky */}
        <rect x="16" y="10" width="8" height="8" fill={`url(#${idSky})`} />
        <rect x="32" y="10" width="8" height="8" fill={`url(#${idSky})`} />
        <rect x="10" y="16" width="8" height="8" fill={`url(#${idSky})`} />
        <rect x="38" y="16" width="8" height="8" fill={`url(#${idSky})`} />
        <rect x="16" y="38" width="8" height="8" fill={`url(#${idSky})`} />
        <rect x="32" y="38" width="8" height="8" fill={`url(#${idSky})`} />
        <rect x="10" y="32" width="8" height="8" fill={`url(#${idSky})`} />
        <rect x="38" y="32" width="8" height="8" fill={`url(#${idSky})`} />
        {/* inner ring — pale aspiration */}
        <rect x="18" y="18" width="20" height="20" fill={`url(#${idPale})`} />
        <rect x="20" y="20" width="16" height="16" fill={`url(#${idSky})`} />
        <rect x="22" y="22" width="12" height="12" fill={`url(#${idDeep})`} />
        {/* center pixel — warm orange accent */}
        <rect x="24" y="24" width="8"  height="8"  fill={`url(#${idOrange})`} />
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
              letterSpacing: '0.15em',
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
