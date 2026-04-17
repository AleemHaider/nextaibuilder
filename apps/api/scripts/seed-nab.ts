// NAB seed script — creates test admin + cohorts with payment plans and modules
// Run with: npx tsx --env-file=.env scripts/seed-nab.ts
import bcrypt from 'bcryptjs'
import { connectMongoDB, mongoose } from '../src/lib/mongodb.js'
import { User } from '../src/models/User.js'
import { Cohort } from '../src/models/Cohort.js'
import { PaymentPlan } from '../src/models/PaymentPlan.js'
import { Module } from '../src/models/Module.js'
import { Lesson } from '../src/models/Lesson.js'

async function main() {
  await connectMongoDB()
  console.log('Seeding NAB test data...')

  // ── Admin user (email/password login) ─────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin123', 12)
  const admin = await User.findOneAndUpdate(
    { email: 'admin@nextaibuilder.com' },
    {
      $set: {
        role: 'SUPER_ADMIN',
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
      },
      $setOnInsert: {
        email: 'admin@nextaibuilder.com',
        oauthProvider: 'local',
        oauthId: 'local-admin',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  console.log(`Admin: ${admin.email} / Admin123`)

  // ── Cohort 1: Claude API Mastery (Recorded) ────────────────────────────────
  const cohort1 = await Cohort.findOneAndUpdate(
    { slug: 'claude-api-mastery' },
    {
      $set: {
        name: 'Claude API Mastery',
        slug: 'claude-api-mastery',
        code: 'CLAUDE-API-001',
        tagline: "Build production AI apps with Anthropic's API",
        description:
          'Master the Claude API from prompt engineering to production deployment. Build real AI applications, handle streaming responses, and ship with confidence.',
        type: 'recorded',
        isPublished: true,
        enrollmentCount: 47,
        maxSeats: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const plan1_oneTime = await PaymentPlan.findOneAndUpdate(
    { cohortId: cohort1._id, type: 'ONE_TIME' },
    {
      $set: {
        cohortId: cohort1._id,
        name: 'Full Access',
        type: 'ONE_TIME',
        totalAmount: 499,
        currency: 'usd',
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const plan1_installment = await PaymentPlan.findOneAndUpdate(
    { cohortId: cohort1._id, type: 'INSTALLMENT' },
    {
      $set: {
        cohortId: cohort1._id,
        name: '3-Month Plan',
        type: 'INSTALLMENT',
        totalAmount: 498,
        currency: 'usd',
        isActive: true,
        intervalDays: 30,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  await Cohort.findByIdAndUpdate(cohort1._id, {
    $set: { paymentPlanIds: [plan1_oneTime._id, plan1_installment._id] },
  })

  // Modules for cohort 1
  const module1Titles = [
    'Getting Started with Claude API',
    'Prompt Engineering Fundamentals',
    'Streaming & Tool Use',
    'Building Production Applications',
    'Advanced Patterns & Deployment',
  ]

  for (let i = 0; i < module1Titles.length; i++) {
    const mod = await Module.findOneAndUpdate(
      { cohortId: cohort1._id, order: i },
      {
        $set: {
          cohortId: cohort1._id,
          title: module1Titles[i],
          order: i,
          isPublished: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    // 4-5 lessons per module
    const lessonCount = i < 4 ? 5 : 4
    for (let j = 0; j < lessonCount; j++) {
      await Lesson.findOneAndUpdate(
        { moduleId: mod._id, order: j },
        {
          $set: {
            moduleId: mod._id,
            cohortId: cohort1._id,
            title: `Lesson ${j + 1}`,
            type: 'VIDEO',
            order: j,
            isPublished: true,
            estimatedMinutes: 15,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    }
  }

  console.log(`Cohort 1: ${cohort1.name} ✓`)

  // ── Cohort 2: AI Product Bootcamp (Live) ───────────────────────────────────
  const cohort2 = await Cohort.findOneAndUpdate(
    { slug: 'ai-product-bootcamp' },
    {
      $set: {
        name: 'AI Product Bootcamp',
        slug: 'ai-product-bootcamp',
        code: 'AI-BOOT-001',
        tagline: 'Ship your first AI product in 8 weeks',
        description:
          'An intensive live cohort where you ship a real AI product from idea to production. Weekly live sessions, peer reviews, and direct instructor access.',
        type: 'live',
        isPublished: true,
        liveStartDate: new Date('2025-02-10'),
        liveEndDate: new Date('2025-04-07'),
        enrollmentCount: 8,
        maxSeats: 12,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const plan2_oneTime = await PaymentPlan.findOneAndUpdate(
    { cohortId: cohort2._id, type: 'ONE_TIME' },
    {
      $set: {
        cohortId: cohort2._id,
        name: 'Full Access',
        type: 'ONE_TIME',
        totalAmount: 999,
        currency: 'usd',
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const plan2_installment = await PaymentPlan.findOneAndUpdate(
    { cohortId: cohort2._id, type: 'INSTALLMENT' },
    {
      $set: {
        cohortId: cohort2._id,
        name: '3-Month Plan',
        type: 'INSTALLMENT',
        totalAmount: 999,
        currency: 'usd',
        isActive: true,
        intervalDays: 30,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  await Cohort.findByIdAndUpdate(cohort2._id, {
    $set: { paymentPlanIds: [plan2_oneTime._id, plan2_installment._id] },
  })

  // Modules for cohort 2
  const module2Titles = [
    'Week 1–2: Ideation & Scoping',
    'Week 3–4: Building Your MVP',
    'Week 5–6: Integration & Testing',
    'Week 7–8: Launch & Iteration',
  ]

  for (let i = 0; i < module2Titles.length; i++) {
    const mod = await Module.findOneAndUpdate(
      { cohortId: cohort2._id, order: i },
      {
        $set: {
          cohortId: cohort2._id,
          title: module2Titles[i],
          order: i,
          isPublished: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    for (let j = 0; j < 3; j++) {
      await Lesson.findOneAndUpdate(
        { moduleId: mod._id, order: j },
        {
          $set: {
            moduleId: mod._id,
            cohortId: cohort2._id,
            title: `Session ${j + 1}`,
            type: 'VIDEO',
            order: j,
            isPublished: true,
            estimatedMinutes: 90,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    }
  }

  console.log(`Cohort 2: ${cohort2.name} ✓`)

  // ── Cohort 3: Full-Stack AI Dev (Combined) ─────────────────────────────────
  const cohort3 = await Cohort.findOneAndUpdate(
    { slug: 'full-stack-ai-dev' },
    {
      $set: {
        name: 'Full-Stack AI Dev',
        slug: 'full-stack-ai-dev',
        code: 'FSAI-DEV-001',
        tagline: 'End-to-end AI engineering from prompt to prod',
        description:
          'The complete AI engineer path — recorded lessons plus live sessions at key milestones. Build, integrate, and deploy AI-powered full-stack applications.',
        type: 'combined',
        isPublished: true,
        liveStartDate: new Date('2025-03-03'),
        liveEndDate: new Date('2025-05-26'),
        enrollmentCount: 3,
        maxSeats: 8,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const plan3_oneTime = await PaymentPlan.findOneAndUpdate(
    { cohortId: cohort3._id, type: 'ONE_TIME' },
    {
      $set: {
        cohortId: cohort3._id,
        name: 'Full Access',
        type: 'ONE_TIME',
        totalAmount: 1499,
        currency: 'usd',
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const plan3_installment = await PaymentPlan.findOneAndUpdate(
    { cohortId: cohort3._id, type: 'INSTALLMENT' },
    {
      $set: {
        cohortId: cohort3._id,
        name: '3-Month Plan',
        type: 'INSTALLMENT',
        totalAmount: 1497,
        currency: 'usd',
        isActive: true,
        intervalDays: 30,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  await Cohort.findByIdAndUpdate(cohort3._id, {
    $set: { paymentPlanIds: [plan3_oneTime._id, plan3_installment._id] },
  })

  console.log(`Cohort 3: ${cohort3.name} ✓`)

  await mongoose.disconnect()
  console.log('\nDone! Test data seeded successfully.')
  console.log('Admin login: admin@nextaibuilder.com / Admin123')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
