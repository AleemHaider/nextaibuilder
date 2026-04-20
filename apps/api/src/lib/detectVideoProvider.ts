// NAB-P0-5 — Multi-provider video support.
//
// Regex-only detection for Loom / YouTube / Vimeo URLs, plus an embed-URL
// builder used by the storefront preview player and any other consumer that
// needs an iframe-safe source.
//
// This file is duplicated verbatim in `apps/web/src/lib/detectVideoProvider.ts`
// so the frontend can share the logic without a cross-workspace ESM import.
// If you change this file, change the other one too.

export type VideoProvider = 'LOOM' | 'YOUTUBE' | 'VIMEO'

// Regex patterns — tolerant of query strings, http/https, and www prefix.
const LOOM_RE    = /(?:https?:\/\/)?(?:www\.)?loom\.com\/share\/([a-zA-Z0-9]+)/i
const YT_WATCH_RE = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([a-zA-Z0-9_-]{11})/i
const YT_SHORT_RE = /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i
const YT_EMBED_RE = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i
const VIMEO_RE    = /(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)/i

/**
 * Detect the video provider from a URL.
 * Returns null for empty strings or unknown hosts.
 */
export function detectVideoProvider(url: string): VideoProvider | null {
  if (typeof url !== 'string' || url.trim() === '') return null
  const trimmed = url.trim()
  if (LOOM_RE.test(trimmed)) return 'LOOM'
  if (YT_WATCH_RE.test(trimmed) || YT_SHORT_RE.test(trimmed) || YT_EMBED_RE.test(trimmed)) {
    return 'YOUTUBE'
  }
  if (VIMEO_RE.test(trimmed)) return 'VIMEO'
  return null
}

/**
 * Extract the provider-specific video ID from a URL.
 * Returns null if the URL does not match the expected pattern for the
 * supplied provider.
 */
export function extractVideoId(provider: VideoProvider, url: string): string | null {
  if (typeof url !== 'string' || url.trim() === '') return null
  const trimmed = url.trim()
  if (provider === 'LOOM') {
    const m = LOOM_RE.exec(trimmed)
    return m?.[1] ?? null
  }
  if (provider === 'YOUTUBE') {
    return (
      YT_WATCH_RE.exec(trimmed)?.[1] ??
      YT_SHORT_RE.exec(trimmed)?.[1] ??
      YT_EMBED_RE.exec(trimmed)?.[1] ??
      null
    )
  }
  if (provider === 'VIMEO') {
    const m = VIMEO_RE.exec(trimmed)
    return m?.[1] ?? null
  }
  return null
}

/**
 * Build an iframe-safe embed URL for the given provider + source URL.
 * Returns null if the URL cannot be parsed.
 */
export function toEmbedUrl(
  provider: VideoProvider | null | undefined,
  url: string | null | undefined,
): string | null {
  if (!url) return null
  const resolved = provider ?? detectVideoProvider(url)
  if (!resolved) return null
  const id = extractVideoId(resolved, url)
  if (!id) return null
  if (resolved === 'LOOM')    return `https://www.loom.com/embed/${id}`
  if (resolved === 'YOUTUBE') return `https://www.youtube.com/embed/${id}`
  if (resolved === 'VIMEO')   return `https://player.vimeo.com/video/${id}`
  return null
}
