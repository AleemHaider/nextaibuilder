/**
 * Route-enumeration invariant for admin routes (Week 2, audit P0 #10).
 *
 * The FIR v2 admin routes were originally registered with the coarse
 * `requireAdmin` middleware, which let any sub-admin (regardless of their
 * SubAdminPermission grants) hit refund/cancel/transfer endpoints. The fix
 * was to switch everything to `requirePermission(...)` (or the stricter
 * `requireSuperAdmin` for super-admin-only management routes).
 *
 * Invariant: no preHandler under `routes/admin/` may reference `requireAdmin`.
 * `requirePermission(...)` and `requireSuperAdmin` are both acceptable.
 *
 * Approach: static source analysis. We slurp every .ts file under routes/admin
 * (excluding tests + barrels), find each `fastify.<method>(` registration,
 * and assert the registration's source does NOT contain `requireAdmin` as a
 * bare identifier. We stay at the source level instead of booting Fastify so
 * the test is fast, deterministic, and doesn't require Mongo/Redis.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ADMIN_ROUTES_DIR = join(__dirname, '..', 'routes', 'admin')

// Files in routes/admin/ that are NOT route plugins (helpers, barrels).
const NON_ROUTE_FILES = new Set<string>([])

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

interface RouteRegistration {
  file: string
  line: number
  method: string
  // The full matched snippet (handler signature through preHandler block,
  // truncated). Kept for assertion error messages.
  snippet: string
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) continue
    if (!entry.endsWith('.ts')) continue
    if (entry.endsWith('.test.ts') || entry.endsWith('.d.ts')) continue
    if (NON_ROUTE_FILES.has(entry)) continue
    out.push(full)
  }
  return out
}

/**
 * Find every fastify.<method>(...) call in the file.
 * Returns the index of the opening `(` so we can pair it with a matching `)`
 * and inspect the options object that lives between the path string and
 * the handler function.
 */
function findRouteRegistrations(source: string, file: string): RouteRegistration[] {
  const results: RouteRegistration[] = []
  // Match `fastify.get(`, `fastify.post<…>(`, etc.  Generic args are optional.
  const re = /\bfastify\.(get|post|put|patch|delete|head|options)\b(?:<[^>]*>)?\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const method = m[1]
    if (!method || !HTTP_METHODS.includes(method)) continue
    const openParen = m.index + m[0].length - 1
    // Walk forward to find the matching close paren, respecting nesting
    const closeParen = matchParen(source, openParen)
    if (closeParen === -1) continue
    const snippet = source.slice(openParen, closeParen + 1)
    const line = source.slice(0, m.index).split('\n').length
    results.push({ file, line, method, snippet })
  }
  return results
}

/**
 * Given the position of an opening `(`, return the position of its matching
 * `)`. Honours strings, template literals, line and block comments.
 */
function matchParen(source: string, openIdx: number): number {
  let depth = 0
  let i = openIdx
  let inSingle = false
  let inDouble = false
  let inBacktick = false
  let inLineComment = false
  let inBlockComment = false
  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    if (inLineComment) {
      if (ch === '\n') inLineComment = false
    } else if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++ }
    } else if (inSingle) {
      if (ch === '\\') i++
      else if (ch === "'") inSingle = false
    } else if (inDouble) {
      if (ch === '\\') i++
      else if (ch === '"') inDouble = false
    } else if (inBacktick) {
      if (ch === '\\') i++
      else if (ch === '`') inBacktick = false
    } else if (ch === '/' && next === '/') {
      inLineComment = true
    } else if (ch === '/' && next === '*') {
      inBlockComment = true; i++
    } else if (ch === "'") inSingle = true
    else if (ch === '"') inDouble = true
    else if (ch === '`') inBacktick = true
    else if (ch === '(') depth++
    else if (ch === ')') { depth--; if (depth === 0) return i }
    i++
  }
  return -1
}

// ─────────────────────────────────────────────────────────────────────────────
// The actual test
// ─────────────────────────────────────────────────────────────────────────────

describe('admin routes — permission gate invariant', () => {
  const sourceFiles = listSourceFiles(ADMIN_ROUTES_DIR)

  it('discovers route files', () => {
    expect(sourceFiles.length).toBeGreaterThan(5)
  })

  it.each(sourceFiles.map((f) => [f.split('/').pop()!, f]))(
    'every fastify.* route in %s has a requirePermission preHandler',
    (_label, file) => {
      const source = readFileSync(file, 'utf8')
      const registrations = findRouteRegistrations(source, file)

      // Forbid bare `requireAdmin` — it lets sub-admins bypass their
      // SubAdminPermission scope. `requirePermission(...)` and
      // `requireSuperAdmin` are both acceptable gates.
      const violators = registrations.filter((r) => /\brequireAdmin\b/.test(r.snippet))

      if (violators.length > 0) {
        const detail = violators
          .map(
            (v) =>
              `  ${v.file.split('/routes/').pop()}:${v.line} — fastify.${v.method}(...) uses bare requireAdmin`,
          )
          .join('\n')
        throw new Error(
          `Found ${violators.length} admin route(s) gated by bare requireAdmin:\n${detail}\n` +
            `Replace with requirePermission('...') for per-permission gates, or ` +
            `requireSuperAdmin for super-admin-only management routes.`,
        )
      }
    },
  )
})
