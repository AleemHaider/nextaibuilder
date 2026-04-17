// FIR-157 — Enrollment success page shown after payment confirmation
import { useNavigate, useSearchParams } from 'react-router'
import { cn } from '../lib/utils'

// ---------------------------------------------------------------------------
// CSS-only animated checkmark using Tailwind keyframe animation
// The ring draws itself via a stroke-dashoffset trick on an SVG circle.
// No external animation library required.
// ---------------------------------------------------------------------------

export default function EnrollmentSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Cohort name can be passed as a query param for a personalised message
  const cohortName = searchParams.get('cohort') ?? 'your course'

  return (
    <div
      className={cn(
        'min-h-screen bg-[#f8f9fb] flex flex-col items-center justify-center px-4',
      )}
    >
      {/* Success card */}
      <div
        className={cn(
          'bg-white rounded-[20px] p-12 text-center w-full max-w-[480px]',
          'shadow-[rgba(26,39,68,0.12)_0_0_0_1px]',
        )}
        role="main"
        aria-labelledby="success-heading"
      >
        {/* Animated checkmark */}
        <div className="flex items-center justify-center mb-6" aria-hidden="true">
          <div className="relative w-[72px] h-[72px]">
            {/* Background circle */}
            <div
              className={cn(
                'absolute inset-0 rounded-full bg-[#e6f4ec]',
                'animate-[ping_0.4s_ease-out_forwards]',
              )}
              style={{ animationIterationCount: 1 }}
            />
            {/* SVG animated ring */}
            <svg
              viewBox="0 0 72 72"
              className="absolute inset-0 w-full h-full"
              aria-hidden="true"
            >
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="#e6f4ec"
                stroke="#054d28"
                strokeWidth="2.5"
                strokeDasharray="201"
                strokeDashoffset="201"
                style={{
                  animation: 'draw-ring 0.6s ease-out 0.1s forwards',
                }}
              />
              {/* Checkmark path */}
              <path
                d="M22 36 L31 45 L50 26"
                fill="none"
                stroke="#054d28"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="42"
                strokeDashoffset="42"
                style={{
                  animation: 'draw-check 0.35s ease-out 0.55s forwards',
                }}
              />
            </svg>
          </div>
        </div>

        {/* CSS animations injected via a style tag */}
        <style>{`
          @keyframes draw-ring {
            to { stroke-dashoffset: 0; }
          }
          @keyframes draw-check {
            to { stroke-dashoffset: 0; }
          }
        `}</style>

        <h1
          id="success-heading"
          className="text-[28px] font-black text-[#1a2744] mb-2"
        >
          You're enrolled!
        </h1>

        <p className="text-[16px] text-[#717182] leading-relaxed mb-8">
          Your payment was successful. Welcome to{' '}
          <span className="font-semibold text-[#1a2744]">{cohortName}</span>.
          Check your email for access details.
        </p>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => navigate('/student/dashboard')}
          className={cn(
            'w-full h-14 rounded-full bg-[#4a9ad4] text-[#0d1a3a]',
            'text-[16px] font-bold hover:opacity-90 transition-opacity cursor-pointer border-none mb-4',
          )}
        >
          Go to My Courses →
        </button>

        {/* Secondary — receipt hint */}
        <p className="text-[14px] text-[#717182]">
          A receipt has been sent to your email address.
        </p>
      </div>
    </div>
  )
}
