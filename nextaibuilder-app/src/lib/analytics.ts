// Thin wrapper around GA4 / window.gtag
// Safe to call even if analytics is not loaded

type EventProps = Record<string, string | number | boolean>

export function trackEvent(name: string, props?: EventProps): void {
  try {
    if (typeof window !== 'undefined' && typeof (window as unknown as { gtag?: unknown }).gtag === 'function') {
      (window as unknown as { gtag: (cmd: string, name: string, props?: EventProps) => void }).gtag('event', name, props)
    }
  } catch {
    // never throw from analytics
  }
}
