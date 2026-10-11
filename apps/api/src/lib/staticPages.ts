// Renders published ContentPage documents to static HTML on disk, served
// directly by nginx as part of the apps/web Vite build output. Mirrors the
// path-traversal guard convention from routes/uploads.ts (resolved path must
// start with the target base dir) against a new base dir: the sibling
// apps/web package instead of apps/api's own uploads/ dir.
import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import DOMPurify from 'isomorphic-dompurify'
import { ContentPage, type IContentPage } from '../models/ContentPage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// apps/api/dist/lib/staticPages.js -> ../../../web = apps/web
const WEB_ROOT = path.resolve(__dirname, '../../../web')
const PUBLIC_DIRS = [path.join(WEB_ROOT, 'public'), path.join(WEB_ROOT, 'dist')]

const SITE_URL = 'https://nextaibuilder.com'
const SITE_NAME = 'nextaibuilder'
const SITE_TAGLINE = 'AI product cohorts that ship'

function webRootAvailable(): boolean {
  if (!existsSync(WEB_ROOT)) {
    console.warn(`[staticPages] apps/web not found at ${WEB_ROOT} — skipping static file write (expected in local/dev environments).`)
    return false
  }
  return true
}

/** Resolves `<base>/<section>/<slug>.html`, guarding against path traversal. */
function resolveTarget(baseDir: string, section: string, slug: string): string {
  const target = path.resolve(baseDir, section, `${slug}.html`)
  const sectionDir = path.resolve(baseDir, section)
  if (!target.startsWith(sectionDir + path.sep)) {
    throw new Error(`Refusing to write outside ${sectionDir}: ${target}`)
  }
  return target
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pageHtml(pageDoc: IContentPage): string {
  const title = pageDoc.title
  const description = pageDoc.description
  const url = `${SITE_URL}/${pageDoc.section}/${pageDoc.slug}.html`
  const sectionLabel = pageDoc.section === 'guides' ? 'Guides' : 'Resources'
  const bodyHtml = DOMPurify.sanitize(pageDoc.bodyHtml, { USE_PROFILES: { html: true } })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    ...(pageDoc.publishedAt ? { datePublished: pageDoc.publishedAt.toISOString() } : {}),
    dateModified: pageDoc.updatedAt.toISOString(),
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — ${SITE_NAME}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${url}" />

<meta property="og:type" content="article" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${SITE_URL}/og-image.png" />
<meta property="og:site_name" content="${SITE_NAME}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${SITE_URL}/og-image.png" />

<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

<style>
  :root {
    --navy: #1a2744; --blue: #4a9ad4; --pale: #a8d4f0; --orange: #ff8c5a;
    --muted: #717182; --bg-muted: #f8f9fb; --border: rgba(0,0,0,0.1);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: 'Inter', system-ui, sans-serif; color: var(--navy);
    background: #ffffff; line-height: 1.6; font-size: 17px;
  }
  header { border-bottom: 1px solid var(--border); padding: 20px 24px; }
  header a.brand { color: var(--navy); text-decoration: none; font-weight: 800; font-size: 18px; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
  .kicker { color: var(--blue); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 13px; margin-bottom: 12px; }
  h1 { font-size: 2.1rem; font-weight: 800; line-height: 1.25; margin: 0 0 16px; }
  .dek { color: var(--muted); font-size: 1.15rem; margin: 0 0 40px; }
  article h2 { font-size: 1.5rem; font-weight: 700; margin: 40px 0 16px; }
  article h3 { font-size: 1.2rem; font-weight: 700; margin: 28px 0 12px; }
  article p { margin: 0 0 18px; }
  article ul, article ol { margin: 0 0 18px; padding-left: 24px; }
  article li { margin-bottom: 8px; }
  article img { max-width: 100%; border-radius: 10px; }
  article code { background: var(--bg-muted); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  article pre { background: #1a2744; color: #eef6fd; padding: 16px 18px; border-radius: 10px; overflow-x: auto; }
  article pre code { background: none; padding: 0; color: inherit; }
  article a { color: var(--blue); }
  article blockquote { border-left: 3px solid var(--pale); margin: 0 0 18px; padding: 4px 0 4px 18px; color: var(--muted); }
  .cta { margin-top: 56px; padding: 28px; border-radius: 14px; background: var(--bg-muted); border: 1px solid var(--border); }
  .cta a.btn { display: inline-block; margin-top: 12px; background: var(--navy); color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; }
  footer { border-top: 1px solid var(--border); padding: 32px 24px; text-align: center; color: var(--muted); font-size: 14px; }
  footer a { color: var(--muted); }
</style>
</head>
<body>
<header><a class="brand" href="/">${SITE_NAME}</a></header>
<main>
  <div class="kicker">${sectionLabel}</div>
  <article>
    <h1>${escapeHtml(title)}</h1>
    <p class="dek">${escapeHtml(description)}</p>
    ${bodyHtml}
    <div class="cta">
      <strong>Want to build this for real?</strong> nextaibuilder runs live and recorded cohorts on shipping production AI products with the Claude API.
      <br /><a class="btn" href="/">See the cohorts</a>
    </div>
  </article>
</main>
<footer>
  <a href="/">${SITE_NAME}</a> · <a href="/guides/">Guides</a> · <a href="/resources/">Resources</a>
</footer>
</body>
</html>
`
}

function indexHtml(label: string, pages: IContentPage[]): string {
  const items = pages
    .map(
      (p) => `
    <li>
      <a href="/${p.section}/${p.slug}.html">${escapeHtml(p.title)}</a>
      <p>${escapeHtml(p.description)}</p>
    </li>`,
    )
    .join('')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${label} — ${SITE_NAME}</title>
<meta name="description" content="${label} from ${SITE_NAME}: ${SITE_TAGLINE}." />
<link rel="canonical" href="${SITE_URL}/${label.toLowerCase()}/" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', system-ui, sans-serif; color: #1a2744; background: #fff; line-height: 1.6; }
  header { border-bottom: 1px solid rgba(0,0,0,0.1); padding: 20px 24px; }
  header a.brand { color: #1a2744; text-decoration: none; font-weight: 800; font-size: 18px; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
  h1 { font-size: 2rem; font-weight: 800; margin: 0 0 32px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 20px 0; border-bottom: 1px solid rgba(0,0,0,0.08); }
  li a { color: #1a2744; text-decoration: none; font-size: 1.15rem; font-weight: 700; }
  li a:hover { color: #4a9ad4; }
  li p { color: #717182; margin: 6px 0 0; }
  footer { border-top: 1px solid rgba(0,0,0,0.1); padding: 32px 24px; text-align: center; color: #717182; font-size: 14px; }
  footer a { color: #717182; }
</style>
</head>
<body>
<header><a class="brand" href="/">${SITE_NAME}</a></header>
<main>
  <h1>${label}</h1>
  <ul>${items || '<li><p>Nothing published yet — check back soon.</p></li>'}</ul>
</main>
<footer><a href="/">${SITE_NAME}</a> · <a href="/guides/">Guides</a> · <a href="/resources/">Resources</a></footer>
</body>
</html>
`
}

/** Writes the live HTML for a just-published page into public/ and dist/. */
export async function writePublishedPage(pageDoc: IContentPage): Promise<void> {
  if (!webRootAvailable()) return
  const html = pageHtml(pageDoc)
  for (const baseDir of PUBLIC_DIRS) {
    const target = resolveTarget(baseDir, pageDoc.section, pageDoc.slug)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, html)
  }
}

/** Removes the static HTML for an unpublished/deleted page from public/ and dist/. */
export async function removePublishedPage(section: string, slug: string): Promise<void> {
  if (!webRootAvailable()) return
  for (const baseDir of PUBLIC_DIRS) {
    const target = resolveTarget(baseDir, section, slug)
    await unlink(target).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err
    })
  }
}

/**
 * Rebuilds sitemap.xml, robots.txt, llms.txt, and the /guides//resources/
 * index pages from the current set of published pages in the DB. Call after
 * every publish/unpublish/delete so these stay authoritative.
 */
export async function regenerateIndexes(): Promise<void> {
  if (!webRootAvailable()) return

  const published = await ContentPage.find({ status: 'published' }).sort({ publishedAt: -1 })
  const guides = published.filter((p) => p.section === 'guides')
  const resources = published.filter((p) => p.section === 'resources')

  const staticUrls = [`${SITE_URL}/`, `${SITE_URL}/guides/`, `${SITE_URL}/resources/`]
  const urlEntries = [
    ...staticUrls.map((u) => `  <url><loc>${u}</loc></url>`),
    ...published.map((p) => {
      const lastmod = (p.publishedAt ?? p.updatedAt).toISOString().slice(0, 10)
      return `  <url><loc>${SITE_URL}/${p.section}/${p.slug}.html</loc><lastmod>${lastmod}</lastmod></url>`
    }),
  ].join('\n')
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`

  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`

  const llmsLines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_TAGLINE}. Live and recorded cohorts that teach you to ship production AI products with the Anthropic Claude API, from prompts to pipelines.`,
    '',
    `Home: ${SITE_URL}/`,
    '',
  ]
  if (guides.length) {
    llmsLines.push('## Guides', '')
    for (const g of guides) llmsLines.push(`- [${g.title}](${SITE_URL}/guides/${g.slug}.html): ${g.description}`)
    llmsLines.push('')
  }
  if (resources.length) {
    llmsLines.push('## Resources', '')
    for (const r of resources) llmsLines.push(`- [${r.title}](${SITE_URL}/resources/${r.slug}.html): ${r.description}`)
    llmsLines.push('')
  }
  const llms = llmsLines.join('\n')

  const guidesIndex = indexHtml('Guides', guides)
  const resourcesIndex = indexHtml('Resources', resources)

  for (const baseDir of PUBLIC_DIRS) {
    await mkdir(path.join(baseDir, 'guides'), { recursive: true })
    await mkdir(path.join(baseDir, 'resources'), { recursive: true })
    await writeFile(path.join(baseDir, 'sitemap.xml'), sitemap)
    await writeFile(path.join(baseDir, 'robots.txt'), robots)
    await writeFile(path.join(baseDir, 'llms.txt'), llms)
    await writeFile(path.join(baseDir, 'guides', 'index.html'), guidesIndex)
    await writeFile(path.join(baseDir, 'resources', 'index.html'), resourcesIndex)
  }
}
