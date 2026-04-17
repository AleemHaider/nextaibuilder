// FIR-74 — PWA install prompt: native beforeinstallprompt banner + iOS Safari instructions
import { useState, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

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
        className="absolute inset-0 bg-[rgba(13,26,58,0.45)]"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 bg-white rounded-t-[24px] px-6 pb-8 pt-5 max-w-[520px] w-full mx-auto shadow-[0_-8px_40px_rgba(26,39,68,0.2)]">
        {/* Handle */}
        <div className="w-9 h-1 bg-[#e8ecf4] rounded-full mx-auto mb-5" aria-hidden="true" />

        <h2 className="text-[18px] font-[800] text-[#1a2744] text-center mb-5">
          Install on iPhone / iPad
        </h2>

        <ol className="space-y-4">
          <li className="flex items-start gap-3.5">
            <span className="w-7 h-7 rounded-full bg-[#4a9ad4] text-white text-[13px] font-[700] flex items-center justify-center flex-shrink-0 mt-0.5">
              1
            </span>
            <p className="text-[15px] text-[#1a2744] leading-relaxed">
              Tap the <strong>Share</strong> button at the bottom of Safari (the box with an arrow pointing up).
            </p>
          </li>
          <li className="flex items-start gap-3.5">
            <span className="w-7 h-7 rounded-full bg-[#4a9ad4] text-white text-[13px] font-[700] flex items-center justify-center flex-shrink-0 mt-0.5">
              2
            </span>
            <p className="text-[15px] text-[#1a2744] leading-relaxed">
              Scroll down and tap <strong>"Add to Home Screen"</strong>.
            </p>
          </li>
          <li className="flex items-start gap-3.5">
            <span className="w-7 h-7 rounded-full bg-[#4a9ad4] text-white text-[13px] font-[700] flex items-center justify-center flex-shrink-0 mt-0.5">
              3
            </span>
            <p className="text-[15px] text-[#1a2744] leading-relaxed">
              Tap <strong>"Add"</strong> in the top-right corner.
            </p>
          </li>
        </ol>

        <p className="text-[13px] text-[#a3a3a3] text-center mt-5">
          Open Safari → these steps only work in Safari on iOS
        </p>

        <button
          type="button"
          onClick={onClose}
          className={cn(
            'mt-5 w-full py-3.5 rounded-full text-[15px] font-[700]',
            'bg-[#f0f0f0] text-[#717182] hover:bg-[#e8ecf4] transition-colors',
            'border-none cursor-pointer',
          )}
        >
          Got it
        </button>
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
        'rounded-[16px] px-5 py-4',
        'bg-[linear-gradient(135deg,#1a2744,#2d4a8a)]',
        'shadow-[0_8px_40px_rgba(13,26,58,0.3)]',
        'flex items-center gap-4 sm:gap-5',
      )}
    >
      {/* App icon */}
      <div
        className="w-[52px] h-[52px] rounded-[14px] bg-[rgba(255,255,255,0.15)] flex items-center justify-center text-[26px] flex-shrink-0"
        aria-hidden="true"
      >
        🚀
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-[700] text-white mb-0.5">
          Install nextaibuilder
        </p>
        <p className="text-[13px] text-[rgba(255,255,255,0.65)] leading-snug">
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
            'bg-transparent border border-[rgba(255,255,255,0.25)]',
            'text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.1)] transition-colors',
            'cursor-pointer',
          )}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={onInstall}
          className={cn(
            'px-4 py-2.5 rounded-full text-[13px] font-[700]',
            'bg-[#4a9ad4] text-[#0d1a3a]',
            'hover:opacity-90 transition-opacity border-none cursor-pointer',
          )}
        >
          Install App
        </button>
      </div>

      {/* Close X */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss install prompt"
        className={cn(
          'absolute top-2.5 right-2.5 w-7 h-7 rounded-full',
          'text-[rgba(255,255,255,0.4)] hover:text-white hover:bg-[rgba(255,255,255,0.1)]',
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
