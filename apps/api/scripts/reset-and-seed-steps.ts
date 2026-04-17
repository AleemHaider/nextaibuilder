// Reset all step data and reseed from macOS Installation Guide (Module 1)
// Run with: npx tsx scripts/reset-and-seed-steps.ts
import { connectMongoDB, mongoose } from '../src/lib/mongodb.js'
import { SetupStep } from '../src/models/SetupStep.js'
import { CohortStep } from '../src/models/CohortStep.js'
import { StudentStep } from '../src/models/StudentStep.js'
import { Cohort } from '../src/models/Cohort.js'

async function main() {
  await connectMongoDB()
  console.log('Connected to MongoDB.')

  // ── 1. Wipe all step-related collections ──────────────────────────────────
  const deletedStudentSteps = await StudentStep.deleteMany({})
  console.log(`Deleted ${deletedStudentSteps.deletedCount} StudentStep records`)

  const deletedCohortSteps = await CohortStep.deleteMany({})
  console.log(`Deleted ${deletedCohortSteps.deletedCount} CohortStep records`)

  const deletedSetupSteps = await SetupStep.deleteMany({})
  console.log(`Deleted ${deletedSetupSteps.deletedCount} SetupStep records`)

  // ── 2. Seed new steps from macOS Installation Guide (Module 1) ─────────────
  const stepsData = [
    {
      order: 1,
      title: 'Install Homebrew',
      estimatedMinutes: 10,
      isActive: true,
      description: `Homebrew is a package manager for Mac that makes installing developer tools simple. You'll use it to install Node.js in the next step.

**1.1 Open Terminal**
- Press **Command (⌘) + Space** to open Spotlight Search
- Type \`Terminal\` and press **Enter**

**1.2 Install Homebrew**
Copy and paste this entire command into Terminal, then press Enter:

\`\`\`shell
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
\`\`\`

- You may be asked to enter your **Mac login password** — type it and press Enter (nothing shows on screen — this is normal)
- The installation will take 2–5 minutes

**1.3 Add Homebrew to Your PATH (Apple Silicon Macs only)**
If your Mac has an **Apple Silicon chip** (M1, M2, M3, M4), run these two commands:

\`\`\`shell
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
\`\`\`

\`\`\`shell
eval "$(/opt/homebrew/bin/brew shellenv)"
\`\`\`

**1.4 Verify Homebrew Installed**

\`\`\`shell
brew --version
\`\`\`

You should see something like: \`Homebrew 5.x.x\``,
      screenshotCriteria:
        'Screenshot should show a Terminal window with the output of `brew --version` displaying a version number like "Homebrew 5.x.x". The Terminal prompt should be visible.',
    },
    {
      order: 2,
      title: 'Install Node.js',
      estimatedMinutes: 5,
      isActive: true,
      description: `Node.js is the runtime required to run Claude Code. Install it using Homebrew.

**Install Node.js**

\`\`\`shell
brew install node
\`\`\`

**Verify Node.js Installed**

\`\`\`shell
node --version
npm --version
\`\`\`

You should see version numbers for both Node.js (v18 or later) and npm.`,
      screenshotCriteria:
        'Screenshot should show a Terminal window with the output of both `node --version` and `npm --version` commands displaying version numbers. Node.js should be v18 or later.',
    },
    {
      order: 3,
      title: 'Install Claude Code',
      estimatedMinutes: 5,
      isActive: true,
      description: `Install the Claude Code CLI globally using npm.

**Install Claude Code**

\`\`\`shell
npm install -g @anthropic-ai/claude-code
\`\`\`

**Fix Permissions (only if you get a permission error)**

\`\`\`shell
sudo npm install -g @anthropic-ai/claude-code
\`\`\`

**Verify Claude Code Installed**

\`\`\`shell
claude --version
\`\`\`

You should see a version number confirming Claude Code is installed.`,
      screenshotCriteria:
        'Screenshot should show a Terminal window with the output of `claude --version` displaying a version number. The command should run without any errors.',
    },
    {
      order: 4,
      title: 'Authenticate with Your Anthropic Account',
      estimatedMinutes: 5,
      isActive: true,
      description: `Connect Claude Code to your Anthropic account to start using it.

**4.1 Create an Anthropic Account (if you don't have one)**

Go to **https://console.anthropic.com** and sign up for a free account.

**4.2 Log In to Claude Code**

\`\`\`shell
claude
\`\`\`

The first time you run this, Claude Code will open your browser and ask you to log in.

1. Log in with your Anthropic account credentials
2. Click **"Authorize"** or **"Allow"**
3. Return to Terminal — you should see a welcome message from Claude

You are now set up and ready to use Claude Code!`,
      screenshotCriteria:
        'Screenshot should show a Terminal window with Claude Code running and displaying a welcome message after successful authentication. The Terminal should show the Claude Code prompt or a confirmation that you are logged in.',
    },
  ]

  const createdSteps: Array<{ _id: unknown; title: string }> = []
  for (const stepData of stepsData) {
    const step = await SetupStep.create(stepData)
    createdSteps.push(step)
    console.log(`Created Step ${stepData.order}: ${stepData.title}`)
  }

  // ── 3. Link steps to all active cohorts ───────────────────────────────────
  const cohorts = await Cohort.find({ status: 'ACTIVE' })
  console.log(`\nLinking steps to ${cohorts.length} active cohort(s)...`)

  for (const cohort of cohorts) {
    for (let i = 0; i < createdSteps.length; i++) {
      await CohortStep.create({
        cohortId: cohort._id,
        stepId: createdSteps[i]._id,
        order: i + 1,
      })
    }
    console.log(`  Linked ${createdSteps.length} steps to cohort: ${cohort.name}`)
  }

  console.log('\nReset and reseed complete.')
  console.log(`  ${createdSteps.length} steps created`)
  console.log(`  ${cohorts.length} cohort(s) updated`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
