#!/usr/bin/env node
/**
 * Read-only export of the old nextaibuilder MongoDB into one JSON file for
 * `wp nab import`. Only runs find() queries; never writes to MongoDB.
 *
 * Usage (from the repo root):
 *   node apps/wordpress/tools/export-mongo.mjs "<mongodb-uri>" out.json
 *
 * Uses the `mongodb` driver already installed for apps/api.
 */
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '../../api/package.json'))
// mongodb ships as mongoose's dependency in apps/api; resolve it through mongoose.
const mongooseRequire = createRequire(require.resolve('mongoose'))
const { MongoClient } = mongooseRequire('mongodb')

const [uri, out] = process.argv.slice(2)
if (!uri || !out) {
  console.error('usage: export-mongo.mjs <mongodb-uri> <out.json>')
  process.exit(1)
}


// ---- Content converters -----------------------------------------------------

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** TipTap/ProseMirror JSON → HTML (the old lesson editor's format). */
function tiptapToHtml(node) {
  if (!node) return ''
  if (typeof node === 'string') {
    try { return tiptapToHtml(JSON.parse(node)) } catch { return node } // already HTML/text
  }
  if (Array.isArray(node)) return node.map(tiptapToHtml).join('')
  const kids = tiptapToHtml(node.content)
  switch (node.type) {
    case 'doc': return kids
    case 'paragraph': return `<p>${kids}</p>\n`
    case 'heading': { const l = Math.min(Math.max(node.attrs?.level || 2, 2), 4); return `<h${l}>${kids}</h${l}>\n` }
    case 'bulletList': return `<ul>${kids}</ul>\n`
    case 'orderedList': return `<ol>${kids}</ol>\n`
    case 'listItem': return `<li>${kids}</li>`
    case 'taskList': return `<ul>${kids}</ul>\n`
    case 'taskItem': return `<li>${node.attrs?.checked ? '☑ ' : '☐ '}${kids}</li>`
    case 'blockquote': return `<blockquote>${kids}</blockquote>\n`
    case 'codeBlock': return `<pre><code${node.attrs?.language ? ` class="language-${esc(node.attrs.language)}"` : ''}>${(node.content || []).map((t) => esc(t.text || '')).join('')}</code></pre>\n`
    case 'horizontalRule': return '<hr />\n'
    case 'hardBreak': return '<br />'
    case 'image': return `<img src="${esc(node.attrs?.src || '')}" alt="${esc(node.attrs?.alt || '')}" />`
    case 'text': {
      let t = esc(node.text || '')
      for (const m of node.marks || []) {
        if (m.type === 'bold') t = `<strong>${t}</strong>`
        else if (m.type === 'italic') t = `<em>${t}</em>`
        else if (m.type === 'code') t = `<code>${t}</code>`
        else if (m.type === 'strike') t = `<s>${t}</s>`
        else if (m.type === 'link') t = `<a href="${esc(m.attrs?.href || '#')}">${t}</a>`
      }
      return t
    }
    default: return kids
  }
}

/** Small Markdown → HTML for setup-step instructions (headings, lists, code, bold, links). */
function markdownToHtml(md) {
  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
  const out = []
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
  let list = null, para = []
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = [] } }
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = line.match(/^```(\w*)/)
    if (fence) {
      flushPara(); flushList()
      const code = []
      while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i])
      out.push(`<pre><code${fence[1] ? ` class="language-${fence[1]}"` : ''}>${esc(code.join('\n'))}</code></pre>`)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)/)
    const ul = line.match(/^\s*[-*]\s+(.*)/)
    const ol = line.match(/^\s*\d+\.\s+(.*)/)
    if (h) { flushPara(); flushList(); const l = Math.max(2, h[1].length); out.push(`<h${l}>${inline(h[2])}</h${l}>`) }
    else if (ul || ol) {
      flushPara()
      const tag = ul ? 'ul' : 'ol'
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] } }
      list.items.push((ul || ol)[1])
    } else if (!line.trim()) { flushPara(); flushList() }
    else { flushList(); para.push(line.trim()) }
  }
  flushPara(); flushList()
  return out.join('\n')
}

const id = (v) => (v == null ? null : String(v))
const iso = (d) => (d ? new Date(d).toISOString() : null)

const client = new MongoClient(uri, { readPreference: 'secondaryPreferred' })
await client.connect()
const db = client.db()
const all = (name, query = {}) => db.collection(name).find(query).toArray()

const [users, cohorts, plans, modules, lessons, enrollments, studentLessons, steps, studentSteps, certificates, stripe, paddle, manual] =
  await Promise.all([
    all('users'), all('cohorts'), all('paymentplans'), all('modules'), all('lessons'), all('enrollments'),
    all('studentlessons'), all('setupsteps'), all('studentsteps'), all('certificates'),
    all('stripepayments'), all('paddlepayments'), all('manualpaymentrequests'),
  ])

const data = {
  exportedAt: new Date().toISOString(),
  users: users.map((u) => ({
    id: id(u._id),
    email: (u.email || '').toLowerCase(),
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    role: u.role,
    isActive: u.isActive !== false,
    oauthProvider: u.oauthProvider || null,
    oauthId: u.oauthId || null,
    passwordHash: u.passwordHash || null,
    createdAt: iso(u.createdAt),
  })),
  cohorts: cohorts.map((c) => ({
    id: id(c._id),
    slug: c.slug,
    name: c.name,
    tagline: c.tagline || '',
    description: c.description || '',
    type: (c.type || 'recorded').toLowerCase(),
    status: c.status,
    isPublished: !!c.isPublished,
    startDate: iso(c.liveStartDate || c.startDate),
    endDate: iso(c.liveEndDate || c.endDate),
    maxSeats: c.maxSeats || null,
    learningOutcomes: c.learningOutcomes || [],
    requirements: c.requirements || [],
    targetAudience: c.targetAudience || [],
    plans: plans.filter((p) => id(p.cohortId) === id(c._id)).map((p) => ({
      id: id(p._id), name: p.name, type: p.type, totalAmount: p.totalAmount, currency: p.currency,
      installments: p.installments || null, intervalDays: p.intervalDays || null, isActive: p.isActive !== false,
    })),
    modules: modules.filter((m) => id(m.cohortId) === id(c._id)).sort((a, b) => a.order - b.order).map((m) => ({
      id: id(m._id),
      title: m.title,
      description: m.description || '',
      lessons: lessons.filter((l) => id(l.moduleId) === id(m._id)).sort((a, b) => a.order - b.order).map((l) => ({
        id: id(l._id), title: l.title, type: l.type, contentFormat: l.contentFormat || null,
        content: l.contentFormat === 'markdown' ? markdownToHtml(l.richContent) : tiptapToHtml(l.richContent), videoUrl: l.videoUrl || null, videoProvider: l.videoProvider || null,
        minutes: l.estimatedMinutes || (l.videoDurationSeconds ? Math.round(l.videoDurationSeconds / 60) : 0),
        freePreview: !!l.freePreview, isPublished: l.isPublished !== false,
      })),
    })),
  })),
  enrollments: enrollments.map((e) => ({
    id: id(e._id), userId: id(e.studentId), cohortId: id(e.cohortId), status: e.status,
    paymentMethod: e.paymentMethod || null, paymentStatus: e.paymentStatus || null,
    accessGrantedAt: iso(e.accessGrantedAt), createdAt: iso(e.createdAt),
  })),
  lessonProgress: studentLessons.filter((s) => s.completedAt || s.status === 'COMPLETED').map((s) => ({
    userId: id(s.studentId), lessonId: id(s.lessonId), completedAt: iso(s.completedAt),
  })),
  setupSteps: steps.sort((a, b) => a.order - b.order).map((s) => ({
    id: id(s._id), title: s.title, order: s.order, description: markdownToHtml(s.description),
    screenshotCriteria: s.screenshotCriteria || '', checklist: s.checklist || [], whyItMatters: s.whyItMatters || '',
    minutes: s.estimatedMinutes || 0, videoUrl: s.videoUrl || null, isActive: s.isActive !== false,
  })),
  stepProgress: studentSteps.map((s) => ({
    userId: id(s.userId), stepId: id(s.stepId), status: s.status, attempts: s.attempts || 0, completedAt: iso(s.completedAt),
  })),
  certificates: certificates.map((c) => ({
    userId: id(c.userId), cohortId: id(c.cohortId), token: c.publicToken || c.certificateToken || null,
    credentialId: c.credentialId || null, issuedAt: iso(c.issuedAt),
  })),
  payments: [
    ...stripe.map((p) => ({ provider: 'stripe', id: id(p._id), userId: id(p.studentId || p.userId), cohortId: id(p.cohortId), amount: p.amount ?? null, currency: p.currency || 'usd', status: p.status, reference: p.paymentIntentId || p.stripePaymentIntentId || null, createdAt: iso(p.createdAt) })),
    ...paddle.map((p) => ({ provider: 'paddle', id: id(p._id), userId: id(p.studentId || p.userId), cohortId: id(p.cohortId), amount: p.amount ?? null, currency: p.currency || 'usd', status: p.status, reference: p.transactionId || null, createdAt: iso(p.createdAt) })),
    ...manual.map((p) => ({ provider: 'manual', id: id(p._id), userId: id(p.studentId), cohortId: id(p.cohortId), amount: p.amount ?? null, currency: 'usd', status: p.status, reference: null, createdAt: iso(p.createdAt) })),
  ],
}

await client.close()
writeFileSync(out, JSON.stringify(data, null, 1))
const counts = Object.fromEntries(Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]))
console.log('exported', counts, '→', out)
