// PBA-135 — Fastify API entry point
import { createServer } from 'node:http'
import Fastify from 'fastify'
import { sendSlackAlert } from './services/slack.js'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifySensible from '@fastify/sensible'
import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import fastifyJwt from '@fastify/jwt'
import { connectMongoDB } from './lib/mongodb.js'
import { checkEnv } from './lib/env-check.js'
import { authRoutes } from './routes/auth.js'
import { authAdminRoutes } from './routes/auth-admin.js'
import { authStudentRoutes } from './routes/auth-student.js'
import { oauthRoutes } from './routes/oauth.js'
import { dashboardRoutes } from './routes/student/dashboard.js'
import { stepsRoutes } from './routes/student/steps.js'
import { achievementsRoutes } from './routes/student/achievements.js'
import { studentProfileRoutes } from './routes/student/profile.js'
import { troubleshootRoutes } from './routes/student/troubleshoot.js'
import { certificateRoutes } from './routes/certificate.js'
import { adminSubmissionsRoutes } from './routes/admin/submissions.js'
import { adminDashboardRoutes } from './routes/admin/dashboard.js'
import { adminCohortsRoutes } from './routes/admin/cohorts.js'
import { adminStudentsRoutes } from './routes/admin/students.js'
import { adminReportsRoutes } from './routes/admin/reports.js'
import { adminMessagesRoutes } from './routes/admin/messages.js'
import { adminSettingsRoutes } from './routes/admin/settings.js'
import { adminStepsRoutes } from './routes/admin/steps.js'
import { adminStudentStepsRoutes } from './routes/admin/student-steps.js'
import { adminSubAdminsRoutes } from './routes/admin/sub-admins.js'
import { agentProfileRoutes } from './routes/admin/agent-profile.js'      // PBA-322
import { adminCallsRoutes } from './routes/admin/calls.js'                // PBA-323
import { studentAgentsRoutes } from './routes/student/agents.js'          // PBA-324/325
import { studentCallsRoutes } from './routes/student/calls.js'            // PBA-326/327
import { studentNotificationsRoutes } from './routes/student/notifications.js' // PBA-380
import { uploadsRoutes } from './routes/uploads.js'
import { storefrontRoutes } from './routes/storefront.js'   // FIR-31
import { checkoutRoutes, studentEnrollmentsRoutes } from './routes/student/checkout.js'  // FIR-39/40/41
import { stripeWebhookRoutes } from './routes/webhook-stripe.js'                          // FIR-42
import { studentManualPaymentRoutes } from './routes/student/manual-payment.js'           // FIR-46
import { adminManualPaymentsRoutes } from './routes/admin/manual-payments.js'             // FIR-47/48/49
import { studentLmsRoutes } from './routes/student/lms.js'                                // FIR-51–58
import { adminCoursesRoutes, adminEnrollmentsRoutes } from './routes/admin/courses.js'   // FIR-59–65/159/175
import { adminEnrollmentResetRoutes } from './routes/admin/enrollment-reset.js'          // FIR-168
import { adminAnalyticsRoutes } from './routes/admin/analytics.js'                       // FIR-76–79/174
import { firAdminStudentsRoutes } from './routes/admin/fir-students.js'                  // FIR-209–212
import { firAdminEnrollmentsRoutes } from './routes/admin/fir-enrollments.js'             // FIR-213/214/215
import { firAdminPaymentsRoutes } from './routes/admin/fir-payments.js'                   // FIR-216/217/218
import { initSocketIO } from './lib/socket.js'
import { securityPlugin } from './plugins/security.js'                                   // FIR-172
import { startScreenshotValidationWorker } from './workers/screenshotValidationWorker.js'
import { startScheduledEmailWorker } from './workers/scheduledEmailWorker.js'
import { startStripeWebhookWorker } from './workers/stripeWebhookWorker.js'               // FIR-43/44
import { startSlackInviteWorker } from './workers/slackInviteWorker.js'                  // FIR-66
import { startNotificationWorker } from './workers/notificationWorker.js'                // FIR-68–71
import { startReEngagementCron } from './jobs/reEngagementCron.js'                       // FIR-170

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
  // Use a custom http server so Socket.io can share the same port
  serverFactory: (handler) => {
    const httpServer = createServer(handler)
    initSocketIO(httpServer)
    return httpServer
  },
})

async function start() {
  // ── Env var validation (PBA-391) ──────────────────
  const envCheck = checkEnv()
  for (const w of envCheck.warnings) server.log.warn(`[env] ${w}`)
  for (const e of envCheck.errors) server.log.error(`[env] ${e}`)

  // ── Production secret guard ────────────────────────
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production') {
      throw new Error('JWT_SECRET must be set to a strong secret in production')
    }
    if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET === 'change-me-in-production') {
      throw new Error('COOKIE_SECRET must be set to a strong secret in production')
    }
  }

  // ── Database ───────────────────────────────────────
  await connectMongoDB()

  // ── Security headers plugin (FIR-172) ────────────
  await server.register(securityPlugin)

  // ── Security & utilities ──────────────────────────
  await server.register(fastifyHelmet, { contentSecurityPolicy: false })
  await server.register(fastifyRateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder(_req, context) {
      return {
        error: 'RATE_LIMITED',
        message: `Too many requests. Please wait ${context.after} before retrying.`,
      }
    },
  })
  await server.register(fastifySensible)
  await server.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET ?? 'change-me-in-production',
  })
  await server.register(fastifyMultipart, {
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB global cap
  })

  // ── CORS ──────────────────────────────────────────
  await server.register(fastifyCors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // ── JWT ───────────────────────────────────────────
  await server.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
  })

  // ── Slack error handler (5xx only) ───────────────
  server.setErrorHandler((err, request, reply) => {
    const e = err as { statusCode?: number; code?: string; message?: string; stack?: string }
    const statusCode = e.statusCode ?? 500
    if (statusCode >= 500) {
      void sendSlackAlert({
        severity: 'error',
        title: `HTTP ${statusCode} — ${request.method} ${request.url}`,
        message: e.message ?? 'Unknown error',
        stack: e.stack,
        context: `${request.method} ${request.url}`,
      })
    }
    void reply.code(statusCode).send({
      error: e.code ?? 'INTERNAL_SERVER_ERROR',
      message: statusCode >= 500 ? 'An internal error occurred.' : (e.message ?? 'Unknown error'),
    })
  })

  // ── Routes ────────────────────────────────────────
  await server.register(authRoutes, { prefix: '/api/auth' })
  await server.register(authAdminRoutes, { prefix: '/api/auth/admin' })  // PBA-254
  await server.register(authStudentRoutes, { prefix: '/api/auth/student' }) // PBA-281/286
  await server.register(oauthRoutes, { prefix: '/api/auth/oauth' })
  // Student routes (PBA-149)
  await server.register(dashboardRoutes, { prefix: '/api/student' })
  await server.register(stepsRoutes, { prefix: '/api/student' })
  await server.register(achievementsRoutes, { prefix: '/api/student' }) // PBA-128
  await server.register(studentProfileRoutes, { prefix: '/api/student' }) // PBA-315
  await server.register(troubleshootRoutes, { prefix: '/api/student' }) // PBA-316
  await server.register(certificateRoutes, { prefix: '/api/certificate' }) // PBA-314
  // Admin routes (PBA-130, PBA-131)
  await server.register(adminSubmissionsRoutes, { prefix: '/api/admin/submissions' })
  await server.register(adminDashboardRoutes, { prefix: '/api/admin' })
  await server.register(adminCohortsRoutes, { prefix: '/api/admin/cohorts' })
  await server.register(adminStudentsRoutes, { prefix: '/api/admin/students' })
  await server.register(adminReportsRoutes,  { prefix: '/api/admin/reports' })
  await server.register(adminMessagesRoutes, { prefix: '/api/admin/messages' })
  await server.register(adminSettingsRoutes,      { prefix: '/api/admin/settings' })
  await server.register(adminStepsRoutes,         { prefix: '/api/admin/steps' })
  await server.register(adminStudentStepsRoutes,  { prefix: '/api/admin/student-steps' })
  await server.register(adminSubAdminsRoutes,     { prefix: '/api/admin/sub-admins' })  // PBA-220
  await server.register(agentProfileRoutes,       { prefix: '/api/admin/profile' })    // PBA-322
  await server.register(adminCallsRoutes,         { prefix: '/api/admin' })            // PBA-323
  // Student agent + call routes (PBA-317)
  await server.register(studentAgentsRoutes,      { prefix: '/api/student' })          // PBA-324/325
  await server.register(studentCallsRoutes,       { prefix: '/api/student' })          // PBA-326/327
  await server.register(studentNotificationsRoutes, { prefix: '/api/student' })        // PBA-380

  // ── Storefront (public, no auth) ─────────────────
  await server.register(storefrontRoutes, { prefix: '/api/v1/storefront' }) // FIR-31

  // ── Stripe checkout routes (student-authenticated) ────────────────────
  await server.register(checkoutRoutes, { prefix: '/api/v1/student/checkout' })          // FIR-39/40
  await server.register(studentEnrollmentsRoutes, { prefix: '/api/v1/student' })         // FIR-41

  // ── Stripe webhook receiver (no auth — Stripe HMAC signed) ───────────
  await server.register(stripeWebhookRoutes, { prefix: '/api/v1/webhook' })               // FIR-42

  // ── Manual payment routes ─────────────────────────────────────────────
  await server.register(studentManualPaymentRoutes, { prefix: '/api/v1/student/manual-payment' }) // FIR-46
  await server.register(adminManualPaymentsRoutes, { prefix: '/api/v1/admin/manual-payments' })   // FIR-47/48/49

  // ── Student LMS routes (FIR-51–58) ───────────────────────────────────────
  await server.register(studentLmsRoutes, { prefix: '/api/v1/student' })                         // FIR-51–58

  // ── Admin CMS routes (FIR-59–65/159/175) ─────────────────────────────────
  await server.register(adminCoursesRoutes,         { prefix: '/api/v1/admin/courses' })             // FIR-59–65
  await server.register(adminEnrollmentsRoutes,     { prefix: '/api/v1/admin/enrollments' })         // FIR-159/175
  await server.register(adminEnrollmentResetRoutes, { prefix: '/api/v1/admin/enrollments' })         // FIR-168
  await server.register(adminAnalyticsRoutes,       { prefix: '/api/v1/admin/analytics' })           // FIR-76–79/174
  await server.register(firAdminStudentsRoutes,      { prefix: '/api/v1/admin/students' })             // FIR-209–212
  await server.register(firAdminEnrollmentsRoutes,  { prefix: '/api/v1/admin/enrollments-v2' })       // FIR-213/214/215
  await server.register(firAdminPaymentsRoutes,     { prefix: '/api/v1/admin/payments' })             // FIR-216/217/218

  // ── Local uploads (dev, when S3 not configured) ───
  await server.register(uploadsRoutes, { prefix: '/api/uploads' })

  // ── Health check ──────────────────────────────────
  // /health      — direct access (port 4000)
  // /api/health  — via nginx reverse proxy
  const healthHandler = async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
  server.get('/health', healthHandler)
  server.get('/api/health', healthHandler)

  // ── BullMQ Workers ────────────────────────────────
  if (process.env.NODE_ENV !== 'test') {
    void startScreenshotValidationWorker()    // PBA-150 / PBA-372 (async for startup health checks)
    startScheduledEmailWorker()               // PBA-134
    startStripeWebhookWorker()                // FIR-43/44
    startSlackInviteWorker()                  // FIR-66
    startNotificationWorker()                 // FIR-68–71
    startReEngagementCron()                   // FIR-170
  }

  // ── Start ─────────────────────────────────────────
  const port = Number(process.env.PORT ?? 4000)
  const host = process.env.HOST ?? '0.0.0.0'

  try {
    await server.listen({ port, host })
    server.log.info(`API running on http://${host}:${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()

// ── Process-level crash reporting ─────────────────
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  console.error('[process] unhandledRejection:', err)
  void sendSlackAlert({
    severity: 'fatal',
    title: 'Unhandled Promise Rejection',
    message: err.message,
    stack: err.stack,
    context: 'process.unhandledRejection',
  })
})

process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException:', err)
  void sendSlackAlert({
    severity: 'fatal',
    title: 'Uncaught Exception — Server Crashing',
    message: err.message,
    stack: err.stack,
    context: 'process.uncaughtException',
  })
  process.exit(1)
})
