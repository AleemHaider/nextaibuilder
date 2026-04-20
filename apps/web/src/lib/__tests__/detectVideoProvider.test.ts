// NAB-P0-5 — Regex coverage for detectVideoProvider + toEmbedUrl (frontend).
//
// Mirrors the backend copy — keep in sync.

import { describe, it, expect } from 'vitest'
import {
  detectVideoProvider,
  extractVideoId,
  toEmbedUrl,
} from '../detectVideoProvider'

describe('detectVideoProvider', () => {
  it('detects Loom share URLs', () => {
    expect(detectVideoProvider('https://www.loom.com/share/abc123def')).toBe('LOOM')
    expect(detectVideoProvider('https://loom.com/share/xyz789')).toBe('LOOM')
  })

  it('detects Loom URLs with query string', () => {
    expect(
      detectVideoProvider('https://www.loom.com/share/abc123?sid=42&t=5'),
    ).toBe('LOOM')
  })

  it('detects YouTube long-form watch URLs', () => {
    expect(detectVideoProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('YOUTUBE')
    expect(detectVideoProvider('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('YOUTUBE')
  })

  it('detects YouTube watch URLs with extra query params', () => {
    expect(
      detectVideoProvider('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ'),
    ).toBe('YOUTUBE')
    expect(
      detectVideoProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s'),
    ).toBe('YOUTUBE')
  })

  it('detects youtu.be short links', () => {
    expect(detectVideoProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('YOUTUBE')
    expect(detectVideoProvider('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe('YOUTUBE')
  })

  it('detects YouTube embed URLs', () => {
    expect(detectVideoProvider('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('YOUTUBE')
  })

  it('detects Vimeo URLs', () => {
    expect(detectVideoProvider('https://vimeo.com/123456789')).toBe('VIMEO')
    expect(detectVideoProvider('https://www.vimeo.com/123456789')).toBe('VIMEO')
  })

  it('detects Vimeo URLs with query string', () => {
    expect(detectVideoProvider('https://vimeo.com/123456789?share=copy')).toBe('VIMEO')
  })

  it('detects Vimeo player URLs', () => {
    expect(detectVideoProvider('https://player.vimeo.com/video/123456789')).toBe('VIMEO')
  })

  it('returns null on empty or unknown URLs', () => {
    expect(detectVideoProvider('')).toBeNull()
    expect(detectVideoProvider('   ')).toBeNull()
    expect(detectVideoProvider('https://example.com/video/123')).toBeNull()
    expect(detectVideoProvider('https://wistia.com/medias/abc123')).toBeNull()
    expect(detectVideoProvider('not a url')).toBeNull()
  })

  it('handles non-string inputs safely', () => {
    // @ts-expect-error — exercise the runtime guard
    expect(detectVideoProvider(null)).toBeNull()
    // @ts-expect-error — exercise the runtime guard
    expect(detectVideoProvider(undefined)).toBeNull()
  })
})

describe('extractVideoId', () => {
  it('extracts Loom IDs', () => {
    expect(extractVideoId('LOOM', 'https://www.loom.com/share/abc123')).toBe('abc123')
  })

  it('extracts YouTube IDs from every shape', () => {
    expect(extractVideoId('YOUTUBE', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('YOUTUBE', 'https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('YOUTUBE', 'https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts Vimeo IDs', () => {
    expect(extractVideoId('VIMEO', 'https://vimeo.com/123456789')).toBe('123456789')
    expect(extractVideoId('VIMEO', 'https://player.vimeo.com/video/123456789')).toBe('123456789')
  })

  it('returns null for a mismatched URL / provider', () => {
    expect(extractVideoId('LOOM', 'https://youtu.be/dQw4w9WgXcQ')).toBeNull()
    expect(extractVideoId('VIMEO', '')).toBeNull()
  })
})

describe('toEmbedUrl', () => {
  it('builds the expected Loom embed URL', () => {
    expect(toEmbedUrl('LOOM', 'https://www.loom.com/share/abc123')).toBe(
      'https://www.loom.com/embed/abc123',
    )
  })

  it('builds the expected YouTube embed URL', () => {
    expect(toEmbedUrl('YOUTUBE', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    )
    expect(toEmbedUrl('YOUTUBE', 'https://youtu.be/dQw4w9WgXcQ?t=1')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    )
  })

  it('builds the expected Vimeo embed URL', () => {
    expect(toEmbedUrl('VIMEO', 'https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789',
    )
  })

  it('falls back to auto-detection when no provider is supplied', () => {
    expect(toEmbedUrl(null, 'https://www.loom.com/share/abc123')).toBe(
      'https://www.loom.com/embed/abc123',
    )
    expect(toEmbedUrl(undefined, 'https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    )
  })

  it('returns null for unsupported / empty URLs', () => {
    expect(toEmbedUrl(null, '')).toBeNull()
    expect(toEmbedUrl(null, 'https://example.com/abc')).toBeNull()
    expect(toEmbedUrl('LOOM', null)).toBeNull()
  })
})
