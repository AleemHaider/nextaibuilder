// Seed: two LIVE cohorts starting Saturday June 20, 2026 (June's third weekend).
//
//   1. "Claude Code for Business Owners"        — 14 lessons, 3–4 weeks
//   2. "Claude Code for AI Product Builders"    — 23 lessons, 6–8 weeks
//
// Both cohorts:
//   • type='LIVE', isPublished=true, instructor = Aleem Haider
//   • marketing copy + tagline lifted from the V1.0 2026 syllabi PDFs
//   • payment plans: ONE_TIME + 3x INSTALLMENT, both isActive=true
//   • modules + lessons created at full fidelity (titles, descriptions,
//     estimated minutes match the PDF)
//
// Idempotent: each entity is upserted by a stable key (Cohort.code,
// Module title within cohort, Lesson title within module). Running the
// script twice produces the same database state.
//
//   npm run --workspace=apps/api db:seed:june-cohorts
// or
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

// Business Owners: 3.5 weeks (matches "3–4 weeks" in PDF)
const BUSINESS_END  = new Date('2026-07-12T23:59:59.000Z')

// AI Product Builders: 8 weeks
const BUILDERS_END  = new Date('2026-08-15T23:59:59.000Z')

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
  tagline: "The Owner's AI Operating System — from first install to a self-running business stack.",
  description: [
    'Stop doing the work AI can do. Run your business like it\'s 2030.',
    '',
    'Six weeks from now, every Monday morning you will: open ONE window instead of seven, receive a briefing Claude wrote for you overnight, and hand off 3–5 hours of recurring weekly work to scheduled agents.',
    '',
    'A live 4-week cohort for solopreneurs, small-business owners, and operators (1–50 employees). No coding background required. You bring real work; you leave with real systems.',
    '',
    '14 lessons across 4 layers — CONVERSE, OPERATE, AUTOMATE, DELEGATE — plus a 1-week capstone where you build your personal AI Operating System.',
  ].join('\n'),
  startDate:     COHORT_START,
  endDate:       BUSINESS_END,
  liveStartDate: COHORT_START,
  liveEndDate:   BUSINESS_END,
  maxSeats:      40,
  learningOutcomes: [
    'A working AI Operating System for your business — not a tutorial clone',
    '5 custom slash commands specific to your workflows',
    '2 scheduled agents running on cron — one daily, one weekly',
    '1 internal tool your team actually uses',
    'A CLAUDE.md knowledge base that makes every future session smarter',
    'A Prompt Vault of 20+ prompts you actually reuse',
    'A 5-minute demo video walking through your week with the new stack',
    'At least 3 hours per week returned — the success metric, not lessons completed',
    'Membership in the alumni community for ongoing pattern sharing',
  ],
  requirements: [
    'A Mac or Windows computer',
    'A dedicated email address for AI sessions',
    '$20–$100/month budget for the Anthropic API',
    '30 minutes, 2–3× per week of focused learning time',
    'One real annoying weekly task you want to eliminate',
  ],
  targetAudience: [
    'Solopreneurs and small-business owners (1–50 employees)',
    'Founders and operators tired of doing tasks "a computer should be doing"',
    'Non-technical owners — no coding background required',
    'Anyone willing to bring real business data to the lessons',
  ],
  pricing: {
    // Amounts in dollars (not cents) — matches the existing storefront data
    // convention. The web client renders them via Intl.NumberFormat directly.
    oneTime:    { name: 'Pay in full',        amount: 2200 },         // $2,200
    installment: { name: '3 monthly payments', total: 2400, installmentAmount: 800, intervalDays: 30 }, // $800 × 3 = $2,400
  },
  modules: [
    {
      title: 'Module 0 — Pre-flight',
      description: 'Get oriented. Pick the task that\'ll disappear from your week.',
      lessons: [
        {
          title: 'How to Get the Most From This Course',
          description: 'The 3 commitments: bring real work, do the homework, redo failed lessons. The "Annoying Task" worksheet — the one weekly task you\'ll eliminate by Lesson 11. How the course portal, prompt vault, and community fit together.',
          estimatedMinutes: 10,
        },
      ],
    },
    {
      title: 'Module 1 — CONVERSE (Foundations)',
      description: 'Talk to Claude so you get real work back. Install, settings, safety, and the prompting framework.',
      lessons: [
        {
          title: 'What Claude Code Is & Why It Matters for Owners',
          description: 'ChatGPT vs Claude.ai vs Claude Code — clear, side-by-side. A 90-second demo: messy Desktop → organized invoices → spend report. The 4-layer Operating System and the 5 work categories.',
          estimatedMinutes: 30,
        },
        {
          title: 'Install, Settings, Safety, First Session',
          description: 'Installing on Mac and Windows. Anthropic account setup, billing, and the $20–$100/mo budget conversation. Permission modes, file access, what stays on your machine. The four things to do in every new session: greet, point at a folder, ask, verify.',
          estimatedMinutes: 40,
        },
        {
          title: "The Owner's Prompting Framework",
          description: 'The R-T-C-C model: Role · Task · Context · Constraints. Anti-patterns: vague prompts, missing context, asking for "good" output. Plan Mode — making Claude show its work before doing anything risky. Building your personal Prompt Vault (template provided).',
          estimatedMinutes: 35,
        },
      ],
    },
    {
      title: 'Module 2 — OPERATE (Daily Work)',
      description: 'Replace your five daily-work categories with AI-first workflows. Writing, data, files, research, simple tools — done in minutes, not hours.',
      lessons: [
        {
          title: 'Files, Folders & Document Chaos',
          description: 'The "messy Desktop reset" — your first big visible win. Bulk rename by date, type, or content. Finding "the document from last March about the Henderson account." Reading PDFs, Word docs, images, and scans. The safe-by-default rule: dry-run, then commit.',
          estimatedMinutes: 35,
        },
        {
          title: 'Business Writing in Your Voice',
          description: 'Building your my-voice.md — Claude\'s writing memory of YOU. The 6 owner-writing templates: customer reply, team update, SOP, blog draft, sales follow-up, board update. Killing the AI tells: generic structure, hollow openers, em-dash overuse.',
          estimatedMinutes: 40,
        },
        {
          title: 'Spreadsheets & Data Without Formulas',
          description: 'Cleaning a real CSV: deduping, normalizing, fixing dates and currencies. Pivots in plain English ("revenue by month by product line"). Anomaly detection ("what looks weird in this data?"). The one-page narrative report — 3,000 rows into a paragraph an investor can read.',
          estimatedMinutes: 40,
        },
        {
          title: 'Research, Summaries & Decisions',
          description: 'Synthesizing long documents (contracts, reports, transcripts). Web research with WebFetch / WebSearch — and the safety guardrails. The decision matrix workflow: option A vs B vs C, with tradeoffs. Meeting prep: 1 page of context, talking points, anticipated questions.',
          estimatedMinutes: 35,
        },
      ],
    },
    {
      title: 'Module 3 — AUTOMATE (Power Moves)',
      description: 'Stop DOING tasks. Start RUNNING commands. A weekly report becomes a one-word command. A monthly process becomes a scheduled job.',
      lessons: [
        {
          title: 'Building Simple Apps & Internal Tools',
          description: 'Plan Mode, iteration, "show me before you build". Live build of one of: pricing calculator · one-page marketing site · CSV-driven customer lookup. Lightweight hosting so your team can actually use it (no DevOps). When to build vs. when to buy SaaS — a 90-second rubric.',
          estimatedMinutes: 50,
        },
        {
          title: 'Connecting Your Tools With MCP',
          description: 'What MCP is, in one sentence: "USB ports for Claude". Connectors for Gmail, Google Drive, Slack, Atlassian, Canva, Figma. Permission grants — what gets accessed, when, and how to revoke. Workflows: inbox-to-replies, doc-to-Slack, ticket-triage.',
          estimatedMinutes: 45,
        },
        {
          title: 'Custom Slash Commands & Skills',
          description: 'Slash commands vs skills — your shortcuts vs packaged playbooks. Building three live: /weekly-report, /draft-invoice, /customer-followup. Saving them so they work in every session, forever. Sharing commands with your team.',
          estimatedMinutes: 40,
        },
        {
          title: 'Scheduled Agents — Work That Runs Itself',
          description: 'The two primitives: /schedule (cron-style) and /loop (polling-style). Live build: a "Monday morning briefing" that runs at 6am and emails you. Hooks — Claude triggers when something happens (file added, email arrives). The cost-and-failure conversation: budget caps, retries, what happens when an agent breaks.',
          estimatedMinutes: 45,
        },
      ],
    },
    {
      title: 'Module 4 — DELEGATE (Always-On)',
      description: 'Build agents that run your business in the background. Subagents, a living knowledge base, and the governance to make all of it safe — including for your team.',
      lessons: [
        {
          title: 'Subagents & Parallel Work',
          description: 'Subagents = specialist AI workers you delegate to. The four built-in agent types and when to use each (researcher, planner, builder, verifier). Running parallel agents: "draft three landing-page variants and rank them." Knowing when you\'re over-using agents (most owner tasks don\'t need them).',
          estimatedMinutes: 40,
        },
        {
          title: 'The CLAUDE.md Knowledge Base',
          description: 'The four layers of memory: global, project, session, conversation. Building your CLAUDE.md: business paragraph, products, customers, voice, vendors, processes. The stress test — three real tasks back-to-back using only your knowledge base. Keeping the knowledge base living — prune what\'s stale.',
          estimatedMinutes: 40,
        },
        {
          title: 'Cost, Security, Governance, Team Rollout',
          description: 'Cost: plans, usage caps, what burns tokens (and what doesn\'t). Security: what leaves your machine, what stays, encryption, retention. Governance: permission settings per-project, audit trails, do\'s and don\'ts. The "first 5 people" plan — who to onboard, in what order, with what guardrails. Responsible AI use: what NOT to delegate.',
          estimatedMinutes: 45,
        },
      ],
    },
    {
      title: 'Capstone — Your Personal AI Operating System',
      description: 'A 1-week project, ~5 hours of focused work. By the end, you\'ve assembled everything from Modules 0–4 into a working stack you use weekly.',
      lessons: [
        {
          title: 'Capstone Project — Ship Your Personal AI OS',
          description: 'Deliverables (all required): 5 custom slash commands specific to your business, 2 scheduled agents running on cron (one daily, one weekly), 1 internal tool your team uses, your CLAUDE.md knowledge base, your Prompt Vault (20+ prompts), a 5-minute demo video walking through your week with the new stack.',
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
  tagline: 'From idea to shipped cross-platform product — powered by multi-agent skill architecture.',
  description: [
    'Build like a 30-person team, alone. Then scale.',
    '',
    'Six to eight weeks. 23 lessons. The full SDLC orchestrated by AI agents — from validated thesis (Module 2) through Confluence PRD (Module 3), Figma designs (Module 4), Next.js + Flutter implementation (Module 5), GitHub Reviewer-passed PRs (Module 6), and live evals (Module 7).',
    '',
    "By the Capstone, you've shipped a public v0.1 cross-platform product with full traceability: every line of code traces back to a thesis. 6 specialist subagents, 15+ skills, one monorepo template you'll reuse on every future product.",
    '',
    'For technical builders — engineers, founders, and PMs comfortable in a terminal. You bring an idea; you leave with a shipped product.',
  ].join('\n'),
  startDate:     COHORT_START,
  endDate:       BUILDERS_END,
  liveStartDate: COHORT_START,
  liveEndDate:   BUILDERS_END,
  maxSeats:      24,
  learningOutcomes: [
    'A shipped cross-platform product (mobile + web) with full SDLC traceability',
    '6 specialist subagents + 1 orchestrator running your build pipeline',
    '15+ skills in your .claude/skills/ directory — your library forever',
    'A monorepo template you reuse on every future product',
    'A CLAUDE.md and settings that make every future project start at "Day 30"',
    'A public v0.1 release tag with changelog, CI green, evals passing',
    'A 10-minute demo video walking through your AI-orchestrated SDLC',
    'Public GitHub repo + Confluence PRD + Jira epic — proof of work',
    'Membership in the alumni community for ongoing pattern sharing',
  ],
  requirements: [
    'Comfort in a terminal (Git, package managers, basic shell)',
    'A real product idea you commit to shipping during the course',
    '30–40 hours of focused build time over 6–8 weeks',
    'Anthropic Claude Code (paid plan or API budget for production use)',
    'GitHub + Atlassian (Jira + Confluence) + Figma accounts',
    'Node 20 + Flutter SDK installed locally',
  ],
  targetAudience: [
    'Engineers, founders, and PMs comfortable in a terminal',
    'Builders shipping their first AI-orchestrated product end-to-end',
    'Teams adopting Claude Code as their primary development surface',
    'Anyone tired of vibe-coding who wants a spec-driven, agent-orchestrated pipeline',
  ],
  pricing: {
    oneTime:    { name: 'Pay in full',        amount: 3000 },         // $3,000
    installment: { name: '3 monthly payments', total: 3300, installmentAmount: 1100, intervalDays: 30 }, // $1,100 × 3 = $3,300
  },
  modules: [
    {
      title: 'Module 0 — Pre-flight',
      description: 'Get the mindset right. Write your product thesis.',
      lessons: [
        {
          title: 'The AI Product Builder Mindset',
          description: 'What changes when AI is the orchestrator, not just a code helper. The three failure modes of new AI builders: babysitting, over-prompting, under-trusting. The Director\'s mental model. Tour of the 6-stage loop and the 7 agents you\'ll build. Your commitment: ship one real product through this course, not a tutorial clone. You ship: your product thesis in one paragraph.',
          estimatedMinutes: 30,
        },
      ],
    },
    {
      title: 'Module 1 — Foundations',
      description: 'Stack live. Agents defined. Skills cooking. Every MCP wired. Every subagent role drafted. Your first reusable skill committed to .claude/skills/.',
      lessons: [
        {
          title: 'The Modern AI Product Stack',
          description: 'The full stack mapped to Claude Code primitives — intent sources, context sources, primitives, surfaces. How MCP changes the game: every tool becomes a first-class Claude collaborator. The Skill + Agent + MCP mental model. Anti-pattern: treating Claude Code like ChatGPT-in-a-terminal. You ship: a one-page architecture diagram of YOUR product\'s Claude Code stack.',
          estimatedMinutes: 60,
        },
        {
          title: 'Environment Setup — Every MCP Connected',
          description: 'Claude Code permissions, billing, settings JSON architecture (global + per-project). GitHub MCP, Atlassian MCP (Jira + Confluence), Figma MCP authed end-to-end. Flutter SDK, Next.js, Anthropic SDK locally installed and tested. First-day hooks: pre-commit, post-edit, permission scopes. The /init walkthrough bootstrapping CLAUDE.md. You ship: a CLAUDE.md and ~/.claude/settings.json you\'re proud of.',
          estimatedMinutes: 90,
        },
        {
          title: 'Multi-Agent Orchestration',
          description: 'Subagents 101 — how they isolate context, when context isolation matters. Subagent design: description, allowed tools, model, system prompt. The Orchestrator pattern: one parent decomposes, fans out, gathers, decides. The Verifier pattern: every Builder has a paired Reviewer. Cost & latency: when parallel agents help, when they hurt. You ship: three subagent definitions: researcher.md, pm.md, reviewer.md.',
          estimatedMinutes: 75,
        },
        {
          title: 'Skills-Based Architecture',
          description: 'Skills vs slash commands — when to wrap a workflow in which. The skill-creator pattern. The 7 course skills: product-discovery, write-spec, decompose-spec, figma-to-tokens, ship-feature, review-pr, release. Skill testing loop — never ship an unreliable skill. Layering: skills call subagents, subagents call MCP tools, you call skills. You ship: your first working skill: product-discovery committed to .claude/skills/.',
          estimatedMinutes: 75,
        },
      ],
    },
    {
      title: 'Module 2 — IDEATE (Discovery)',
      description: 'From idea to validated thesis. Kill bad ideas early. Parallel research agents do in 30 minutes what a discovery sprint used to take a week.',
      lessons: [
        {
          title: 'From Idea to Validated Thesis',
          description: 'The product-discovery skill against your real idea. Parallel research subagents: market scan + competitor scan + user-voice scan, all simultaneous. WebFetch + WebSearch governance — what to trust, what to verify. The opportunity score — a rubric the Researcher fills before you build. Killing your idea early when the data says so. You ship: a 2-page validated thesis with sources, opportunity score, and a clear go/no-go.',
          estimatedMinutes: 60,
        },
        {
          title: 'User Research Synthesis at Scale',
          description: 'Synthesizing 50+ qualitative inputs into themes. The "voice of customer" extraction skill — quotes, frequency, sentiment. Avoiding confirmation bias when AI does the synthesis (second-opinion subagent). Linking themes to Jira initiatives. You ship: a Confluence page — themes, quotes, opportunities.',
          estimatedMinutes: 60,
        },
      ],
    },
    {
      title: 'Module 3 — SPECIFY (Atlassian)',
      description: 'The spec IS the prompt. Write it like you mean it. Confluence PRDs that Builder agents execute against. Jira epics that decompose themselves.',
      lessons: [
        {
          title: 'World-Class Specs in Confluence',
          description: 'Why spec-driven beats vibe-driven for AI-built products. The 9-section PRD template: problem · users · goals · non-goals · UX overview · functional reqs · non-functional reqs · risks · success metrics. Live: thesis → PRD in Confluence using write-spec + Atlassian MCP. Iteration loop with stakeholders. The "spec sniff test" — 5 questions every PRD must pass. You ship: a complete PRD in your Confluence space.',
          estimatedMinutes: 90,
        },
        {
          title: 'Spec → Jira Decomposition Pipeline',
          description: 'The decompose-spec skill: PRD → epic → stories → tasks, in your conventions. Mapping spec sections to ticket types. Estimation: when AI estimates well, when it\'s overconfident. Auto-linking: Confluence ↔ Jira ↔ Figma ↔ GitHub. Sprint planning with the PM agent — capacity, priority, dependencies. You ship: a Jira epic with 10–20 well-formed child stories, fully linked to your PRD.',
          estimatedMinutes: 75,
        },
        {
          title: 'Tech Design, RFCs, Acceptance Criteria',
          description: 'When a story needs a tech-design doc, and when it doesn\'t. The RFC skill — options, tradeoffs, decision record. Writing acceptance criteria the Builder agent can execute against. Definition of done — before code is written. You ship: one RFC and three story-level tech-design notes for your most complex tickets.',
          estimatedMinutes: 60,
        },
      ],
    },
    {
      title: 'Module 4 — DESIGN (Figma)',
      description: 'Spec to high-fidelity Figma. One system, two consumers. Designer agent + Figma MCP + Code Connect. Pixels that map to YOUR component library.',
      lessons: [
        {
          title: 'Designer Agent — Spec to Figma',
          description: 'Wireframing from a PRD with the Designer subagent + Figma MCP. The progression: wireframes → mid-fi → hi-fi, each as a review gate. Brand kit as input — Claude applies your brand, doesn\'t invent one. Generating web and mobile screens at the same time. Review-with-PM loop: design challenged by spec adherence. You ship: a complete Figma file with all key screens for web + mobile, named by user flow.',
          estimatedMinutes: 75,
        },
        {
          title: 'Figma MCP — Design Context, Tokens, Code Connect',
          description: 'get_design_context deep dive — what comes back, what to trust. Extracting design tokens (color, spacing, type) to JSON / CSS variables. Code Connect — mapping Figma components to YOUR codebase components. The hand-off contract: what a builder agent needs from Figma to ship production code. Avoiding the "pixel-perfect trap" — Figma is reference, not gospel. You ship: a design-tokens.json and a Code Connect mapping for your top 10 components.',
          estimatedMinutes: 75,
        },
        {
          title: 'The Shared Design System',
          description: 'One source of truth, two consumers: web (Tailwind/shadcn) and mobile (Flutter widgets). The figma-to-tokens skill in production. Token pipeline: Figma → JSON → CSS variables (web) + Dart constants (mobile). Component parity — when to match across platforms, when not. Versioning the design system as its own package. You ship: a design-system/ package consumed by both apps.',
          estimatedMinutes: 75,
        },
      ],
    },
    {
      title: 'Module 5 — BUILD (Code)',
      description: 'Cross-platform implementation. Web + Mobile + AI features. Web Builder for Next.js. Mobile Builder for Flutter. Shared layer for types + API + business rules.',
      lessons: [
        {
          title: 'Web Builder — Next.js App From Design',
          description: 'Web Builder subagent — stack: Next.js 15, TypeScript, Tailwind, shadcn/ui, Server Components. The frontend-design skill for production-grade, non-generic UIs. From Figma frame to working route in 15 minutes. Patterns: route structure, data loading, Server Actions, auth shell. Testing: Playwright for golden paths, Vitest for unit. You ship: three production-ready routes built from real Figma frames.',
          estimatedMinutes: 90,
        },
        {
          title: 'Mobile Builder — Flutter App From Design',
          description: 'Mobile Builder subagent — stack: Flutter 3.x, Riverpod, GoRouter, Freezed. The sleek-design-mobile-apps skill in action. From Figma frame to running screen on simulator in 20 minutes. Patterns: feature folders, repository pattern, state, navigation. Testing: widget tests for goldens, integration tests for flows. You ship: three production-ready screens built from real Figma frames.',
          estimatedMinutes: 90,
        },
        {
          title: 'Shared Layer — Types, API Client, Business Logic',
          description: 'Monorepo decision: turborepo / nx / melos — when each makes sense. Shared TS types for web; codegen for Dart from the same source. API client: one OpenAPI spec, two generated clients. Business rules: where to put logic that must match across platforms. The single-source-of-truth rule — never let web and mobile drift. You ship: a shared/ package with types, API client, and one cross-platform validator.',
          estimatedMinutes: 75,
        },
        {
          title: 'AI Features IN the Product — Claude API Done Right',
          description: 'When to add AI to your product (and when AI is just a worse button). The claude-api skill — prompt caching, model selection, streaming. Tool use in production — designing tools your AI calls. Cost control: cache hit rates, summarization gates, model routing. Evals from day one — no eval, no merge. You ship: one AI feature live in both web and mobile, with caching, evals, and cost ceiling.',
          estimatedMinutes: 90,
        },
        {
          title: 'Parallel Multi-Agent Implementation',
          description: 'The "build three features in parallel" pattern — three Builders, three branches. Orchestrator coordinates, you direct. When parallelism wins (independent features) and when it loses. Merge strategy: rebase, conflict resolution, who picks the winner. Cost conversation: parallel = faster wall-clock, more tokens. You ship: three features implemented in parallel, merged cleanly to main.',
          estimatedMinutes: 60,
        },
      ],
    },
    {
      title: 'Module 6 — SHIP (GitHub + CI)',
      description: 'Every PR auto-reviewed before you look at it. GitHub MCP, Reviewer agent, ultrareview, hooks, CI/CD, release management. The pipeline polices itself.',
      lessons: [
        {
          title: 'GitHub Workflow — Branches, PRs, MCP',
          description: 'GitHub MCP / gh CLI playbook. The ship-feature skill: branch → code → tests → PR in one command. PR template: summary, screenshots, test plan, risk section. Linking PR ↔ Jira ↔ Confluence so context never gets lost. Squash vs merge vs rebase — pick one, stick with it. You ship: your first 5 Capstone PRs, each Reviewer-passed with green CI.',
          estimatedMinutes: 60,
        },
        {
          title: 'Reviewer Agent — Multi-Agent Code Review',
          description: 'Reviewer subagent — what it checks, what it skips. /review and /security-review skills end-to-end. Multi-agent review with /ultrareview — cloud reviewers from different angles. The simplify skill — reuse, quality, efficiency pass. Second-opinion workflow when Reviewer and Builder disagree. You ship: a repo where every PR is auto-reviewed before you look at it.',
          estimatedMinutes: 75,
        },
        {
          title: 'CI/CD, Hooks, Release Management',
          description: 'Hooks: pre-commit, pre-push, post-edit — Claude in the pipeline. CI: lint + typecheck + test + build, fast feedback first. The release skill: version bump, changelog, tag, deploy. Mobile: TestFlight / Play Console internal track. Web: preview environments per PR, prod behind a flag. Rollback playbook — every release ships with one. You ship: a green CI/CD pipeline and a public v0.1 release tag.',
          estimatedMinutes: 75,
        },
      ],
    },
    {
      title: 'Module 7 — ITERATE (Measure)',
      description: 'Close the loop. Insights become releases. Evals for AI features. Scheduled insight digests. The flywheel actually flying.',
      lessons: [
        {
          title: 'Observability for AI Features',
          description: 'Evals: golden-set assertions (cheap) and LLM-as-judge with caveats (right). Tracing: every AI call logged with prompt, response, latency, cost. Cost dashboards: per-feature, per-user, per-day. Regression detection — when a prompt/model change breaks quality. The eval-driven prompt engineering loop. You ship: an eval suite for your AI feature and a dashboard showing latency + cost per call.',
          estimatedMinutes: 75,
        },
        {
          title: 'Feedback Loops — Closing the Product Loop',
          description: 'Inbound channels (support, reviews, social) → Confluence themes. The weekly insight digest — a scheduled agent that emails you Monday at 6am. The incident-postmortem subagent — when something breaks. Roadmap pruning — what to kill, what to double down on. Closing the loop: insights → Jira → PRs → releases. You ship: a scheduled agent that emails you a weekly product-insights digest every Monday at 6am.',
          estimatedMinutes: 60,
        },
      ],
    },
    {
      title: 'Capstone — End-to-End Ship',
      description: 'Ship your AI product, end-to-end. Two weeks. 12–20 hours focused. The entire build must be traceable: every line of code traces back to a thesis.',
      lessons: [
        {
          title: 'Capstone Project — Public v0.1 Release',
          description: 'Deliverables (all required): Public GitHub monorepo (apps/web, apps/mobile, packages/shared, packages/design-system); Confluence PRD; Jira epic with all child tickets Done; Figma file with hi-fi screens; .claude/ directory with 3 subagents, 5 skills, CLAUDE.md, settings; CI/CD passing on main; one AI-powered feature with eval suite + cost ceiling; v0.1 release tag with changelog; a 10-minute demo video walking through your pipeline (not the product).',
          estimatedMinutes: 1200,
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
        title: 'Instructor · Course Designer',
        bio: '<p>Aleem Haider has spent years training Product Managers at <strong>Google</strong>, <strong>Amazon</strong>, and <strong>Meta</strong> — the people whose job it is to figure out what to build, for whom, and why. His sessions strip away theory and leave PMs with the concrete artifacts they use on Monday morning.</p><p>Design philosophy: outcome-driven, artifact-heavy, no fluff.</p>',
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
        // type annotation says uppercase but the data on disk is lowercase
        // — we follow the data, not the annotation.
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
      },
      $setOnInsert: { code: seed.code, enrollmentCount: 0 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  console.log(`  ✓ Cohort: ${cohort.name} (${cohort._id})`)

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
    console.log(`    ├─ Module ${mi}: ${ms.title}  (${ms.lessons.length} lessons)`)
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

  console.log(`    └─ Plans: $${seed.pricing.oneTime.amount} one-time · 3× $${seed.pricing.installment.installmentAmount} installment`)
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Connecting to MongoDB...')
  await connectMongoDB()

  console.log('\n[1/3] Upserting instructor (Aleem Haider)...')
  const instructor = await upsertInstructor()
  console.log(`      ✓ ${instructor.name} — InstructorProfile=${instructor.profileId}`)

  console.log('\n[2/3] Seeding "Claude Code for Business Owners"...')
  await seedCohort(businessOwners, [instructor.profileId])

  console.log('\n[3/3] Seeding "Claude Code for AI Product Builders"...')
  await seedCohort(builders, [instructor.profileId])

  console.log('\n✅ Done. Browse the storefront at http://localhost:5173/catalog')
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
