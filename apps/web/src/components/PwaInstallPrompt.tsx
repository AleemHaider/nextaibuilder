// FIR-74 — PWA install prompt: native beforeinstallprompt banner + iOS Safari instructions
// Sprint 3 Story 14 — Wise theme: 30px radius surface, lime CTA, lucide
// icons in place of the 🚀 emoji.
import { useState, useEffect, useRef, useCallback } from 'react'
import { Rocket, Share, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'

// ---------------------------------------------------------------------------
// Browser-env helpers
// ---------------------------------------------------------------------------

function isStandaloneMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream
}

const SESSION_KEY = 'pwa_dismissed'

// ---------------------------------------------------------------------------
// BeforeInstallPromptEvent type (not in lib.dom.d.ts yet)
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ---------------------------------------------------------------------------
// iOS bottom sheet
// ---------------------------------------------------------------------------

interface IosSheetProps {
  onClose: () => void
}

function IosSheet({ onClose }: IosSheetProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Install app on iOS"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-wise-dark)]/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'relative z-10 bg-white rounded-t-[var(--radius-lg)]',
          'px-6 pb-8 pt-5 max-w-[520px] w-full mx-auto',
          'shadow-[var(--shadow-card)]',
        )}
      >
        {/* Handle */}
        <div className="w-9 h-1 bg-[var(--color-wise-ring)] rounded-full mx-auto mb-5" aria-hidden="true" />

        <h2 className="text-[18px] font-[800] text-[var(--color-wise-text)] text-center mb-5">
          Install on iPhone / iPad
        </h2>

        <ol className="space-y-4">
          <li className="flex items-start gap-3.5">
            <span
              className={cn(
                'w-7 h-7 rounded-full bg-[var(--color-wise-primary)]',
                'text-[var(--color-wise-primary-text)] text-[13px] font-[700]',
                'flex items-center justify-center flex-shrink-0 mt-0.5',
              )}
            >
              1
            </span>
            <p className="text-[15px] text-[var(--color-wise-text)] leading-relaxed">
              Tap the <strong>Share</strong> button
              <Share
                size={14}
                strokeWidth={2.25}
                className="inline-block mx-1 -mt-0.5 text-[var(--color-wise-primary-text)]"
                aria-hidden="true"
              />
              at the bottom of Safari.
            </p>
          </li>
          <li className="flex items-start gap-3.5">
            <span
              className={cn(
                'w-7 h-7 rounded-full bg-[var(--color-wise-primary)]',
                'text-[var(--color-wise-primary-text)] text-[13px] font-[700]',
                'flex items-center justify-center flex-shrink-0 mt-0.5',
              )}
            >
              2
            </span>
            <p className="text-[15px] text-[var(--color-wise-text)] leading-relaxed">
              Scroll down and tap <strong>"Add to Home Screen"</strong>.
            </p>
          </li>
          <li className="flex items-start gap-3.5">
            <span
              className={cn(
                'w-7 h-7 rounded-full bg-[var(--color-wise-primary)]',
                'text-[var(--color-wise-primary-text)] text-[13px] font-[700]',
                'flex items-center justify-center flex-shrink-0 mt-0.5',
              )}
            >
              3
            </span>
            <p className="text-[15px] text-[var(--color-wise-text)] leading-relaxed">
              Tap <strong>"Add"</strong> in the top-right corner.
            </p>
          </li>
        </ol>

        <p className="text-[13px] text-[var(--color-wise-text-muted)] text-center mt-5">
          Open Safari → these steps only work in Safari on iOS
        </p>

        <Button
          variant="outline"
          size="lg"
          onClick={onClose}
          className="mt-5 w-full"
        >
          Got it
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Banner (Android / Chrome / Edge / desktop)
// ---------------------------------------------------------------------------

interface BannerProps {
  onInstall: () => void
  onDismiss: () => void
}

function Banner({ onInstall, onDismiss }: BannerProps) {
  return (
    <div
      role="region"
      aria-label="Install nextaibuilder app"
      className={cn(
        'fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-32px)] max-w-[720px]',
        'rounded-[var(--radius-lg)] px-5 py-4',
        'bg-[var(--color-wise-dark)] text-white',
        'shadow-[var(--shadow-card)]',
        'flex items-center gap-4 sm:gap-5',
      )}
    >
      {/* App icon — lucide Rocket on a mint chip */}
      <div
        className={cn(
          'w-[52px] h-[52px] rounded-[14px] flex items-center justify-center flex-shrink-0',
          'bg-[var(--color-wise-primary)]/20 text-[var(--color-wise-primary)]',
        )}
        aria-hidden="true"
      >
        <Rocket size={24} strokeWidth={2.25} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-[700] text-white mb-0.5">
          Install nextaibuilder
        </p>
        <p className="text-[13px] text-white/65 leading-snug">
          Add to your home screen for a faster, app-like experience.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            'px-4 py-2.5 rounded-full text-[13px] font-[600]',
            'bg-transparent border border-white/25',
            'text-white/70 hover:bg-white/10 transition-colors',
            'cursor-pointer',
          )}
        >
          Not now
        </button>
        <Button
          variant="primary"
          size="sm"
          onClick={onInstall}
          className="px-5"
        >
          Install App
        </Button>
      </div>

      {/* Close X */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss install prompt"
        className={cn(
          'absolute top-2.5 right-2.5 w-7 h-7 rounded-full',
          'text-white/40 hover:text-white hover:bg-white/10',
          'transition-colors flex items-center justify-center border-none bg-transparent cursor-pointer',
        )}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PwaInstallPrompt
// ---------------------------------------------------------------------------

export function PwaInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false)
  const [showIosSheet, setShowIosSheet] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Already installed or dismissed this session
    if (isStandaloneMode()) return
    if (sessionStorage.getItem(SESSION_KEY)) return

    if (isIos()) {
      // iOS: show manual Safari instructions banner after short delay
      const timer = setTimeout(() => setShowBanner(true), 2000)
      return () => clearTimeout(timer)
    }

    // Chrome/Edge/Android: listen for native prompt
    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const handleInstall = useCallback(async () => {
    if (isIos()) {
      setShowBanner(false)
      setShowIosSheet(true)
      return
    }

    const prompt = deferredPromptRef.current
    if (!prompt) return

    await prompt.prompt()
    const { outcome } = await prompt.userChoice

    deferredPromptRef.current = null
    setShowBanner(false)

    if (outcome === 'dismissed') {
      sessionStorage.setItem(SESSION_KEY, '1')
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setShowBanner(false)
    setShowIosSheet(false)
    sessionStorage.setItem(SESSION_KEY, '1')
  }, [])

  if (!showBanner && !showIosSheet) return null

  return (
    <>
      {showBanner && (
        <Banner onInstall={handleInstall} onDismiss={handleDismiss} />
      )}
      {showIosSheet && (
        <IosSheet onClose={handleDismiss} />
      )}
    </>
  )
}
