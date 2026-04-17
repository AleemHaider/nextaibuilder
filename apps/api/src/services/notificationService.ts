// PBA-379 — Notification service: create and emit in-app notifications
import { Types } from 'mongoose'
import { Notification, type NotificationType } from '../models/Notification.js'
import { getIO } from '../lib/socket.js'

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  /** Optional client-side route to navigate to on click */
  linkPath?: string | null
}

/**
 * Persist a notification document and emit a real-time socket event to the
 * student's private room. Never throws — all errors are caught and logged.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const { userId, type, title, body, linkPath = null } = params

    const notification = await Notification.create({
      userId:   new Types.ObjectId(userId),
      type,
      title,
      body,
      read:     false,
      linkPath,
    })

    // Emit to the student's private socket room (best-effort — socket may not be ready)
    try {
      getIO()
        .to(`student:${userId}`)
        .emit('notification:new', {
          id:       notification.id as string,
          type:     notification.type,
          title:    notification.title,
          body:     notification.body,
          linkPath: notification.linkPath,
          read:     notification.read,
          createdAt: notification.createdAt,
        })
    } catch {
      // Socket.io not initialised (e.g. in test environment) — non-fatal
    }

    console.info(`[NotificationService] ${type} notification created for user=${userId}`)
  } catch (err) {
    console.error('[NotificationService] createNotification failed:', err)
  }
}
