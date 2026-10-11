// PBA-276 — Shared step utilities

/**
 * Extracts the Loom video ID from a Loom share or embed URL.
 * Returns null if the URL is not a valid Loom URL.
 *
 * Supports:
 *   https://www.loom.com/share/abc123
 *   https://loom.com/share/abc123
 *   https://www.loom.com/embed/abc123
 */
export function extractLoomId(url: string): string | null {
  const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/)
  return match?.[1] ?? null
}

/**
 * Returns true if the given URL is a valid Loom share or embed URL.
 */
export function isValidLoomUrl(url: string): boolean {
  return /loom\.com\/(share|embed)\/[a-zA-Z0-9]+/.test(url)
}

/**
 * Normalises a Loom paste that may be a full <iframe> embed code or a plain URL.
 * Extracts the Loom ID from anywhere in the string and returns the canonical
 * share URL. Returns the original trimmed string if no Loom ID is found.
 *
 * Handles:
 *   <iframe src="https://www.loom.com/embed/abc123?..." ...></iframe>
 *   https://www.loom.com/share/abc123
 *   https://www.loom.com/embed/abc123
 */
export function normalizeLoomInput(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/)
  if (match?.[1]) {
    return `https://www.loom.com/share/${match[1]}`
  }
  return trimmed
}
