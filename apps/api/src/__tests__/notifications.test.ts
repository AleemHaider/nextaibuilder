/**
 * Sprint 4 Story 20 — Student notification DELETE routes
 *
 * Routes under test (apps/api/src/routes/student/notifications.ts):
 *   DELETE /notifications/:id — delete one (ownership-enforced)
 *   DELETE /notifications     — bulk delete, optional ?status=read|unread
 *
 * Strategy
 * --------
 * We don't boot Fastify. Instead we register the plugin against a fake
 * instance that captures every (method, path, handler) triple the same way
 * the admin-invite and oauth-invite tests do, then invoke the captured
 * handlers directly with hand-rolled FastifyRequest/Reply stubs.
 *
 * The Notification model is vi.mock()'d so no MongoDB connection is ever
 * opened. requireStudent is also stubbed to a no-op — the middleware has
 * its own coverage in authenticate.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Types } from 'mongoose'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../middleware/authenticate.js', () => ({
  requireStudent: async () => undefined,
}))

vi.mock('../models/Notification.js', () => ({
  Notification: {
    findOneAndDelete: vi.fn(),
    deleteMany:       vi.fn(),
    // Included so the full-file registration doesn't blow up when other
    // handlers (GET, PATCH) reference these helpers.
    find:             vi.fn(),
    countDocuments:   vi.fn(),
    updateMany:       vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}))

import { Notification } from '../models/Notification.js'
import { studentNotificationsRoutes } from '../routes/student/notifications.js'

// ---------------------------------------------------------------------------
// Fake Fastify helpers
// ---------------------------------------------------------------------------

type Method = 'get' | 'post' | 'patch' | 'delete' | 'put'

type Handler = (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

type FakeReply = {
  sent: boolean
  _status: number | null
  _body: unknown
  code: (s: number) => FakeReply
  send: (b: unknown) => FakeReply
}

function makeReply(): FakeReply {
  const r: FakeReply = {
    sent: false,
    _status: null,
    _body: undefined,
    code(status) {
      r._status = status
      return r
    },
    send(body) {
      r._body = body
      r.sent = true
      return r
    },
  }
  return r
}

function makeRequest(
  params: Record<string, string> = {},
  user: Record<string, string> = { sub: new Types.ObjectId().toString(), role: 'STUDENT' },
  query: Record<string, string> = {},
): FastifyRequest {
  return { params, user, query } as unknown as FastifyRequest
}

async function buildFastify() {
  const routes: Record<string, Handler> = {}

  const register = (method: Method) =>
    vi.fn().mockImplementation(
      (path: string, _opts: unknown, handler: Handler) => {
        routes[`${method.toUpperCase()} ${path}`] = handler
      },
    )

  const fastify = {
    get:    register('get'),
    post:   register('post'),
    patch:  register('patch'),
    delete: register('delete'),
    put:    register('put'),
    log:    { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as FastifyInstance

  await studentNotificationsRoutes(fastify)
  return { fastify, routes }
}

async function getHandler(key: string): Promise<Handler> {
  const { routes } = await buildFastify()
  const h = routes[key]
  if (!h) throw new Error(`No handler registered for ${key}`)
  return h
}

// ---------------------------------------------------------------------------
// DELETE /notifications/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/student/notifications/:id', () => {
  const USER_ID = new Types.ObjectId().toString()
  const NOTIF_ID = new Types.ObjectId().toString()

  let handle: Handler

  beforeEach(async () => {
    vi.mocked(Notification.findOneAndDelete).mockReset()
    handle = await getHandler('DELETE /notifications/:id')
  })

  it('deletes a notification owned by the caller and returns ok:true', async () => {
    vi.mocked(Notification.findOneAndDelete).mockResolvedValue({ _id: NOTIF_ID } as never)

    const req = makeRequest({ id: NOTIF_ID }, { sub: USER_ID, role: 'STUDENT' })
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._status).toBeNull() // default 200
    expect(reply._body).toEqual({ ok: true })
    // Ownership enforced via userId in the query
    const call = vi.mocked(Notification.findOneAndDelete).mock.calls[0][0] as {
      userId: Types.ObjectId
    }
    expect(call.userId.toString()).toBe(USER_ID)
  })

  it('returns 400 when the :id param is not a valid ObjectId', async () => {
    const req = makeRequest({ id: 'not-an-id' }, { sub: USER_ID, role: 'STUDENT' })
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(400)
    expect((reply._body as { error: string }).error).toBe('INVALID_ID')
    expect(vi.mocked(Notification.findOneAndDelete)).not.toHaveBeenCalled()
  })

  it('returns 404 when the notification does not exist or is owned by another user', async () => {
    // The query has userId baked in, so a notification owned by someone else
    // will simply not match — findOneAndDelete returns null.
    vi.mocked(Notification.findOneAndDelete).mockResolvedValue(null as never)

    const req = makeRequest({ id: NOTIF_ID }, { sub: USER_ID, role: 'STUDENT' })
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._status).toBe(404)
    expect((reply._body as { error: string }).error).toBe('NOTIFICATION_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// DELETE /notifications (bulk)
// ---------------------------------------------------------------------------

describe('DELETE /api/student/notifications (bulk)', () => {
  const USER_ID = new Types.ObjectId().toString()
  let handle: Handler

  beforeEach(async () => {
    vi.mocked(Notification.deleteMany).mockReset()
    handle = await getHandler('DELETE /notifications')
  })

  it('deletes every notification the user owns when no ?status filter is set', async () => {
    vi.mocked(Notification.deleteMany).mockResolvedValue({ deletedCount: 7 } as never)

    const req = makeRequest({}, { sub: USER_ID, role: 'STUDENT' })
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._body).toEqual({ ok: true, deletedCount: 7 })
    const filter = vi.mocked(Notification.deleteMany).mock.calls[0][0] as {
      userId: Types.ObjectId
      read?: boolean
    }
    expect(filter.userId.toString()).toBe(USER_ID)
    // No read filter means "delete everything the caller owns"
    expect(filter.read).toBeUndefined()
  })

  it('scopes the delete to read notifications when ?status=read', async () => {
    vi.mocked(Notification.deleteMany).mockResolvedValue({ deletedCount: 3 } as never)

    const req = makeRequest(
      {},
      { sub: USER_ID, role: 'STUDENT' },
      { status: 'read' },
    )
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    expect(reply._body).toEqual({ ok: true, deletedCount: 3 })
    const filter = vi.mocked(Notification.deleteMany).mock.calls[0][0] as {
      userId: Types.ObjectId
      read?: boolean
    }
    expect(filter.read).toBe(true)
  })

  it('scopes the delete to unread notifications when ?status=unread', async () => {
    vi.mocked(Notification.deleteMany).mockResolvedValue({ deletedCount: 2 } as never)

    const req = makeRequest(
      {},
      { sub: USER_ID, role: 'STUDENT' },
      { status: 'unread' },
    )
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    const filter = vi.mocked(Notification.deleteMany).mock.calls[0][0] as {
      userId: Types.ObjectId
      read?: boolean
    }
    expect(filter.read).toBe(false)
  })

  it('ignores unknown ?status values and deletes all (defensive default)', async () => {
    vi.mocked(Notification.deleteMany).mockResolvedValue({ deletedCount: 9 } as never)

    const req = makeRequest(
      {},
      { sub: USER_ID, role: 'STUDENT' },
      { status: 'garbage' },
    )
    const reply = makeReply()

    await handle(req, reply as unknown as FastifyReply)

    const filter = vi.mocked(Notification.deleteMany).mock.calls[0][0] as {
      userId: Types.ObjectId
      read?: boolean
    }
    expect(filter.read).toBeUndefined()
    expect(reply._body).toEqual({ ok: true, deletedCount: 9 })
  })
})
