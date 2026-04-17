// PBA-130 — Admin auth middleware re-export
// Routes under src/routes/admin/ import from this clearly named path
// rather than reaching into authenticate.ts for a role-specific concern.

export { requireAdmin, authenticate, type JwtPayload } from './authenticate.js'
