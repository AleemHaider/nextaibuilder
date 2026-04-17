// PBA-134 — Email service: typed send functions with dedup, logging, and fire-and-forget safety
import { Types } from 'mongoose'
import { User } from '../models/User.js'
import { EmailLog, type EmailType } from '../models/EmailLog.js'
import {
  sendEmail,
  stepApprovedTemplate,
  stepRejectedTemplate,
  welcomeTemplate,
  nudgeTemplate,
  urgencyTemplate,
} from '../lib/email.js'

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Write an EmailLog entry and send the email.
 * Catches all errors — never throws, never blocks.
 */
async function deliver(
  userId: string,
  emailType: EmailType,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const log = await EmailLog.create({
    userId: new Types.ObjectId(userId),
    emailType,
    status: 'PENDING',
    sentAt: null,
  })

  try {
    await sendEmail(to, subject, html)
    log.status = 'SENT'
    log.sentAt = new Date()
    await log.save()
    console.info(`[EmailService] ${emailType} sent to ${to} (user=${userId})`)
  } catch (err) {
    log.status = 'FAILED'
    await log.save()
    console.error(`[EmailService] ${emailType} failed for user=${userId}:`, err)
  }
}

/**
 * Check whether an email of a given type was sent within the last `withinMs` milliseconds.
 */
async function sentWithin(
  userId: string,
  emailType: EmailType,
  withinMs: number,
): Promise<boolean> {
  const since = new Date(Date.now() - withinMs)
  const found = await EmailLog.findOne({
    userId: new Types.ObjectId(userId),
    emailType,
    status: 'SENT',
    sentAt: { $gte: since },
  }).lean()
  return found !== null
}

// ── Public send functions ──────────────────────────────────────────────────

/**
 * Notify a student that their step submission was approved.
 */
export async function sendStepApprovedEmail(
  userId: string,
  stepTitle: string,
): Promise<void> {
  const user = await User.findById(userId).lean()
  if (!user) {
    console.warn(`[EmailService] sendStepApprovedEmail: user ${userId} not found`)
    return
  }
  if (!user.notifications?.progressUpdates) {
    console.info(`[EmailService] STEP_APPROVED skipped: progressUpdates=false for user=${userId}`)
    return
  }
  const html = stepApprovedTemplate(user.firstName, stepTitle)
  await deliver(userId, 'STEP_APPROVED', user.email, `✓ Step approved: ${stepTitle}`, html)
}

/**
 * Notify a student that their step submission was rejected, with feedback.
 */
export async function sendStepRejectedEmail(
  userId: string,
  stepTitle: string,
  feedback: string,
): Promise<void> {
  const user = await User.findById(userId).lean()
  if (!user) {
    console.warn(`[EmailService] sendStepRejectedEmail: user ${userId} not found`)
    return
  }
  if (!user.notifications?.progressUpdates) {
    console.info(`[EmailService] STEP_REJECTED skipped: progressUpdates=false for user=${userId}`)
    return
  }
  const html = stepRejectedTemplate(user.firstName, stepTitle, feedback)
  await deliver(userId, 'STEP_REJECTED', user.email, `Revision needed: ${stepTitle}`, html)
}

/**
 * Send a welcome email to a newly registered student.
 * Skips if a WELCOME email has already been sent to this user.
 */
export async function sendWelcomeEmail(userId: string): Promise<void> {
  const alreadySent = await EmailLog.findOne({
    userId: new Types.ObjectId(userId),
    emailType: 'WELCOME',
    status: 'SENT',
  }).lean()

  if (alreadySent) {
    console.info(`[EmailService] WELCOME already sent to user=${userId}, skipping`)
    return
  }

  const user = await User.findById(userId).lean()
  if (!user) {
    console.warn(`[EmailService] sendWelcomeEmail: user ${userId} not found`)
    return
  }

  const html = welcomeTemplate(user.firstName)
  await deliver(userId, 'WELCOME', user.email, 'Welcome to Product Builder Academy!', html)
}

/**
 * Send a nudge email to an inactive student.
 * Skips if a NUDGE was already sent within the last 48 hours.
 */
export async function sendNudgeEmail(
  userId: string,
  daysSinceLastActive: number,
): Promise<void> {
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000
  if (await sentWithin(userId, 'NUDGE', FORTY_EIGHT_HOURS)) {
    console.info(`[EmailService] NUDGE already sent within 48h for user=${userId}, skipping`)
    return
  }

  const user = await User.findById(userId).lean()
  if (!user) {
    console.warn(`[EmailService] sendNudgeEmail: user ${userId} not found`)
    return
  }
  if (!user.notifications?.setupReminders) {
    console.info(`[EmailService] NUDGE skipped: setupReminders=false for user=${userId}`)
    return
  }

  const html = nudgeTemplate(user.firstName, daysSinceLastActive)
  await deliver(userId, 'NUDGE', user.email, "We miss you — jump back into your learning", html)
}

/**
 * Send an urgency email warning about an upcoming cohort deadline.
 * Skips if an URGENCY_REMINDER was already sent within the last 48 hours.
 */
export async function sendUrgencyEmail(userId: string, deadline: string): Promise<void> {
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000
  if (await sentWithin(userId, 'URGENCY_REMINDER', FORTY_EIGHT_HOURS)) {
    console.info(`[EmailService] URGENCY_REMINDER already sent within 48h for user=${userId}, skipping`)
    return
  }

  const user = await User.findById(userId).lean()
  if (!user) {
    console.warn(`[EmailService] sendUrgencyEmail: user ${userId} not found`)
    return
  }
  if (!user.notifications?.deadlineAlerts) {
    console.info(`[EmailService] URGENCY_REMINDER skipped: deadlineAlerts=false for user=${userId}`)
    return
  }

  const html = urgencyTemplate(user.firstName, deadline)
  await deliver(userId, 'URGENCY_REMINDER', user.email, 'Action required: your cohort deadline is approaching', html)
}
