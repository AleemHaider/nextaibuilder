// PBA-136 — MongoDB seed script (Mongoose)
// Run with: npm run db:seed
import { connectMongoDB, mongoose } from '../src/lib/mongodb.js'
import { User } from '../src/models/User.js'
import { Cohort } from '../src/models/Cohort.js'
import { CohortMembership } from '../src/models/CohortMembership.js'
import { SetupStep } from '../src/models/SetupStep.js'
import { CohortStep } from '../src/models/CohortStep.js'
import { StudentStep } from '../src/models/StudentStep.js'
import { Badge } from '../src/models/Badge.js'

async function main() {
  await connectMongoDB()
  console.log('Seeding database...')

  // ── Super Admin (seeded as Google OAuth user for dev/testing) ──────────────
  const admin = await User.findOneAndUpdate(
    { email: 'aleemhaider111@gmail.com' },
    {
      $set: { role: 'SUPER_ADMIN' },
      $setOnInsert: {
        email: 'aleemhaider111@gmail.com',
        firstName: 'Aleem',
        lastName: 'Haider',
        oauthProvider: 'google',
        oauthId: 'seed-admin-google-id',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  console.log(`Super admin: ${admin.email}`)

  // ── Demo Student ───────────────────────────────────────────────────────────
  const student = await User.findOneAndUpdate(
    { email: 'student@example.com' },
    {
      $setOnInsert: {
        email: 'student@example.com',
        firstName: 'Alex',
        lastName: 'Johnson',
        role: 'STUDENT',
        oauthProvider: 'google',
        oauthId: 'seed-student-google-id',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  console.log(`Demo student: ${student.email}`)

  // ── Setup Steps ────────────────────────────────────────────────────────────
  const stepsData = [
    {
      title: 'Set Up Your Business Email',
      order: 1,
      description:
        'Create a professional email address using your domain name. This is the email your clients will use to contact you.',
      screenshotCriteria:
        'Screenshot should show a Gmail or similar inbox with a custom domain email address (not @gmail.com). The email address in the top-right or settings should show the custom domain.',
    },
    {
      title: 'Create Your Business Website',
      order: 2,
      description:
        'Set up a basic website that explains who you are and what services you offer. This can be a simple one-page site.',
      screenshotCriteria:
        'Screenshot should show a live website URL (https://) in the browser bar. The page should display a business name, brief description, and contact information.',
    },
    {
      title: 'Set Up Your CRM',
      order: 3,
      description:
        'Choose and configure a CRM (Customer Relationship Management) tool to track your leads and client interactions.',
      screenshotCriteria:
        'Screenshot should show a CRM dashboard (HubSpot, Salesforce, Pipedrive, or similar). A contacts section should be visible.',
    },
    {
      title: 'Configure Payment Processing',
      order: 4,
      description:
        'Set up Stripe or PayPal to accept payments from clients. Complete onboarding and add a test payment method.',
      screenshotCriteria:
        'Screenshot should show a Stripe dashboard with the account name visible and the "Payments" or "Dashboard" section active. The account status should show "Activated" or similar.',
    },
    {
      title: 'Create Your Social Media Profiles',
      order: 5,
      description:
        'Set up LinkedIn and one other relevant social media profile for your business. Ensure your profile photo and bio are complete.',
      screenshotCriteria:
        'Screenshot should show a completed LinkedIn business profile with a profile photo, headline, and at least one connection.',
    },
  ]

  const steps: Array<{ _id: unknown }> = []
  for (const stepData of stepsData) {
    const step = await SetupStep.findOneAndUpdate(
      { order: stepData.order },
      { $set: { ...stepData, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    steps.push(step)
    console.log(`Step ${stepData.order}: ${stepData.title}`)
  }

  // ── Cohort ─────────────────────────────────────────────────────────────────
  const cohort = await Cohort.findOneAndUpdate(
    { code: 'PBA-2024-Q1' },
    {
      $setOnInsert: {
        code: 'PBA-2024-Q1',
        name: 'Q1 2024 Cohort',
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-06-30'),
        status: 'ACTIVE',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  console.log(`Cohort: ${cohort.name} (${cohort.code})`)

  // ── CohortSteps ────────────────────────────────────────────────────────────
  for (let i = 0; i < steps.length; i++) {
    await CohortStep.findOneAndUpdate(
      { cohortId: cohort._id, stepId: steps[i]._id },
      { $setOnInsert: { cohortId: cohort._id, stepId: steps[i]._id, order: i + 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  }
  console.log(`Linked ${steps.length} steps to cohort`)

  // ── Enrol demo student ─────────────────────────────────────────────────────
  await CohortMembership.findOneAndUpdate(
    { userId: student._id, cohortId: cohort._id },
    { $setOnInsert: { userId: student._id, cohortId: cohort._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  console.log(`Enrolled ${student.email} in ${cohort.name}`)

  // ── Student steps (first step unlocked) ───────────────────────────────────
  for (let i = 0; i < steps.length; i++) {
    await StudentStep.findOneAndUpdate(
      { userId: student._id, stepId: steps[i]._id },
      {
        $setOnInsert: {
          userId: student._id,
          stepId: steps[i]._id,
          status: i === 0 ? 'IN_PROGRESS' : 'LOCKED',
          unlockedAt: i === 0 ? new Date() : null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  }
  console.log('Student steps initialized (Step 1 unlocked)')

  // ── Badges ─────────────────────────────────────────────────────────────────
  const badgesData = [
    {
      name: 'First Step',
      description: 'Completed your first setup step',
      iconUrl: '/badges/first-step.svg',
      triggerCriteria: 'steps_completed:1',
    },
    {
      name: 'Halfway There',
      description: 'Completed 50% of setup steps',
      iconUrl: '/badges/halfway.svg',
      triggerCriteria: 'steps_completed:3',
    },
    {
      name: 'Setup Complete',
      description: 'Completed all setup steps',
      iconUrl: '/badges/complete.svg',
      triggerCriteria: 'steps_completed:5',
    },
  ]

  for (const badge of badgesData) {
    await Badge.findOneAndUpdate(
      { name: badge.name },
      { $set: badge },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    console.log(`Badge: ${badge.name}`)
  }

  console.log('\nSeed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
