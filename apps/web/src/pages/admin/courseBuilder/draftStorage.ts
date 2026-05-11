// localStorage helpers for brand-new-course draft recovery.
// Entries are keyed by a session-scoped UUID so two tabs editing separate
// new drafts don't collide on the same key.

import type { CourseDraft } from './types'

const DRAFT_STORAGE_PREFIX = 'nab:course-builder:draft:'
const SESSION_UUID_KEY = 'nab:course-builder:session'
export const DRAFT_PERSIST_INTERVAL_MS = 500

export interface StoredDraftEntry {
  draft: CourseDraft
  savedAt: number
}

export function getOrCreateSessionUuid(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    let uuid = window.sessionStorage.getItem(SESSION_UUID_KEY)
    if (!uuid) {
      uuid = crypto.randomUUID()
      window.sessionStorage.setItem(SESSION_UUID_KEY, uuid)
    }
    return uuid
  } catch {
    // sessionStorage can throw in privacy mode — fall back to a per-call
    // ephemeral id so the caller doesn't crash.
    return 'ephemeral'
  }
}

function draftStorageKey(sessionUuid: string): string {
  return `${DRAFT_STORAGE_PREFIX}${sessionUuid}`
}

export function readStoredDraft(sessionUuid: string): StoredDraftEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(draftStorageKey(sessionUuid))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraftEntry
    // Validate the bare minimum — if the shape has drifted we discard so the
    // banner doesn't hydrate garbage. A missing `draft.id` key is expected
    // (the whole point is unsaved-draft recovery).
    if (!parsed || typeof parsed !== 'object' || !parsed.draft) return null
    return parsed
  } catch {
    return null
  }
}

export function writeStoredDraft(sessionUuid: string, draft: CourseDraft): void {
  if (typeof window === 'undefined') return
  try {
    const entry: StoredDraftEntry = { draft, savedAt: Date.now() }
    window.localStorage.setItem(draftStorageKey(sessionUuid), JSON.stringify(entry))
  } catch {
    // Quota exceeded / privacy mode — silently drop. The user still has the
    // in-memory draft, this is just a recovery nicety.
  }
}

export function clearStoredDraft(sessionUuid: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(draftStorageKey(sessionUuid))
  } catch {
    /* noop */
  }
}

export function isEmptyNewDraft(d: CourseDraft): boolean {
  // "Empty new" = the default shape produced by newCourse() — no user input.
  // We only show the recovery banner when the page mounts with this blank
  // draft so editing an existing course never sees the banner.
  return (
    d.id === null &&
    d.title === 'Untitled Course' &&
    d.slug === '' &&
    d.tagline === '' &&
    d.description === '' &&
    d.type === 'recorded' &&
    d.startDate === '' &&
    d.endDate === '' &&
    d.maxSeats === '' &&
    d.coverImageKey === null &&
    d.modules.length === 0 &&
    d.learningOutcomes.length === 0 &&
    d.requirements.length === 0 &&
    d.targetAudience.length === 0 &&
    d.instructorIds.length === 0
  )
}

export function formatBannerRelative(ts: number, now: number): string {
  const diffMs = Math.max(0, now - ts)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'a moment'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}
