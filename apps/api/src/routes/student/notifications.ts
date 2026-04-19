// PBA-380 — Student Notifications API
// GET    /api/student/notifications          — last 50 notifications + unreadCount
// PATCH  /api/student/notifications/read-all — mark all as read
// PATCH  /api/student/notifications/:id/read — mark single notification as read
// DELETE /api/student/notifications/:id      — delete a notification
// DELETE /api/student/notifications          — bulk delete (optional ?status=read)
//                                              Sprint 4 Story 20

import type { FastifyInstance } from 'fastify'
import { Types } from 'mongoose'
import { requireStudent, type JwtPayload } from '../../middleware/authenticate.js'
import { Notification } from '../../models/Notification.js'

export async function studentNotificationsRoutes(fastify: FastifyInstance) {

  // ── GET /notifications ── Fetch inbox ─────────────────────────────────
  fastify.get(
    '/notifications',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: userId } = request.user as JwtPayload

      const [notifications, unreadCount] = await Promise.all([
        Notification.find({ userId: new Types.ObjectId(userId) })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean({ virtuals: true }),
        Notification.countDocuments({
          userId: new Types.ObjectId(userId),
          read: false,
        }),
      ])

      return reply.send({
        notifications: notifications.map((n) => {
          const doc = n as typeof n & { id: string }
          return {
            id:        doc.id,
            type:      n.type,
            title:     n.title,
            body:      n.body,
            read:      n.read,
            linkPath:  n.linkPath,
            createdAt: n.createdAt,
          }
        }),
        unreadCount,
      })
    },
  )

  // ── PATCH /notifications/read-all ── Mark all notifications read ───────
  // IMPORTANT: registered BEFORE /:id to avoid Fastify routing ":id" capturing "read-all"
  fastify.patch(
    '/notifications/read-all',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: userId } = request.user as JwtPayload

      await Notification.updateMany(
        { userId: new Types.ObjectId(userId), read: false },
        { $set: { read: true } },
      )

      return reply.send({ ok: true })
    },
  )

  // ── PATCH /notifications/:id/read ── Mark single notification read ─────
  fastify.patch<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: userId } = request.user as JwtPayload
      const { id } = request.params

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid notification ID.' })
      }

      // Ownership enforced in the query — userId must match
      const notification = await Notification.findOneAndUpdate(
        { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
        { $set: { read: true } },
        { new: true },
      ).lean({ virtuals: true })

      if (!notification) {
        return reply.code(404).send({
          error:   'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found.',
        })
      }

      const doc = notification as typeof notification & { id: string }
      return reply.send({ id: doc.id, read: notification.read })
    },
  )

  // ── DELETE /notifications ── Bulk delete (Sprint 4 Story 20) ───────────
  // Optional `?status=read` narrows the scope to only read notifications,
  // which is what the NotificationsPage "Delete all read" CTA sends. When
  // the query is omitted we delete every notification the user owns — this
  // mirrors the semantics of Gmail's "delete all" trash action.
  //
  // IMPORTANT: registered BEFORE /:id so Fastify's path matcher doesn't try
  // to parse the collection-level DELETE as a notificationId.
  fastify.delete<{ Querystring: { status?: string } }>(
    '/notifications',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: userId } = request.user as JwtPayload
      const status = request.query.status

      const filter: { userId: Types.ObjectId; read?: boolean } = {
        userId: new Types.ObjectId(userId),
      }
      if (status === 'read') filter.read = true
      else if (status === 'unread') filter.read = false
      // Any other value (including undefined) → delete everything the user owns.

      const result = await Notification.deleteMany(filter)
      return reply.send({ ok: true, deletedCount: result.deletedCount ?? 0 })
    },
  )

  // ── DELETE /notifications/:id ── Delete a notification ─────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/notifications/:id',
    { preHandler: requireStudent },
    async (request, reply) => {
      const { sub: userId } = request.user as JwtPayload
      const { id } = request.params

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid notification ID.' })
      }

      // Ownership enforced in the query — userId must match
      const result = await Notification.findOneAndDelete({
        _id:    new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })

      if (!result) {
        return reply.code(404).send({
          error:   'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found.',
        })
      }

      return reply.send({ ok: true })
    },
  )
}
