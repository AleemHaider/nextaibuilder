/**
 * Migration: insert "Create Confluence Space" as Step 6
 *
 * Shifts all steps with order >= 6 up by 1, then inserts the
 * Confluence step at position 6.
 *
 * Run:
 *   npx tsx scripts/insert-confluence-step.ts up
 */

import 'dotenv/config'
import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGODB_URI ?? ''

if (!MONGO_URI) {
  console.error('MONGODB_URI environment variable is not set')
  process.exit(1)
}

const CONFLUENCE_STEP = {
  order: 6,
  title: 'Create Your Confluence Space',
  description: `## Why Confluence?

Confluence is Atlassian's team wiki and documentation platform. It works hand-in-hand with Jira to give your product team a single place to write specs, decisions, meeting notes, and knowledge-base articles.

## Step 1: Sign In to Confluence

1. Go to [atlassian.com](https://www.atlassian.com) and sign in with the same account you used to create your Jira project in the previous step.
2. From the Atlassian home screen, click **Confluence** in the product switcher.

## Step 2: Create Your First Space

1. In Confluence, click **Create Space** from the left sidebar.
2. Choose **Blank space** as the template.
3. Give your space a name that matches your Jira project (e.g. "Product Builder Academy").
4. Click **Create**.

## Step 3: Set Up Your Space Homepage

1. You will land on your new space homepage.
2. Click **Edit** and add a short description of your project.
3. Click **Publish** to save.

## Step 4: Link Confluence to Your Jira Project

1. In your Jira project, go to **Project Settings → Apps → Confluence**.
2. Click **Link a Confluence space** and select the space you just created.
3. Click **Save**.`,
  screenshotCriteria:
    'Screenshot should show your Confluence space homepage with the space name visible in the sidebar and a published homepage. The URL should show atlassian.net/wiki/spaces/...',
  isActive: true,
  checklist: [
    'Signed in to Confluence with Atlassian account',
    'Created a new Confluence space',
    'Published the space homepage',
    'Linked the Confluence space to your Jira project',
  ],
  whyItMatters:
    'Documentation is a core product management habit. Having Confluence set up alongside Jira from day one means your decisions, specs, and meeting notes live next to your tickets — keeping the whole team aligned.',
  estimatedMinutes: 15,
  createdAt: new Date(),
  updatedAt: new Date(),
}

async function up() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  // Check if a step at order 6 already exists
  const existing = await mongoose.connection
    .collection('setupsteps')
    .findOne({ order: 6 })

  if (existing) {
    console.log(`Step at order 6 already exists: "${existing.title}"`)
    console.log('Shifting all steps with order >= 6 up by 1...')
    const shift = await mongoose.connection
      .collection('setupsteps')
      .updateMany({ order: { $gte: 6 } }, { $inc: { order: 1 } })
    console.log(`Shifted ${shift.modifiedCount} steps.`)
  } else {
    console.log('No step at order 6 — inserting directly.')
  }

  await mongoose.connection.collection('setupsteps').insertOne(CONFLUENCE_STEP)
  console.log('✓ Inserted "Create Your Confluence Space" at order 6.')

  // Verify
  const steps = await mongoose.connection
    .collection('setupsteps')
    .find({}, { projection: { order: 1, title: 1 } })
    .sort({ order: 1 })
    .toArray()

  console.log('\nCurrent step order:')
  steps.forEach((s) => console.log(`  ${s.order}. ${s.title}`))

  await mongoose.disconnect()
}

const command = process.argv[2]

if (command === 'up') {
  up().catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
} else {
  console.error('Usage: npx tsx scripts/insert-confluence-step.ts up')
  process.exit(1)
}
