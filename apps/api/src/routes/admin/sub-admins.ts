// PBA-220 — Sub-Admin CRUD API
// PBA-229: GET /api/admin/sub-admins          — paginated list with search
// PBA-229: GET /api/admin/sub-admins/:id      — single sub-admin detail
// PBA-230: POST /api/admin/sub-admins         — create sub-admin (ADMIN or SUPER_ADMIN)
// PBA-231: PATCH /api/admin/sub-admins/:id    — update name / permissions
// PBA-232: PATCH /api/admin/sub-admins/:id/deactivate  — deactivate
// PBA-232: PATCH /api/admin/sub-admins/:id/reactivate  — reactivate
// PBA-265: expose inviteStatus / inviteAcceptedAt on all responses
// PBA-266: POST /api/admin/sub-admins/:id/reinvite

import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { z } from 'zod'
import { Types } from 'mongoose'
import { requireSuperAdmin } from '../../middleware/require-super-admin.js'
import type { JwtPayload } from '../../middleware/authenticate.js'
import { User } from '../../models/User.js'
import { SubAdminPermission } from '../../models/SubAdminPermission.js'
import { AuditLog } from '../../models/AuditLog.js'
import { PERMISSIONS } from '../../lib/permissions.js'
import type { Permission } from '../../lib/permissions.js'
import { sendEmail, adminSetPasswordTemplate } from '../../lib/email.js'

// ── Validation schemas ──────────────────────────────────────────────────────

const permissionsSchema = z
  .array(z.enum(PERMISSIONS as unknown as [string, ...string[]]))
  .default([])

const listQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  q:        z.string().trim().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'true')  return true
      if (v === 'false') return false
      return undefined
    }),
})

const createSubAdminSchema = z.object({
  firstName:         z.string().min(1).max(100).trim(),
  lastName:          z.string().min(1).max(100).trim(),
  email:             z.string().email().trim().toLowerCase(),
  role:              z.enum(['ADMIN', 'SUPER_ADMIN']).default('ADMIN'),
  permissions:       permissionsSchema,
  // PBA-321 — support agent fields
  takesStudentCalls: z.boolean().default(false),
  schedulingUrl:     z.string().url().nullable().optional().default(null),
})

const updateSubAdminSchema = z
  .object({
    firstName:           z.string().min(1).max(100).trim().optional(),
    lastName:            z.string().min(1).max(100).trim().optional(),
    permissions:         permissionsSchema.optional(),
    // PBA-321 — support agent fields (super-admin only)
    takesStudentCalls:   z.boolean().optional(),
    schedulingUrl:       z.string().url().nullable().optional(),
    isAvailableForCalls: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.firstName !== undefined ||
      data.lastName  !== undefined ||
      data.permissions !== undefined ||
      data.takesStudentCalls !== undefined ||
      data.schedulingUrl !== undefined ||
      data.isAvailableForCalls !== undefined,
    { message: 'At least one field is required.' },
  )

type ListQuery           = z.infer<typeof listQuerySchema>
type CreateSubAdminBody  = z.infer<typeof createSubAdminSchema>
type UpdateSubAdminBody  = z.infer<typeof updateSubAdminSchema>

// ── Helpers ─────────────────────────────────────────────────────────────────

function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

/**
 * Merge a User lean doc with its SubAdminPermission doc into the standard
 * SubAdmin response shape.
 */
function formatSubAdmin(
  user: {
    _id: Types.ObjectId
    email: string
    firstName: string
    lastName: string
    avatarUrl: string | null
    isActive: boolean
    createdAt: Date
    role?: string
    inviteStatus: 'PENDING' | 'ACCEPTED'
    inviteAcceptedAt: Date | null
    // PBA-321 — agent fields
    takesStudentCalls?: boolean
    schedulingUrl?: string | null
    isAvailableForCalls?: boolean
  },
  permissions: Permission[],
) {
  return {
    id:                  user._id.toString(),
    email:               user.email,
    firstName:           user.firstName,
    lastName:            user.lastName,
    avatarUrl:           user.avatarUrl,
    isActive:            user.isActive,
    role:                (user.role ?? 'ADMIN') as 'ADMIN' | 'SUPER_ADMIN',
    createdAt:           user.createdAt,
    inviteStatus:        user.inviteStatus,
    inviteAcceptedAt:    user.inviteAcceptedAt,
    permissions,
    // PBA-321 — agent fields
    takesStudentCalls:   user.takesStudentCalls ?? false,
    schedulingUrl:       user.schedulingUrl ?? null,
    isAvailableForCalls: user.isAvailableForCalls ?? true,
  }
}

// ── Route plugin ─────────────────────────────────────────────────────────────

export async function adminSubAdminsRoutes(fastify: FastifyInstance) {

  // ── GET / ── Paginated list ───────────────────────────────────────────────
  fastify.get<{ Querystring: ListQuery }>(
    '/',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const parseResult = listQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_QUERY',
          message: 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { page, limit, q, isActive } = parseResult.data

      // Build User filter — list ADMIN and SUPER_ADMIN users
      const userFilter: Record<string, unknown> = { role: { $in: ['ADMIN', 'SUPER_ADMIN'] } }

      if (isActive !== undefined) {
        userFilter['isActive'] = isActive
      }

      if (q) {
        const regex = new RegExp(q, 'i')
        userFilter['$or'] = [
          { firstName: regex },
          { lastName:  regex },
          { email:     regex },
        ]
      }

      const skip  = (page - 1) * limit
      const total = await User.countDocuments(userFilter)

      const users = await User.find(
        userFilter,
        { firstName: 1, lastName: 1, email: 1, avatarUrl: 1, isActive: 1, role: 1, createdAt: 1, inviteStatus: 1, inviteAcceptedAt: 1, takesStudentCalls: 1, schedulingUrl: 1, isAvailableForCalls: 1 },
      )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<Array<{
          _id: Types.ObjectId
          email: string
          firstName: string
          lastName: string
          avatarUrl: string | null
          isActive: boolean
          role: string
          createdAt: Date
          inviteStatus: 'PENDING' | 'ACCEPTED'
          inviteAcceptedAt: Date | null
          takesStudentCalls?: boolean
          schedulingUrl?: string | null
          isAvailableForCalls?: boolean
        }>>()

      let subAdmins: ReturnType<typeof formatSubAdmin>[] = []

      if (users.length > 0) {
        const userIds = users.map((u) => u._id)

        const permDocs = await SubAdminPermission.find(
          { userId: { $in: userIds } },
          { userId: 1, permissions: 1 },
        ).lean<Array<{ userId: Types.ObjectId; permissions: Permission[] }>>()

        const permMap = new Map(
          permDocs.map((p) => [p.userId.toString(), p.permissions]),
        )

        subAdmins = users.map((u) =>
          formatSubAdmin(u, permMap.get(u._id.toString()) ?? []),
        )
      }

      return reply.send({
        subAdmins,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    },
  )

  // ── GET /:id ── Single sub-admin detail ───────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid sub-admin ID.' })
      }

      const user = await User.findOne(
        { _id: id, role: { $in: ['ADMIN', 'SUPER_ADMIN'] } },
        { firstName: 1, lastName: 1, email: 1, avatarUrl: 1, isActive: 1, role: 1, createdAt: 1, inviteStatus: 1, inviteAcceptedAt: 1, takesStudentCalls: 1, schedulingUrl: 1, isAvailableForCalls: 1 },
      ).lean<{
        _id: Types.ObjectId
        email: string
        firstName: string
        lastName: string
        avatarUrl: string | null
        isActive: boolean
        role: string
        createdAt: Date
        inviteStatus: 'PENDING' | 'ACCEPTED'
        inviteAcceptedAt: Date | null
        takesStudentCalls?: boolean
        schedulingUrl?: string | null
        isAvailableForCalls?: boolean
      }>()

      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Sub-admin not found.' })
      }

      const permDoc = await SubAdminPermission.findOne(
        { userId: id },
        { permissions: 1 },
      ).lean<{ permissions: Permission[] }>()

      return reply.send({
        subAdmin: formatSubAdmin(user, permDoc?.permissions ?? []),
      })
    },
  )

  // ── POST / ── Create sub-admin ────────────────────────────────────────────
  fastify.post<{ Body: CreateSubAdminBody }>(
    '/',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const parseResult = createSubAdminSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const { firstName, lastName, email, role, permissions, takesStudentCalls, schedulingUrl } = parseResult.data

      // Email conflict check
      const existing = await User.findOne({ email }).lean()
      if (existing) {
        return reply.code(409).send({
          error:   'EMAIL_CONFLICT',
          message: `A user with email "${email}" already exists.`,
        })
      }

      const caller = request.user as JwtPayload

      // PBA-251: generate a set-password invite token (64-char hex, 24h TTL)
      const passwordSetToken  = crypto.randomBytes(32).toString('hex')
      const passwordSetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const newUser = await User.create({
        firstName,
        lastName,
        email,
        role,
        isActive:          true,
        passwordSetToken,
        passwordSetExpiry,
        // PBA-321 — agent fields
        takesStudentCalls: takesStudentCalls ?? false,
        schedulingUrl:     schedulingUrl ?? null,
        isAvailableForCalls: true,
      })

      const userId = (newUser._id as Types.ObjectId)

      // PBA-251: fire-and-forget invite email with set-password link
      const frontendUrl    = process.env.FRONTEND_URL ?? 'http://localhost:5173'
      const setPasswordUrl = `${frontendUrl}/admin/set-password?token=${passwordSetToken}`
      sendEmail(
        newUser.email,
        'Set your admin password',
        adminSetPasswordTemplate(newUser.firstName, setPasswordUrl),
      ).catch((err: unknown) => fastify.log.error(err, '[admin/sub-admins] Failed to send invite email'))

      // Only ADMIN users have scoped permissions — SUPER_ADMIN bypasses the permission table
      const grantedPermissions = role === 'SUPER_ADMIN' ? [] : permissions as Permission[]
      if (role === 'ADMIN') {
        await SubAdminPermission.create({
          userId,
          permissions,
          grantedBy: new Types.ObjectId(caller.sub),
        })
      }

      // Audit log
      await AuditLog.create({
        adminId:    new Types.ObjectId(caller.sub),
        action:     role === 'SUPER_ADMIN' ? 'SUPER_ADMIN_CREATED' : 'SUB_ADMIN_CREATED',
        targetType: 'User',
        targetId:   userId.toString(),
        note:       null,
        metadata:   null,
      })

      fastify.log.info(`[admin] Created ${role} userId=${userId} by adminId=${caller.sub}`)

      return reply.code(201).send({
        subAdmin: formatSubAdmin(
          {
            _id:                 userId,
            email:               newUser.email,
            firstName:           newUser.firstName,
            lastName:            newUser.lastName,
            avatarUrl:           newUser.avatarUrl,
            isActive:            newUser.isActive,
            role,
            createdAt:           newUser.createdAt,
            inviteStatus:        (newUser.inviteStatus as 'PENDING' | 'ACCEPTED') ?? 'PENDING',
            inviteAcceptedAt:    (newUser.inviteAcceptedAt as Date | null) ?? null,
            takesStudentCalls:   newUser.takesStudentCalls,
            schedulingUrl:       newUser.schedulingUrl,
            isAvailableForCalls: newUser.isAvailableForCalls,
          },
          grantedPermissions,
        ),
      })
    },
  )

  // ── PATCH /:id ── Update name / permissions ───────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: UpdateSubAdminBody }>(
    '/:id',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid sub-admin ID.' })
      }

      const parseResult = updateSubAdminSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.code(400).send({
          error:   'INVALID_BODY',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        })
      }

      const updates = parseResult.data

      const user = await User.findById(id).lean<{
        _id: Types.ObjectId
        email: string
        firstName: string
        lastName: string
        avatarUrl: string | null
        isActive: boolean
        createdAt: Date
        role: string
        inviteStatus: 'PENDING' | 'ACCEPTED'
        inviteAcceptedAt: Date | null
        takesStudentCalls?: boolean
        schedulingUrl?: string | null
        isAvailableForCalls?: boolean
      }>()

      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Sub-admin not found.' })
      }

      if (user.role === 'SUPER_ADMIN' || user.role === 'STUDENT') {
        return reply.code(400).send({
          error:   'INVALID_TARGET',
          message: 'Cannot update a SUPER_ADMIN or STUDENT account via this endpoint.',
        })
      }

      const caller = request.user as JwtPayload

      // Apply name + agent field updates
      const userPatch: Record<string, unknown> = {}
      if (updates.firstName !== undefined)           userPatch['firstName']           = updates.firstName
      if (updates.lastName  !== undefined)           userPatch['lastName']            = updates.lastName
      if (updates.takesStudentCalls !== undefined)   userPatch['takesStudentCalls']   = updates.takesStudentCalls
      if (updates.schedulingUrl !== undefined)       userPatch['schedulingUrl']       = updates.schedulingUrl
      if (updates.isAvailableForCalls !== undefined) userPatch['isAvailableForCalls'] = updates.isAvailableForCalls

      let updatedUser = user
      if (Object.keys(userPatch).length > 0) {
        const result = await User.findByIdAndUpdate(
          id,
          { $set: userPatch },
          { new: true },
        ).lean<{
          _id: Types.ObjectId
          email: string
          firstName: string
          lastName: string
          avatarUrl: string | null
          isActive: boolean
          createdAt: Date
          role: string
          inviteStatus: 'PENDING' | 'ACCEPTED'
          inviteAcceptedAt: Date | null
          takesStudentCalls?: boolean
          schedulingUrl?: string | null
          isAvailableForCalls?: boolean
        }>()
        if (result) updatedUser = result
      }

      // Apply permissions update
      let finalPermissions: Permission[]

      if (updates.permissions !== undefined) {
        // Fetch previous permissions for audit log
        const prevDoc = await SubAdminPermission.findOne(
          { userId: id },
          { permissions: 1 },
        ).lean<{ permissions: Permission[] }>()

        const previousPermissions = prevDoc?.permissions ?? []
        const newPermissions      = updates.permissions as Permission[]

        await SubAdminPermission.findOneAndUpdate(
          { userId: new Types.ObjectId(id) },
          {
            $set: {
              permissions: newPermissions,
              grantedBy:   new Types.ObjectId(caller.sub),
            },
          },
          { upsert: true, new: true },
        )

        await AuditLog.create({
          adminId:    new Types.ObjectId(caller.sub),
          action:     'SUB_ADMIN_PERMISSIONS_UPDATED',
          targetType: 'User',
          targetId:   id,
          note:       null,
          metadata:   { previousPermissions, newPermissions },
        })

        fastify.log.info(
          `[admin] Updated permissions for userId=${id} by adminId=${caller.sub}`,
        )

        finalPermissions = newPermissions
      } else {
        const permDoc = await SubAdminPermission.findOne(
          { userId: id },
          { permissions: 1 },
        ).lean<{ permissions: Permission[] }>()
        finalPermissions = permDoc?.permissions ?? []
      }

      return reply.send({
        subAdmin: formatSubAdmin(
          {
            _id:              updatedUser._id,
            email:            updatedUser.email,
            firstName:        updatedUser.firstName,
            lastName:         updatedUser.lastName,
            avatarUrl:        updatedUser.avatarUrl,
            isActive:         updatedUser.isActive,
            createdAt:        updatedUser.createdAt,
            inviteStatus:     updatedUser.inviteStatus,
            inviteAcceptedAt: updatedUser.inviteAcceptedAt,
          },
          finalPermissions,
        ),
      })
    },
  )

  // ── PATCH /:id/deactivate ── Deactivate sub-admin ─────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/:id/deactivate',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid sub-admin ID.' })
      }

      const user = await User.findById(id).lean<{
        _id: Types.ObjectId
        email: string
        firstName: string
        lastName: string
        avatarUrl: string | null
        isActive: boolean
        createdAt: Date
        role: string
        inviteStatus: 'PENDING' | 'ACCEPTED'
        inviteAcceptedAt: Date | null
      }>()

      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Sub-admin not found.' })
      }

      if (user.role === 'SUPER_ADMIN') {
        return reply.code(400).send({
          error:   'INVALID_TARGET',
          message: 'Cannot deactivate a SUPER_ADMIN account.',
        })
      }

      if (!user.isActive) {
        return reply.code(409).send({
          error:   'ALREADY_DEACTIVATED',
          message: 'Sub-admin is already deactivated.',
        })
      }

      await User.findByIdAndUpdate(id, { $set: { isActive: false } })

      const caller = request.user as JwtPayload

      await AuditLog.create({
        adminId:    new Types.ObjectId(caller.sub),
        action:     'SUB_ADMIN_DEACTIVATED',
        targetType: 'User',
        targetId:   id,
        note:       null,
        metadata:   null,
      })

      fastify.log.info(`[admin] Deactivated sub-admin userId=${id} by adminId=${caller.sub}`)

      const permDoc = await SubAdminPermission.findOne(
        { userId: id },
        { permissions: 1 },
      ).lean<{ permissions: Permission[] }>()

      return reply.send({
        subAdmin: formatSubAdmin(
          { ...user, isActive: false },
          permDoc?.permissions ?? [],
        ),
      })
    },
  )

  // ── PATCH /:id/reactivate ── Reactivate sub-admin ─────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/:id/reactivate',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid sub-admin ID.' })
      }

      const user = await User.findById(id).lean<{
        _id: Types.ObjectId
        email: string
        firstName: string
        lastName: string
        avatarUrl: string | null
        isActive: boolean
        createdAt: Date
        role: string
        inviteStatus: 'PENDING' | 'ACCEPTED'
        inviteAcceptedAt: Date | null
      }>()

      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Sub-admin not found.' })
      }

      if (user.role === 'SUPER_ADMIN') {
        return reply.code(400).send({
          error:   'INVALID_TARGET',
          message: 'Cannot reactivate a SUPER_ADMIN account.',
        })
      }

      await User.findByIdAndUpdate(id, { $set: { isActive: true } })

      const caller = request.user as JwtPayload

      await AuditLog.create({
        adminId:    new Types.ObjectId(caller.sub),
        action:     'SUB_ADMIN_REACTIVATED',
        targetType: 'User',
        targetId:   id,
        note:       null,
        metadata:   null,
      })

      fastify.log.info(`[admin] Reactivated sub-admin userId=${id} by adminId=${caller.sub}`)

      const permDoc = await SubAdminPermission.findOne(
        { userId: id },
        { permissions: 1 },
      ).lean<{ permissions: Permission[] }>()

      return reply.send({
        subAdmin: formatSubAdmin(
          { ...user, isActive: true },
          permDoc?.permissions ?? [],
        ),
      })
    },
  )

  // ── POST /:id/reinvite ── Re-send invite email ─────────────────────────────
  // PBA-266
  fastify.post<{ Params: { id: string } }>(
    '/:id/reinvite',
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const { id } = request.params

      if (!isValidObjectId(id)) {
        return reply.code(400).send({ error: 'INVALID_ID', message: 'Invalid sub-admin ID.' })
      }

      const user = await User.findOne(
        { _id: id, role: { $in: ['ADMIN', 'SUPER_ADMIN'] } },
        {
          firstName: 1, lastName: 1, email: 1, avatarUrl: 1,
          isActive: 1, role: 1, createdAt: 1, inviteStatus: 1, inviteAcceptedAt: 1,
        },
      ).lean<{
        _id: Types.ObjectId
        email: string
        firstName: string
        lastName: string
        avatarUrl: string | null
        isActive: boolean
        role: string
        createdAt: Date
        inviteStatus: 'PENDING' | 'ACCEPTED'
        inviteAcceptedAt: Date | null
      }>()

      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Sub-admin not found.' })
      }

      if (!user.isActive) {
        return reply.code(409).send({
          error:   'ACCOUNT_INACTIVE',
          message: 'Reactivate this sub-admin before re-inviting.',
        })
      }

      if (user.inviteStatus === 'ACCEPTED') {
        return reply.code(409).send({
          error:   'INVITE_ALREADY_ACCEPTED',
          message: 'This sub-admin has already accepted their invitation.',
        })
      }

      const passwordSetToken  = crypto.randomBytes(32).toString('hex')
      const passwordSetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await User.findByIdAndUpdate(id, {
        $set: {
          passwordSetToken,
          passwordSetExpiry,
          inviteStatus:     'PENDING',
          inviteAcceptedAt: null,
        },
      })

      const frontendUrl    = process.env.FRONTEND_URL ?? 'http://localhost:5173'
      const setPasswordUrl = `${frontendUrl}/admin/set-password?token=${passwordSetToken}`

      sendEmail(
        user.email,
        'Set your admin password',
        adminSetPasswordTemplate(user.firstName, setPasswordUrl),
      ).catch((err: unknown) =>
        fastify.log.error(err, '[admin/sub-admins] Failed to send reinvite email'),
      )

      const caller = request.user as JwtPayload

      await AuditLog.create({
        adminId:    new Types.ObjectId(caller.sub),
        action:     'SUB_ADMIN_REINVITED',
        targetType: 'User',
        targetId:   id,
        note:       null,
        metadata:   null,
      })

      fastify.log.info(`[admin] Reinvited sub-admin userId=${id} by adminId=${caller.sub}`)

      const permDoc = await SubAdminPermission.findOne(
        { userId: id },
        { permissions: 1 },
      ).lean<{ permissions: Permission[] }>()

      return reply.send({
        subAdmin: formatSubAdmin(
          {
            ...user,
            inviteStatus:     'PENDING',
            inviteAcceptedAt: null,
          },
          permDoc?.permissions ?? [],
        ),
      })
    },
  )
}
