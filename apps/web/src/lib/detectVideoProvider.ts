// NAB-P0-5 — Multi-provider video support (frontend copy).
//
// Mirror of `apps/api/src/lib/detectVideoProvider.ts`. Duplicated verbatim
// so the web workspace doesn't need a cross-workspace ESM import. Keep in
// sync when either file is edited.

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
