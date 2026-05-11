// Seed: two LIVE cohorts starting Saturday June 20, 2026 (June's third weekend).
//
//   1. "Claude Code for Business Owners"        14 lessons, 3 to 4 weeks
//   2. "Claude Code for AI Product Builders"    23 lessons, 6 to 8 weeks
//
// Both cohorts:
//   - type='live', isPublished=true, instructor = Aleem Haider
//   - marketing copy + tagline derived from the V1.0 2026 syllabi PDFs
//     and rewritten in natural prose (no em or en dashes)
//   - payment plans: ONE_TIME + 3x INSTALLMENT, both isActive=true
//   - modules + lessons created at full fidelity (titles, descriptions,
//     estimatedMinutes match the PDF)
//
// Idempotent: each entity is upserted by a stable key (Cohort.code,
// Module title within cohort, Lesson title within module). Running the
// script twice produces the same database state.
//
//   tsx --env-file=apps/api/.env apps/api/scripts/seed-june-2026-cohorts.ts

import 'dotenv/config'
import mongoose, { Types } from 'mongoose'
import { connectMongoDB } from '../src/lib/mongodb.js'
import { User } from '../src/models/User.js'
import { InstructorProfile } from '../src/models/InstructorProfile.js'
import { Cohort } from '../src/models/Cohort.js'
import { Module } from '../src/models/Module.js'
import { Lesson } from '../src/models/Lesson.js'
import { PaymentPlan } from '../src/models/PaymentPlan.js'

// ── Dates ────────────────────────────────────────────────────────────────
// "June third weekend 2026" = Saturday June 20, 2026.

const COHORT_START = new Date('2026-06-20T16:00:00.000Z')  // Sat 9am PT / 4pm UTC

// Business Owners: about 3.5 weeks
const BUSINESS_END  = new Date('2026-07-12T23:59:59.000Z')

// AI Product Builders: 8 weeks
const BUILDERS_END  = new Date('2026-08-15T23:59:59.000Z')

// AI Agent Builders: 4 to 5 weeks
const AGENTS_END  = new Date('2026-07-26T23:59:59.000Z')

// ── Cohort + module + lesson definitions ────────────────────────────────

interface LessonSeed {
  title:            string
  description:      string
  estimatedMinutes: number
}

interface ModuleSeed {
  title:       string
  description: string
  lessons:     LessonSeed[]
}

interface CohortSeed {
  code:        string
  name:        string
  slug:        string
  tagline:     string
  description: string
  startDate:   Date
  endDate:     Date
  liveStartDate: Date
  liveEndDate:   Date
  maxSeats:    number
  // Marketing bullets that populate the storefront detail page.
  learningOutcomes: string[]
  requirements:     string[]
  targetAudience:   string[]
  // Founding-discount fields. regularPrice is the post-promo price shown
  // with a strike-through until promoSeats seats are sold. Both null when
  // there's no promo.
  regularPrice: number | null
  promoSeats:   number | null
  pricing: {
    oneTime:    { name: string; amount: number }
    installment: { name: string; total: number; installmentAmount: number; intervalDays: number }
  }
  modules: ModuleSeed[]
}

const businessOwners: CohortSeed = {
  code: 'CC-BUSINESS-2026Q2',
  name: 'Claude Code for Business Owners',
  slug: 'claude-code-for-business-owners-june-2026',
  tagline: "The Owner's AI Operating System. From first install to a self-running business stack.",
  description: [
    "Stop doing the work AI can do. Run your business like it's 2030.",
    '',
    "Four weeks from now, every Monday will look different. You open one window instead of seven. You read a briefing Claude wrote for you overnight. Three to five hours of recurring weekly work is now handled by scheduled agents.",
    '',
    "This is a live cohort for solopreneurs, small-business owners, and operators with 1 to 50 employees. You don't need a coding background. You bring real work; you leave with real systems.",
    '',
    "Fourteen lessons across four layers (Converse, Operate, Automate, Delegate), plus a one-week capstone where you assemble your personal AI Operating System.",
  ].join('\n'),
  startDate:     COHORT_START,
  endDate:       BUSINESS_END,
  liveStartDate: COHORT_START,
  liveEndDate:   BUSINESS_END,
  maxSeats:      40,
  learningOutcomes: [
    'A working AI Operating System for your business, not a tutorial clone',
    'Five custom slash commands specific to your workflows',
    'Two scheduled agents running on cron, one daily and one weekly',
    'One internal tool your team actually uses',
    'A CLAUDE.md knowledge base that makes every future session smarter',
    'A Prompt Vault of 20+ prompts you reuse weekly',
    'A 5-minute demo video walking through your week with the new stack',
    'At least three hours per week returned. That is the success metric, not lessons completed',
    'Membership in the alumni community for ongoing pattern sharing',
  ],
  requirements: [
    'A Mac or Windows computer',
    'A dedicated email address for AI sessions',
    'A $20 to $100 monthly budget for the Anthropic API',
    '30 minutes, two or three times per week of focused learning time',
    'One real annoying weekly task you want to eliminate',
  ],
  targetAudience: [
    'Solopreneurs and small-business owners (1 to 50 employees)',
    'Founders and operators tired of doing tasks "a computer should be doing"',
    'Non-technical owners. No coding background required',
    'Anyone willing to bring real business data to the lessons',
  ],
  // Founding cohort: regular price $4,500, first 10 seats at 40% off ($2,700).
  // Once the 10th seat sells, regularPrice falls back to $4,500 automatically
  // (the storefront route compares enrollmentCount against promoSeats).
  regularPrice: 4500,
  promoSeats:   10,
  pricing: {
    // Active prices are the founding rate. After the founding 10 sell, the
    // user updates these to the full $4,500 / $1,650 amounts manually.
    oneTime:    { name: 'Pay in full',        amount: 2700 },         // $2,700 (40% off $4,500)
    installment: { name: '3 monthly payments', total: 3000, installmentAmount: 1000, intervalDays: 30 }, // $1,000 x 3 = $3,000
  },
  modules: [
    {
      title: 'Module 0. Pre-flight',
      description: "Get oriented. Pick the task that's going to disappear from your week.",
      lessons: [
        {
          title: 'How to Get the Most From This Course',
          description: "The three commitments: bring real work, do the homework, redo failed lessons. The Annoying Task worksheet. That single weekly task you'll eliminate by Lesson 11. How the course portal, prompt vault, and community fit together.",
          estimatedMinutes: 10,
        },
      ],
    },
    {
      title: 'Module 1. CONVERSE (Foundations)',
      description: 'Talk to Claude so you get real work back. Install, settings, safety, and the prompting framework.',
      lessons: [
        {
          title: 'What Claude Code Is and Why It Matters for Owners',
          description: 'ChatGPT vs Claude.ai vs Claude Code, side by side. A 90-second demo: messy Desktop, then organized invoices, then a spend report. The 4-layer Operating System and the five work categories.',
          estimatedMinutes: 30,
        },
        {
          title: 'Install, Settings, Safety, First Session',
          description: 'Installing on Mac and Windows. Anthropic account setup, billing, and the $20 to $100 monthly budget conversation. Permission modes, file access, what stays on your machine. The four things to do in every new session: greet, point at a folder, ask, verify.',
          estimatedMinutes: 40,
        },
        {
          title: "The Owner's Prompting Framework",
          description: 'The R-T-C-C model: Role, Task, Context, Constraints. Anti-patterns: vague prompts, missing context, asking for "good" output. Plan Mode for making Claude show its work before doing anything risky. Building your personal Prompt Vault (template provided).',
          estimatedMinutes: 35,
        },
      ],
    },
    {
      title: 'Module 2. OPERATE (Daily Work)',
      description: 'Replace your five daily work categories with AI-first workflows. Writing, data, files, research, simple tools. Done in minutes, not hours.',
      lessons: [
        {
          title: 'Files, Folders, and Document Chaos',
          description: 'The "messy Desktop reset", your first big visible win. Bulk rename by date, type, or content. Finding "the document from last March about the Henderson account." Reading PDFs, Word docs, images, and scans. The safe-by-default rule: dry-run, then commit.',
          estimatedMinutes: 35,
        },
        {
          title: 'Business Writing in Your Voice',
          description: "Building your my-voice.md, Claude's writing memory of YOU. The six owner-writing templates: customer reply, team update, SOP, blog draft, sales follow-up, board update. Killing the AI tells: generic structure, hollow openers, em-dash overuse.",
          estimatedMinutes: 40,
        },
        {
          title: 'Spreadsheets and Data Without Formulas',
          description: 'Cleaning a real CSV: deduping, normalizing, fixing dates and currencies. Pivots in plain English ("revenue by month by product line"). Anomaly detection ("what looks weird in this data?"). The one-page narrative report. 3,000 rows turned into a paragraph an investor can read.',
          estimatedMinutes: 40,
        },
        {
          title: 'Research, Summaries, and Decisions',
          description: 'Synthesizing long documents (contracts, reports, transcripts). Web research with WebFetch and WebSearch, plus the safety guardrails. The decision matrix workflow: option A vs B vs C with tradeoffs. Meeting prep: one page of context, talking points, anticipated questions.',
          estimatedMinutes: 35,
        },
      ],
    },
    {
      title: 'Module 3. AUTOMATE (Power Moves)',
      description: 'Stop doing tasks. Start running commands. A weekly report becomes a one-word command. A monthly process becomes a scheduled job.',
      lessons: [
        {
          title: 'Building Simple Apps and Internal Tools',
          description: 'Plan Mode, iteration, "show me before you build". A live build of one of: a pricing calculator, a one-page marketing site, or a CSV-driven customer lookup. Lightweight hosting so your team can actually use it (no DevOps). When to build vs when to buy SaaS, in a 90-second rubric.',
          estimatedMinutes: 50,
        },
        {
          title: 'Connecting Your Tools With MCP',
          description: 'What MCP is, in one sentence: "USB ports for Claude". Connectors for Gmail, Google Drive, Slack, Atlassian, Canva, Figma. Permission grants: what gets accessed, when, and how to revoke. Workflows: inbox to replies, doc to Slack, ticket triage.',
          estimatedMinutes: 45,
        },
        {
          title: 'Custom Slash Commands and Skills',
          description: 'Slash commands vs skills: your shortcuts vs packaged playbooks. Building three live: /weekly-report, /draft-invoice, /customer-followup. Saving them so they work in every session, forever. Sharing commands with your team.',
          estimatedMinutes: 40,
        },
        {
          title: 'Scheduled Agents. Work That Runs Itself',
          description: 'The two primitives: /schedule (cron style) and /loop (polling style). Live build: a "Monday morning briefing" that runs at 6am and emails you. Hooks: Claude triggers when something happens (file added, email arrives). The cost and failure conversation: budget caps, retries, what happens when an agent breaks.',
          estimatedMinutes: 45,
        },
      ],
    },
    {
      title: 'Module 4. DELEGATE (Always-On)',
      description: 'Build agents that run your business in the background. Subagents, a living knowledge base, and the governance to make all of it safe, including for your team.',
      lessons: [
        {
          title: 'Subagents and Parallel Work',
          description: 'Subagents are specialist AI workers you delegate to. The four built-in agent types and when to use each (researcher, planner, builder, verifier). Running parallel agents: "draft three landing-page variants and rank them." Knowing when you are over-using agents (most owner tasks do not need them).',
          estimatedMinutes: 40,
        },
        {
          title: 'The CLAUDE.md Knowledge Base',
          description: 'The four layers of memory: global, project, session, conversation. Building your CLAUDE.md: business paragraph, products, customers, voice, vendors, processes. The stress test: three real tasks back to back using only your knowledge base. Keeping the knowledge base living. Prune what is stale.',
          estimatedMinutes: 40,
        },
        {
          title: 'Cost, Security, Governance, Team Rollout',
          description: "Cost: plans, usage caps, what burns tokens (and what doesn't). Security: what leaves your machine, what stays, encryption, retention. Governance: permission settings per project, audit trails, do's and don'ts. The first-five-people plan: who to onboard, in what order, with what guardrails. Responsible AI use: what NOT to delegate.",
          estimatedMinutes: 45,
        },
      ],
    },
    {
      title: 'Capstone. Your Personal AI Operating System',
      description: "A one-week project, about five hours of focused work. By the end you have assembled everything from Modules 0 to 4 into a working stack you use weekly.",
      lessons: [
        {
          title: 'Capstone Project. Ship Your Personal AI OS',
          description: 'Deliverables (all required): five custom slash commands specific to your business, two scheduled agents running on cron (one daily, one weekly), one internal tool your team uses, your CLAUDE.md knowledge base, your Prompt Vault (20+ prompts), and a 5-minute demo video walking through your week with the new stack.',
          estimatedMinutes: 300,
        },
      ],
    },
  ],
}

const builders: CohortSeed = {
  code: 'CC-BUILDERS-2026Q2',
  name: 'Claude Code for AI Product Builders',
  slug: 'claude-code-for-ai-product-builders-june-2026',
  tagline: 'From idea to shipped cross-platform product, powered by multi-agent skill architecture.',
  description: [
    'Build like a 30-person team, alone. Then scale.',
    '',
    'Six to eight weeks. 23 lessons. The full SDLC orchestrated by AI agents: from a validated thesis in Module 2, through a Confluence PRD in Module 3, Figma designs in Module 4, Next.js and Flutter implementation in Module 5, Reviewer-passed PRs in Module 6, and live evals in Module 7.',
    '',
    "By the Capstone you have shipped a public v0.1 cross-platform product with full traceability. Every line of code traces back to a thesis. Six specialist subagents, 15+ skills, one monorepo template you'll reuse on every future product.",
    '',
    'For technical builders. Engineers, founders, and PMs comfortable in a terminal. You bring an idea; you leave with a shipped product.',
  ].join('\n'),
  startDate:     COHORT_START,
  endDate:       BUILDERS_END,
  liveStartDate: COHORT_START,
  liveEndDate:   BUILDERS_END,
  maxSeats:      24,
  learningOutcomes: [
    'A shipped cross-platform product (mobile and web) with full SDLC traceability',
    'Six specialist subagents plus one orchestrator running your build pipeline',
    '15+ skills in your .claude/skills/ directory. Your library forever',
    'A monorepo template you reuse on every future product',
    'A CLAUDE.md and settings that make every future project start at "Day 30"',
    'A public v0.1 release tag with changelog, CI green, evals passing',
    'A 10-minute demo video walking through your AI-orchestrated SDLC',
    'Public GitHub repo, Confluence PRD, and Jira epic. Proof of work',
    'Membership in the alumni community for ongoing pattern sharing',
  ],
  requirements: [
    'Comfort in a terminal (Git, package managers, basic shell)',
    'A real product idea you commit to shipping during the course',
    '30 to 40 hours of focused build time over 6 to 8 weeks',
    'Anthropic Claude Code (paid plan or API budget for production use)',
    'GitHub, Atlassian (Jira and Confluence), and Figma accounts',
    'Node 20 plus Flutter SDK installed locally',
  ],
  targetAudience: [
    'Engineers, founders, and PMs comfortable in a terminal',
    'Builders shipping their first AI-orchestrated product end to end',
    'Teams adopting Claude Code as their primary development surface',
    'Anyone tired of vibe-coding who wants a spec-driven, agent-orchestrated pipeline',
  ],
  // No founding discount on this cohort: flat $3,000 / 3x $1,000.
  regularPrice: null,
  promoSeats:   null,
  pricing: {
    oneTime:    { name: 'Pay in full',        amount: 3000 },         // $3,000
    installment: { name: '3 monthly payments', total: 3000, installmentAmount: 1000, intervalDays: 30 }, // $1,000 x 3 = $3,000
  },
  modules: [
    {
      title: 'Module 0. Pre-flight',
      description: 'Get the mindset right. Write your product thesis.',
      lessons: [
        {
          title: 'The AI Product Builder Mindset',
          description: "What changes when AI is the orchestrator, not just a code helper. The three failure modes of new AI builders: babysitting, over-prompting, under-trusting. The Director's mental model. A tour of the 6-stage loop and the seven agents you'll build. Your commitment: ship one real product through this course, not a tutorial clone. You ship: your product thesis in one paragraph.",
          estimatedMinutes: 30,
        },
      ],
    },
    {
      title: 'Module 1. Foundations',
      description: 'Stack live. Agents defined. Skills cooking. Every MCP wired. Every subagent role drafted. Your first reusable skill committed to .claude/skills/.',
      lessons: [
        {
          title: 'The Modern AI Product Stack',
          description: "The full stack mapped to Claude Code primitives: intent sources, context sources, primitives, surfaces. How MCP changes the game. Every tool becomes a first-class Claude collaborator. The Skill, Agent, and MCP mental model. Anti-pattern: treating Claude Code like ChatGPT in a terminal. You ship: a one-page architecture diagram of YOUR product's Claude Code stack.",
          estimatedMinutes: 60,
        },
        {
          title: 'Environment Setup. Every MCP Connected',
          description: "Claude Code permissions, billing, settings JSON architecture (global plus per project). GitHub MCP, Atlassian MCP (Jira and Confluence), Figma MCP authed end to end. Flutter SDK, Next.js, Anthropic SDK locally installed and tested. First-day hooks: pre-commit, post-edit, permission scopes. The /init walkthrough bootstrapping CLAUDE.md. You ship: a CLAUDE.md and ~/.claude/settings.json you're proud of.",
          estimatedMinutes: 90,
        },
        {
          title: 'Multi-Agent Orchestration',
          description: 'Subagents 101. How they isolate context, and when context isolation matters. Subagent design: description, allowed tools, model, system prompt. The Orchestrator pattern: one parent decomposes, fans out, gathers, decides. The Verifier pattern: every Builder has a paired Reviewer. Cost and latency: when parallel agents help, when they hurt. You ship: three subagent definitions (researcher.md, pm.md, reviewer.md).',
          estimatedMinutes: 75,
        },
        {
          title: 'Skills-Based Architecture',
          description: 'Skills vs slash commands. When to wrap a workflow in which. The skill-creator pattern. The seven course skills: product-discovery, write-spec, decompose-spec, figma-to-tokens, ship-feature, review-pr, release. Skill testing loop. Never ship an unreliable skill. Layering: skills call subagents, subagents call MCP tools, you call skills. You ship: your first working skill (product-discovery, committed to .claude/skills/).',
          estimatedMinutes: 75,
        },
      ],
    },
    {
      title: 'Module 2. IDEATE (Discovery)',
      description: 'From idea to validated thesis. Kill bad ideas early. Parallel research agents do in 30 minutes what a discovery sprint used to take a week.',
      lessons: [
        {
          title: 'From Idea to Validated Thesis',
          description: 'The product-discovery skill applied to your real idea. Parallel research subagents: market scan, competitor scan, user-voice scan, all simultaneous. WebFetch and WebSearch governance. What to trust, what to verify. The opportunity score, a rubric the Researcher fills before you build. Killing your idea early when the data says so. You ship: a 2-page validated thesis with sources, an opportunity score, and a clear go/no-go.',
          estimatedMinutes: 60,
        },
        {
          title: 'User Research Synthesis at Scale',
          description: 'Synthesizing 50+ qualitative inputs into themes. The voice-of-customer extraction skill: quotes, frequency, sentiment. Avoiding confirmation bias when AI does the synthesis (second-opinion subagent). Linking themes to Jira initiatives. You ship: a Confluence page with themes, quotes, and opportunities.',
          estimatedMinutes: 60,
        },
      ],
    },
    {
      title: 'Module 3. SPECIFY (Atlassian)',
      description: 'The spec IS the prompt. Write it like you mean it. Confluence PRDs that Builder agents execute against. Jira epics that decompose themselves.',
      lessons: [
        {
          title: 'World-Class Specs in Confluence',
          description: 'Why spec-driven beats vibe-driven for AI-built products. The 9-section PRD template: problem, users, goals, non-goals, UX overview, functional requirements, non-functional requirements, risks, success metrics. Live: thesis to PRD in Confluence using write-spec and the Atlassian MCP. Iteration loop with stakeholders. The "spec sniff test": five questions every PRD must pass. You ship: a complete PRD in your Confluence space.',
          estimatedMinutes: 90,
        },
        {
          title: 'Spec to Jira Decomposition Pipeline',
          description: "The decompose-spec skill: PRD to epic to stories to tasks, in your conventions. Mapping spec sections to ticket types. Estimation: when AI estimates well, when it's overconfident. Auto-linking: Confluence to Jira to Figma to GitHub. Sprint planning with the PM agent: capacity, priority, dependencies. You ship: a Jira epic with 10 to 20 well-formed child stories, fully linked to your PRD.",
          estimatedMinutes: 75,
        },
        {
          title: 'Tech Design, RFCs, Acceptance Criteria',
          description: "When a story needs a tech-design doc, and when it doesn't. The RFC skill: options, tradeoffs, decision record. Writing acceptance criteria the Builder agent can execute against. Definition of done, before code is written. You ship: one RFC and three story-level tech-design notes for your most complex tickets.",
          estimatedMinutes: 60,
        },
      ],
    },
    {
      title: 'Module 4. DESIGN (Figma)',
      description: 'Spec to high-fidelity Figma. One system, two consumers. Designer agent plus Figma MCP plus Code Connect. Pixels that map to YOUR component library.',
      lessons: [
        {
          title: 'Designer Agent. Spec to Figma',
          description: "Wireframing from a PRD with the Designer subagent and Figma MCP. The progression: wireframes, mid-fi, hi-fi, each as a review gate. Brand kit as input. Claude applies your brand, doesn't invent one. Generating web and mobile screens at the same time. Review-with-PM loop: design challenged by spec adherence. You ship: a complete Figma file with all key screens for web and mobile, named by user flow.",
          estimatedMinutes: 75,
        },
        {
          title: 'Figma MCP. Design Context, Tokens, Code Connect',
          description: 'get_design_context deep dive. What comes back, what to trust. Extracting design tokens (color, spacing, type) to JSON and CSS variables. Code Connect for mapping Figma components to YOUR codebase components. The hand-off contract: what a builder agent needs from Figma to ship production code. Avoiding the pixel-perfect trap. Figma is reference, not gospel. You ship: a design-tokens.json and a Code Connect mapping for your top 10 components.',
          estimatedMinutes: 75,
        },
        {
          title: 'The Shared Design System',
          description: 'One source of truth, two consumers. Web (Tailwind plus shadcn) and mobile (Flutter widgets). The figma-to-tokens skill in production. Token pipeline: Figma to JSON to CSS variables (web) plus Dart constants (mobile). Component parity. When to match across platforms, when not. Versioning the design system as its own package. You ship: a design-system/ package consumed by both apps.',
          estimatedMinutes: 75,
        },
      ],
    },
    {
      title: 'Module 5. BUILD (Code)',
      description: 'Cross-platform implementation. Web, mobile, and AI features. Web Builder for Next.js. Mobile Builder for Flutter. A shared layer for types, API, and business rules.',
      lessons: [
        {
          title: 'Web Builder. Next.js App From Design',
          description: 'Web Builder subagent. Stack: Next.js 15, TypeScript, Tailwind, shadcn/ui, Server Components. The frontend-design skill for production-grade, non-generic UIs. From Figma frame to working route in 15 minutes. Patterns: route structure, data loading, Server Actions, auth shell. Testing: Playwright for golden paths, Vitest for unit. You ship: three production-ready routes built from real Figma frames.',
          estimatedMinutes: 90,
        },
        {
          title: 'Mobile Builder. Flutter App From Design',
          description: 'Mobile Builder subagent. Stack: Flutter 3.x, Riverpod, GoRouter, Freezed. The sleek-design-mobile-apps skill in action. From Figma frame to running screen on simulator in 20 minutes. Patterns: feature folders, repository pattern, state, navigation. Testing: widget tests for goldens, integration tests for flows. You ship: three production-ready screens built from real Figma frames.',
          estimatedMinutes: 90,
        },
        {
          title: 'Shared Layer. Types, API Client, Business Logic',
          description: 'Monorepo decision: turborepo, nx, or melos. When each makes sense. Shared TS types for web; codegen for Dart from the same source. API client: one OpenAPI spec, two generated clients. Business rules: where to put logic that must match across platforms. The single-source-of-truth rule. Never let web and mobile drift. You ship: a shared/ package with types, API client, and one cross-platform validator.',
          estimatedMinutes: 75,
        },
        {
          title: 'AI Features IN the Product. Claude API Done Right',
          description: 'When to add AI to your product (and when AI is just a worse button). The claude-api skill: prompt caching, model selection, streaming. Tool use in production. Designing tools your AI calls. Cost control: cache hit rates, summarization gates, model routing. Evals from day one. No eval, no merge. You ship: one AI feature live in both web and mobile, with caching, evals, and a cost ceiling.',
          estimatedMinutes: 90,
        },
        {
          title: 'Parallel Multi-Agent Implementation',
          description: 'The "build three features in parallel" pattern. Three Builders, three branches. Orchestrator coordinates, you direct. When parallelism wins (independent features) and when it loses. Merge strategy: rebase, conflict resolution, who picks the winner. Cost conversation: parallel means faster wall-clock, more tokens. You ship: three features implemented in parallel, merged cleanly to main.',
          estimatedMinutes: 60,
        },
      ],
    },
    {
      title: 'Module 6. SHIP (GitHub plus CI)',
      description: 'Every PR auto-reviewed before you look at it. GitHub MCP, Reviewer agent, ultrareview, hooks, CI/CD, release management. The pipeline polices itself.',
      lessons: [
        {
          title: 'GitHub Workflow. Branches, PRs, MCP',
          description: 'GitHub MCP and gh CLI playbook. The ship-feature skill: branch, code, tests, PR in one command. PR template: summary, screenshots, test plan, risk section. Linking PR to Jira to Confluence so context never gets lost. Squash vs merge vs rebase. Pick one, stick with it. You ship: your first five Capstone PRs, each Reviewer-passed with green CI.',
          estimatedMinutes: 60,
        },
        {
          title: 'Reviewer Agent. Multi-Agent Code Review',
          description: 'Reviewer subagent. What it checks, what it skips. The /review and /security-review skills end to end. Multi-agent review with /ultrareview: cloud reviewers from different angles. The simplify skill for a reuse, quality, efficiency pass. Second-opinion workflow when Reviewer and Builder disagree. You ship: a repo where every PR is auto-reviewed before you look at it.',
          estimatedMinutes: 75,
        },
        {
          title: 'CI/CD, Hooks, Release Management',
          description: 'Hooks: pre-commit, pre-push, post-edit. Claude in the pipeline. CI: lint, typecheck, test, build. Fast feedback first. The release skill: version bump, changelog, tag, deploy. Mobile: TestFlight and Play Console internal track. Web: preview environments per PR, prod behind a flag. Rollback playbook. Every release ships with one. You ship: a green CI/CD pipeline and a public v0.1 release tag.',
          estimatedMinutes: 75,
        },
      ],
    },
    {
      title: 'Module 7. ITERATE (Measure)',
      description: 'Close the loop. Insights become releases. Evals for AI features. Scheduled insight digests. The flywheel actually flying.',
      lessons: [
        {
          title: 'Observability for AI Features',
          description: 'Evals: golden-set assertions (cheap) and LLM-as-judge with caveats (right). Tracing: every AI call logged with prompt, response, latency, cost. Cost dashboards: per feature, per user, per day. Regression detection: when a prompt or model change breaks quality. The eval-driven prompt-engineering loop. You ship: an eval suite for your AI feature and a dashboard showing latency and cost per call.',
          estimatedMinutes: 75,
        },
        {
          title: 'Feedback Loops. Closing the Product Loop',
          description: 'Inbound channels (support, reviews, social) to Confluence themes. The weekly insight digest: a scheduled agent that emails you Monday at 6am. The incident-postmortem subagent for when something breaks. Roadmap pruning: what to kill, what to double down on. Closing the loop: insights to Jira to PRs to releases. You ship: a scheduled agent that emails you a weekly product-insights digest every Monday at 6am.',
          estimatedMinutes: 60,
        },
      ],
    },
    {
      title: 'Capstone. End-to-End Ship',
      description: 'Ship your AI product end to end. Two weeks. 12 to 20 hours focused. The entire build must be traceable. Every line of code traces back to a thesis.',
      lessons: [
        {
          title: 'Capstone Project. Public v0.1 Release',
          description: 'Deliverables (all required): a public GitHub monorepo (apps/web, apps/mobile, packages/shared, packages/design-system); a Confluence PRD; a Jira epic with all child tickets Done; a Figma file with hi-fi screens; a .claude/ directory with three subagents, five skills, CLAUDE.md, and settings; CI/CD passing on main; one AI-powered feature with an eval suite and a cost ceiling; a v0.1 release tag with changelog; a 10-minute demo video walking through your pipeline (not the product).',
          estimatedMinutes: 1200,
        },
      ],
    },
  ],
}

const agents: CohortSeed = {
  code: 'CC-AGENTS-2026Q2',
  name: 'Claude Code for AI Agent Builders',
  slug: 'claude-code-for-ai-agent-builders-june-2026',
  tagline: 'Build production AI agents with LangChain, LangGraph, and n8n. You design. Claude Code writes every line.',
  description: [
    'Stop watching demos. Ship your first agent this week.',
    '',
    'Four agent patterns, one course: PROMPT (one smart LLM call with structured output), CHAIN (LangChain tool-using agents), GRAPH (LangGraph state machines), and WORKFLOW (n8n visual orchestration). You learn when to reach for each.',
    '',
    'By the Capstone you have a real agent live on the public internet, traced in LangSmith, watched by an eval suite, with cost caps and fallback model routing. Doing real work in your business, unsupervised.',
    '',
    'No coding required. You describe the problem and the agent shape. Claude Code writes every line of Python.',
  ].join('\n'),
  startDate:     COHORT_START,
  endDate:       AGENTS_END,
  liveStartDate: COHORT_START,
  liveEndDate:   AGENTS_END,
  maxSeats:      30,
  learningOutcomes: [
    'A live AI agent running on the public internet, doing real work for you',
    'Four agent patterns under your belt: PROMPT, CHAIN, GRAPH, WORKFLOW',
    'A clear sense of when to use LangChain, LangGraph, or n8n',
    'A LangSmith dashboard tracing every call your agent makes',
    'An eval suite of 10+ golden examples that catches regressions',
    'Cost caps, rate limits, and fallback model routing in place',
    'A reusable template you adapt for the next 10 agents you build',
    'Membership in the alumni community for ongoing patterns and updates',
  ],
  requirements: [
    'A Mac or Windows computer',
    'API budget for Anthropic plus OpenAI ($30 to $100 monthly is plenty)',
    'A free LangSmith account',
    '15 to 20 hours of focused build time over 4 to 5 weeks',
    'One real problem in your work that an agent could plausibly solve',
  ],
  targetAudience: [
    'Operators and builders who want agents doing real work, not demos',
    'Anyone comfortable in a terminal but not writing Python by hand',
    'Founders running ops who keep saying "this should be automated"',
    'PMs and analysts shipping internal tools without a dev team',
  ],
  // Founding-cohort discount: regular $5,500, first 10 seats at 40% off ($3,300).
  regularPrice: 5500,
  promoSeats:   10,
  pricing: {
    oneTime:    { name: 'Pay in full',        amount: 3300 },         // $3,300 (40% off $5,500)
    installment: { name: '3 monthly payments', total: 3600, installmentAmount: 1200, intervalDays: 30 }, // $1,200 x 3 = $3,600
  },
  modules: [
    {
      title: 'Module 0. Pre-flight',
      description: 'Get the mindset right. Pick the one real problem your agent will solve.',
      lessons: [
        {
          title: 'What an AI Agent Actually Is',
          description: 'What separates "an agent" from "just calling an LLM in a loop". The three ways beginners get this wrong, and why each one wastes weeks. The shape of agents that actually work in production. How Claude Code fits in, and why you do not need to learn Python. Pick the one real problem you will solve by the end of the course. You ship: one paragraph naming the agent you will build, with specific inputs and outputs.',
          estimatedMinutes: 20,
        },
      ],
    },
    {
      title: 'Module 1. PROMPT',
      description: 'One smart call. Structured output. Your first agent. Get this layer right and everything above it gets easier.',
      lessons: [
        {
          title: 'Setup. Claude Code, Anthropic, LangSmith',
          description: 'Installing Claude Code and getting it talking to your terminal. Anthropic and OpenAI API keys, billing, cost caps. LangSmith free account, your tracing dashboard from day one. Python installed and ready, you will never write a line yourself. The first folder layout for an agent project. You build today: your agent project folder, configured, with Claude Code happily writing files into it.',
          estimatedMinutes: 45,
        },
        {
          title: 'Your First Prompt with Structured Output',
          description: 'Why "give me JSON" is the foundation of every reliable agent. Pydantic schemas in plain English. Claude Code writes them, you describe them. Asking Claude Code to test the output, not just generate it. The prompt patterns that make output reliable: role, examples, constraints. Reading LangSmith traces to see exactly what your agent saw and said. You build today: an LLM call that takes an email and returns a clean JSON object you can rely on.',
          estimatedMinutes: 40,
        },
        {
          title: 'Single-Step Agents That Earn Their Keep',
          description: 'What you can already ship at the PROMPT layer (more than you think). Three useful one-shot agents: email triager, content summarizer, lead qualifier. How to wire it to a real input (your inbox, your Slack, your form responses). When to stay at PROMPT and not move up the stack. You build today: one of the three example agents, running on your real data.',
          estimatedMinutes: 35,
        },
      ],
    },
    {
      title: 'Module 2. CHAIN',
      description: 'LangChain. Tool-using agents. The workhorse layer. The agent reads, calls APIs, takes actions. This is what most production agents actually are.',
      lessons: [
        {
          title: 'What LangChain Actually Does',
          description: 'What LangChain is, in one sentence: glue between LLMs and the rest of the world. The three things it does well: tool calling, structured output, prompt management. The two things it does not (state machines, visual flow), and what to use instead. Why you use it for 70% of agents, even after you learn the other layers. You build today: a working LangChain agent skeleton, set up the way you use it for the rest of the course.',
          estimatedMinutes: 45,
        },
        {
          title: 'Tool-Using Agents (Gmail, Calendar, Slack)',
          description: 'Wiring an agent to Gmail, Google Calendar, and Slack via their APIs. Why "let the LLM pick the tool" is harder than it sounds, and how to make it work. The five tool patterns: read, search, create, update, delete. Auth and credentials. How to keep them safe (Claude Code handles the plumbing). You build today: an agent that reads your inbox, drafts replies, and waits for your approval before sending.',
          estimatedMinutes: 60,
        },
        {
          title: 'RAG. Agents That Read Your Documents',
          description: 'What RAG is, in plain words: the agent looks something up before answering. The vector database setup. Claude Code stands one up for you (Chroma or Pinecone). Embedding your real documents (PDFs, Notion pages, Google Docs). Why most RAG fails, and the chunking and re-ranking tricks that fix it. You build today: an agent that answers questions about your own documents, with citations back to the source.',
          estimatedMinutes: 60,
        },
        {
          title: 'Your First Useful Multi-Step Agent',
          description: 'Putting it all together: tools plus RAG plus structured output. The shape of a daily research agent: pull news, read it, summarize, send. The shape of a triage agent: read, classify, route, draft. How to know when your agent is reliable enough to leave alone. You build today: one real LangChain agent doing real work in your business, end to end.',
          estimatedMinutes: 75,
        },
      ],
    },
    {
      title: 'Module 3. GRAPH',
      description: 'LangGraph. Stateful agents that think in steps. The most powerful agent pattern in production today. Slower to learn, vastly more capable.',
      lessons: [
        {
          title: 'When You Need a Graph, Not a Chain',
          description: 'The five signals your chain is about to fall over: loops, conditionals, retries, memory, recovery. What "state" actually means in an agent, and why it matters. The mental shift from "pipeline" to "state machine". When to stay in LangChain. When to graduate to LangGraph. You build today: a side-by-side comparison of the same agent in LangChain and LangGraph. See where the chain breaks.',
          estimatedMinutes: 60,
        },
        {
          title: 'Designing Your First State Machine',
          description: 'The four pieces of every LangGraph agent: state, nodes, edges, conditions. How to sketch the graph on paper before Claude Code writes it. Human-in-the-loop: pausing the graph for a person to approve. Retries, fallbacks, and what happens when a node fails. You build today: a LangGraph agent that handles a multi-step task in your business: classify, decide, act, confirm.',
          estimatedMinutes: 75,
        },
        {
          title: 'Visual Debugging with LangGraph Studio',
          description: 'The Studio interface: watch your agent think in real time. Inspecting state at every node, understanding why it chose what it chose. Time-traveling: rerunning from any node with modified state. Debugging without ever reading code (Claude Code handles fixes). You build today: use Studio to find and fix a real bug in the agent you built in Lesson 9.',
          estimatedMinutes: 60,
        },
        {
          title: 'Multi-Agent Systems (Supervisor plus Workers)',
          description: 'The supervisor pattern: one agent decides which specialist handles what. The worker pattern: small focused agents that do one thing well. Hand-offs between agents, and how to keep them from looping. When multi-agent helps. When it just adds cost and confusion. You build today: a 3-agent team. One researcher, one writer, one reviewer, supervised by a fourth. Working together on a real task.',
          estimatedMinutes: 75,
        },
      ],
    },
    {
      title: 'Module 4. WORKFLOW',
      description: 'n8n. Visual orchestration across all your tools. Drag and drop, with 400+ pre-built integrations. The fastest way to put your agents in front of real triggers and real users.',
      lessons: [
        {
          title: 'What n8n Is and When to Reach for It',
          description: 'n8n in one sentence: a drag-and-drop pipeline editor with 400+ integrations. The simple rule for choosing: visual flow with triggers, use n8n; stateful reasoning, use LangGraph. n8n Cloud vs self-hosted, which to start with. The five n8n node types you use over and over. You build today: an n8n account up, a starter workflow imported, your first webhook firing into it.',
          estimatedMinutes: 60,
        },
        {
          title: 'Your First Visual n8n Agent Workflow',
          description: 'Building a real workflow: trigger (new form fill), LLM step (classify), action (route to CRM or email). The HTTP Request node, your bridge to any API n8n does not have a connector for. The IF / Switch nodes, your conditional logic without any code. Error handling, retries, fallbacks. All visual. You build today: a real visual workflow running on n8n Cloud, triggered by a real event in your business.',
          estimatedMinutes: 75,
        },
        {
          title: 'Wiring n8n to LangGraph (Best of Both)',
          description: 'The pattern: n8n handles the trigger and integration, LangGraph handles the reasoning. How to call your LangGraph agent from an n8n HTTP node. How to call back into n8n from inside a LangGraph node. The hybrid architecture that powers most production agents you have seen. You build today: one full agent where n8n triggers, LangGraph thinks, n8n acts. Working end to end.',
          estimatedMinutes: 75,
        },
      ],
    },
    {
      title: 'Module 5. SHIP (Production)',
      description: 'Hosting. Tracing. Evals. Cost caps. Fallbacks. The four production basics every real agent needs.',
      lessons: [
        {
          title: 'Hosting. Self, Vercel, or n8n Cloud',
          description: 'The three real hosting paths and the tradeoff each makes (cost, control, complexity). Deploying a LangGraph agent to Vercel or Fly with Claude Code running the deploy. Running your own n8n on a $5/mo VPS, when that makes sense. Webhooks, schedules, and how the world reaches your agent. You build today: your Capstone agent live on the public internet, reachable by a real URL.',
          estimatedMinutes: 60,
        },
        {
          title: 'LangSmith. Trace Everything',
          description: 'Reading a trace from input to final output, every LLM call visible. Latency, cost, and token counts per step. Spotting why an agent ran off the rails on a specific input. Sharing a trace with someone else, the new way to ask for help. You build today: a LangSmith dashboard for your live agent with every call traced and searchable.',
          estimatedMinutes: 60,
        },
        {
          title: 'Evals. Knowing Your Agent Works',
          description: 'The cheap eval: a golden set of 10 to 20 known-good examples. The right eval: LLM-as-judge, with caveats. Catching regressions when you change a prompt or model. The eval-first habit that separates real agents from demos. You build today: an eval suite for your agent that runs every time you change something.',
          estimatedMinutes: 75,
        },
        {
          title: 'Cost, Rate Limits, Fallbacks',
          description: 'The four real costs of an agent in production (tokens, hosting, integrations, your time). Setting per-day and per-call cost caps. Rate limits and what to do when you hit them (retry, queue, escalate). Fallback model routing: Claude fails over to GPT, GPT fails over to Haiku. You build today: a production-grade cost dashboard and three working fallbacks in your agent.',
          estimatedMinutes: 55,
        },
      ],
    },
    {
      title: 'Capstone. Ship It',
      description: 'Ship a real AI agent into your business. A one-week project, around four hours of focused work. By the end, your agent is live, traced, watched by an eval suite, and doing real work.',
      lessons: [
        {
          title: 'Capstone Project. Real Agent, Real URL',
          description: 'Deliverables (all required): one live agent at a public URL (Vercel, Fly, or n8n Cloud); the real problem you picked in Lesson 0, actually solved; a LangSmith dashboard with every call traced; an eval suite of 10+ golden examples, all passing; cost caps and fallback model routing in place; a 3-minute screen recording walking through your agent in action.',
          estimatedMinutes: 240,
        },
      ],
    },
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function upsertInstructor(): Promise<{ userId: Types.ObjectId; profileId: Types.ObjectId; name: string }> {
  // Reuse the existing super-admin if present, otherwise mint a fresh User.
  const user = await User.findOneAndUpdate(
    { email: 'aleemhaider111@gmail.com' },
    {
      $set: { role: 'SUPER_ADMIN' },
      $setOnInsert: {
        email:     'aleemhaider111@gmail.com',
        firstName: 'Aleem',
        lastName:  'Haider',
        oauthProvider: 'google',
        oauthId:       'seed-admin-google-id',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const profile = await InstructorProfile.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        name:  'Aleem Haider',
        title: 'Instructor and Course Designer',
        bio: '<p>Aleem Haider has spent years training Product Managers at <strong>Google</strong>, <strong>Amazon</strong>, and <strong>Meta</strong>. The people whose job it is to figure out what to build, for whom, and why. His sessions strip away theory and leave PMs with the concrete artifacts they use on Monday morning.</p><p>Design philosophy: outcome driven, artifact heavy, no fluff.</p>',
      },
      $setOnInsert: { userId: user._id, socialLinks: [] },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return {
    userId:    user._id as Types.ObjectId,
    profileId: profile._id as Types.ObjectId,
    name:      profile.name,
  }
}

async function seedCohort(seed: CohortSeed, instructorIds: Types.ObjectId[]): Promise<void> {
  // ── Cohort upsert ────────────────────────────────────────────────────
  const cohort = await Cohort.findOneAndUpdate(
    { code: seed.code },
    {
      $set: {
        name:           seed.name,
        slug:           seed.slug,
        tagline:        seed.tagline,
        description:    seed.description,
        // 'live' lowercase matches the existing storefront catalog
        // convention (filter chip checks `type === 'live'`). The model
        // type annotation says uppercase but the data on disk is lowercase,
        // so we follow the data not the annotation.
        type:           'live',
        status:         'UPCOMING',
        startDate:      seed.startDate,
        endDate:        seed.endDate,
        liveStartDate:  seed.liveStartDate,
        liveEndDate:    seed.liveEndDate,
        maxSeats:       seed.maxSeats,
        isPublished:    true,
        instructorIds,
        learningOutcomes: seed.learningOutcomes,
        requirements:     seed.requirements,
        targetAudience:   seed.targetAudience,
        regularPrice:     seed.regularPrice,
        promoSeats:       seed.promoSeats,
      },
      $setOnInsert: { code: seed.code, enrollmentCount: 0 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  console.log(`  Cohort: ${cohort.name} (${cohort._id})`)

  // ── Modules + lessons ────────────────────────────────────────────────
  for (let mi = 0; mi < seed.modules.length; mi++) {
    const ms = seed.modules[mi]
    const mod = await Module.findOneAndUpdate(
      { cohortId: cohort._id, title: ms.title },
      {
        $set: {
          description: ms.description,
          order:       mi,
          isPublished: true,
        },
        $setOnInsert: { cohortId: cohort._id, title: ms.title },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    for (let li = 0; li < ms.lessons.length; li++) {
      const ls = ms.lessons[li]
      await Lesson.findOneAndUpdate(
        { moduleId: mod._id, title: ls.title },
        {
          $set: {
            cohortId:         cohort._id,
            description:      ls.description,
            order:            li,
            type:             'VIDEO',
            isPublished:      true,
            freePreview:      mi === 0 && li === 0,  // first lesson of module 0 = free preview
            estimatedMinutes: ls.estimatedMinutes,
          },
          $setOnInsert: { moduleId: mod._id, title: ls.title },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    }
    console.log(`    Module ${mi}: ${ms.title}  (${ms.lessons.length} lessons)`)
  }

  // ── Payment plans ────────────────────────────────────────────────────
  const oneTime = await PaymentPlan.findOneAndUpdate(
    { cohortId: cohort._id, type: 'ONE_TIME' },
    {
      $set: {
        name:        seed.pricing.oneTime.name,
        currency:    'usd',
        totalAmount: seed.pricing.oneTime.amount,
        isActive:    true,
      },
      $setOnInsert: { cohortId: cohort._id, type: 'ONE_TIME' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // Installments: 3 equal payments, intervalDays apart, starting at startDate.
  const installments = [1, 2, 3].map((n) => ({
    number:  n,
    amount:  seed.pricing.installment.installmentAmount,
    dueDate: new Date(
      seed.startDate.getTime() + (n - 1) * seed.pricing.installment.intervalDays * 24 * 60 * 60 * 1000,
    ),
    status:  'PENDING' as const,
  }))

  const installment = await PaymentPlan.findOneAndUpdate(
    { cohortId: cohort._id, type: 'INSTALLMENT' },
    {
      $set: {
        name:         seed.pricing.installment.name,
        currency:     'usd',
        totalAmount:  seed.pricing.installment.total,
        intervalDays: seed.pricing.installment.intervalDays,
        installments,
        isActive:     true,
      },
      $setOnInsert: { cohortId: cohort._id, type: 'INSTALLMENT' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // Link plan ids back onto the cohort so the storefront detail page can resolve them.
  await Cohort.updateOne(
    { _id: cohort._id },
    { $set: { paymentPlanIds: [oneTime._id, installment._id] } },
  )

  console.log(`    Plans: $${seed.pricing.oneTime.amount} one-time, 3 x $${seed.pricing.installment.installmentAmount} installment`)
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Connecting to MongoDB...')
  await connectMongoDB()

  console.log('\n[1/4] Upserting instructor (Aleem Haider)...')
  const instructor = await upsertInstructor()
  console.log(`      ${instructor.name}. InstructorProfile=${instructor.profileId}`)

  console.log('\n[2/4] Seeding "Claude Code for Business Owners"...')
  await seedCohort(businessOwners, [instructor.profileId])

  console.log('\n[3/4] Seeding "Claude Code for AI Product Builders"...')
  await seedCohort(builders, [instructor.profileId])

  console.log('\n[4/4] Seeding "Claude Code for AI Agent Builders"...')
  await seedCohort(agents, [instructor.profileId])

  console.log('\nDone. Browse the storefront at http://localhost:5173/catalog')
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
