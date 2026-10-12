/**
 * Automated checks for TEST-CASES.md.
 *
 *   node qa.mjs                                   local (wp-env): all automated cases
 *   NAB_URL=https://nextaibuilder.com node qa.mjs live site: read-only cases only
 *
 * Writes report.md and results.json next to this file. Exits 1 on any FAIL.
 * Needs Chrome (CHROME=/path/to/chrome to override) and, for local runs, wp-env.
 */
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const BASE = (process.env.NAB_URL || 'http://localhost:8895').replace(/\/$/, '');
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const PHONES = [320, 360, 390, 414];
const WIDTHS = [...PHONES, 768, 1024, 1280, 1440, 1920];
const ARTICLES = ['/guides/ship-production-ai-product-claude-api/', '/resources/claude-api-prompt-debugging-checklist/', '/guides/claude-api-tutorial/', '/guides/build-ai-agent-with-claude/', '/guides/mcp-explained/'];
const LIVE = '/courses/build-production-ready-ai-agents-live/';
const RECORDED = '/courses/build-production-ready-ai-agents-recorded/';
const PAGES = ['/', '/courses/', '/courses/?format=live', LIVE, RECORDED, '/guides/', '/resources/', ...ARTICLES, '/about/', '/apply/', '/refund-policy/', '/sign-in/', '/setup/', '/qa-no-such-page/'];
const STUDENT = ['/dashboard/', '/setup/', '/notifications/', '/certificates/', '/live-sessions/', '/book-a-call/'];

const results = [];
const record = (id, title, issues, note = '') => {
  const list = [...new Set(issues)];
  results.push({ id, title, status: list.length ? 'FAIL' : 'PASS', issues: list.slice(0, 15), more: Math.max(0, list.length - 15), note });
  console.log(`${list.length ? 'FAIL' : 'PASS'} ${id} ${title}${list.length ? '\n     - ' + list.slice(0, 6).join('\n     - ') : ''}`);
};
const skip = (id, title, why) => { results.push({ id, title, status: 'SKIP', issues: [], note: why }); console.log(`SKIP ${id} ${title} (${why})`); };
const wp = (cmd) => execSync(`npx @wordpress/env run cli ${cmd}`, { cwd: new URL('../..', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const newPage = async (w, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768, ...opts });
  return ctx.newPage();
};
const go = async (page, path) => {
  const res = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 });
  // Load lazy images: scroll to the bottom and back.
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  // Wait for lazy images that started loading during the scroll.
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 8000); })))));
  await page.waitForTimeout(300);
  return res;
};

/* ------------------------------------------------ A. every page, every width */
const A = { A1: [], A2: [], A3: [], A4: [], A5: [], A6: [], A7: [], A8: [], A9: [], A10: [], A12: [] };
const pageMeta = {};
const internalLinks = new Set();
for (const w of WIDTHS) {
  const page = await newPage(w);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`JS error: ${e.message.slice(0, 90)}`));
  page.on('response', (r) => { const u = r.url(); if (r.status() >= 400 && !u.includes('qa-no-such-page') && !/google-analytics|googletagmanager/.test(u)) errors.push(`${r.status()} ${u.replace(BASE, '')}`); });
  for (const path of PAGES) {
    errors.length = 0;
    const res = await go(page, path);
    const tag = `${path} @${w}`;
    if (w === 1440) {
      const want = path.includes('no-such-page') ? 404 : 200;
      if (res.status() !== want) A.A1.push(`${path}: HTTP ${res.status()} (want ${want})`);
      const html = await page.content();
      const m = html.match(/<b>(Warning|Notice|Deprecated|Fatal error)<\/b>:[^<]{0,80}/);
      if (m) A.A1.push(`${path}: PHP ${m[0].replace(/<\/?b>/g, '')}`);
    }
    const r = await page.evaluate(({ w, phone }) => {
      const out = { sw: document.documentElement.scrollWidth, over: [], img: [], suspect: [], small: [], tap: [], h1: 0, skips: [], empty: [], header: 0, links: [] };
      const clipped = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(e).overflowX)) return true; return false; };
      const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
      const name = (el) => el.tagName.toLowerCase() + (el.classList[0] ? '.' + el.classList[0] : '');
      const decorative = (el) => el.closest('[aria-hidden="true"], .nab-ui, [class*="nab-ui-"], .nab-hero__demo, .nab-logo, .nab-logos, .nab-term, .nab-mock, .nab-cert-mock');
      for (const el of document.body.querySelectorAll('*')) {
        if (!visible(el)) continue;
        const rc = el.getBoundingClientRect(); const s = getComputedStyle(el);
        if ((rc.right > w + 1 || rc.left < -1) && s.position !== 'fixed' && !clipped(el)) out.over.push(name(el));
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
        if (phone && ownText && parseFloat(s.fontSize) < 12 && !decorative(el)) out.small.push(`${name(el)} ${s.fontSize} "${el.textContent.trim().slice(0, 25)}"`);
        if (phone && el.matches('button, [role=button], summary, .wp-block-button__link, .nab-btn, nav a, header a, input[type=submit]') && !el.closest('p, li p, td') && (rc.height < 44 && rc.width < 44 || rc.height < 24) && !decorative(el)) {
          // A target counts as big enough if its tappable box (padding included) reaches 44px.
          out.tap.push(`${name(el)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}" ${Math.round(rc.width)}x${Math.round(rc.height)}`);
        }
      }
      for (const img of document.images) {
        if (!visible(img)) continue;
        if (!img.complete || !img.naturalWidth) out.suspect.push(img.currentSrc || img.src);
        if (!img.hasAttribute('alt')) out.img.push(`no alt: ${(img.currentSrc || img.src).split('/').pop()}`);
      }
      out.h1 = [...document.querySelectorAll('h1')].filter(visible).length;
      let prev = 1;
      for (const h of document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6, .wp-site-blocks > :not(header):not(footer) :is(h1,h2,h3,h4,h5,h6)')) {
        if (getComputedStyle(h).display === 'none' || h.closest('footer, header, [aria-hidden="true"]')) continue;
        const lvl = +h.tagName[1]; if (lvl > prev + 1) out.skips.push(`h${prev}→h${lvl} "${h.textContent.trim().slice(0, 30)}"`); prev = lvl;
      }
      // A section whose only content is its heading block.
      for (const sec of document.querySelectorAll('main section, .wp-site-blocks > section, .wp-site-blocks section.nab-band')) {
        if (!visible(sec)) continue;
        const head = sec.querySelector('.nab-band__head');
        if (!head) continue;
        const rest = [...sec.children].filter((c) => c !== head && visible(c));
        if (!rest.length) out.empty.push(`"${head.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}"`);
      }
      const hdr = document.querySelector('.nab-header'); if (hdr) out.header = Math.round(hdr.getBoundingClientRect().height);
      out.links = [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => h.startsWith(location.origin) && !h.includes('/wp-admin') && !h.includes('logout'));
      return out;
    }, { w, phone: w < 768 });
    // An image interrupted mid-load reports as broken; only count it if a fresh load fails too.
    for (const src of r.suspect) {
      const ok = await page.evaluate((src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = src + (src.includes('?') ? '&' : '?') + 'qa=' + Date.now(); setTimeout(() => res(false), 10000); }), src);
      if (!ok) r.img.push(`broken: ${src}`);
    }
    if (!path.includes('no-such-page')) r.links.forEach((l) => internalLinks.add(l.split('#')[0]));
    if (r.sw > w) A.A2.push(`${tag}: page is ${r.sw}px wide`);
    if (r.over.length) A.A3.push(`${tag}: ${[...new Set(r.over)].slice(0, 4).join(', ')}`);
    r.img.forEach((i) => A.A4.push(`${path}: ${i}`));
    if (r.small.length) A.A5.push(`${tag}: ${r.small.slice(0, 3).join(' | ')}`);
    r.tap.forEach((t) => A.A6.push(`${path} @${w}: ${t}`));
    if (w === 1440 && r.h1 !== 1) A.A7.push(`${path}: ${r.h1} visible <h1>`);
    if (w === 1440) r.skips.forEach((s) => A.A7.push(`${path}: heading skip ${s}`));
    r.empty.forEach((e) => A.A8.push(`${path}: empty section ${e}`));
    errors.forEach((e) => A.A9.push(`${tag}: ${e}`));
    if (r.header > 90) A.A10.push(`${tag}: header is ${r.header}px tall (wrapped)`);
    if (!LOCAL && w === 1440) {
      const text = await page.evaluate(() => document.body.innerText);
      for (const claim of ['Sarah Chen', 'Marcus Patel', 'Priya Krishnan', '4.9 out of 5', '126 reviews', 'Support triage agent', '400+ students']) if (text.includes(claim)) A.A12.push(`${path}: shows demo claim "${claim}"`);
    }
  }
  await page.context().close();
}
record('A1', 'Pages load without errors', A.A1);
record('A2', 'No sideways scroll at any width', A.A2);
record('A3', 'Nothing spills off screen', A.A3);
record('A4', 'Images load and have alt text', A.A4);
record('A5', 'Text is at least 12px on phones', A.A5);
record('A6', 'Tap targets at least 44px on phones', A.A6);
record('A7', 'One H1, no skipped heading levels', A.A7);
record('A8', 'No empty sections', A.A8);
record('A9', 'No JS errors or failed requests', A.A9);
record('A10', 'Header stays on one row', A.A10);
if (LOCAL) skip('A12', 'No demo claims on the live site', 'live site only'); else record('A12', 'No demo claims on the live site', A.A12);

/* ------------------------------------------------ B. navigation */
{
  const page = await newPage(390);
  await go(page, '/');
  const issues = [];
  await page.click('.wp-block-navigation__responsive-container-open');
  await page.waitForTimeout(500);
  const open = await page.evaluate(() => { const c = document.querySelector('.wp-block-navigation__responsive-container.is-menu-open'); if (!c) return null; const r = c.getBoundingClientRect(); return { h: r.height, links: [...c.querySelectorAll('a')].filter((a) => { const q = a.getBoundingClientRect(); return q.bottom <= innerHeight && q.height > 0; }).map((a) => a.textContent.trim()) }; });
  if (!open) issues.push('menu did not open');
  else { if (open.h < 800) issues.push(`open menu only ${Math.round(open.h)}px tall`); if (open.links.length < 5) issues.push(`only ${open.links.length} links visible: ${open.links.join(', ')}`); }
  record('B1', 'Phone menu opens full-screen with all links', issues);
  const b2 = [];
  await page.click('.wp-block-navigation__responsive-container-close'); await page.waitForTimeout(400);
  if (await page.$('.is-menu-open')) b2.push('menu still open after tapping ✕');
  record('B2', 'Phone menu closes with ✕', b2);
  const b3 = [];
  await page.click('.wp-block-navigation__responsive-container-open'); await page.waitForTimeout(400);
  await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => b3.push('no navigation')), page.click('.is-menu-open a:has-text("Guides")')]);
  if (!page.url().includes('/guides/')) b3.push(`landed on ${page.url()}`);
  record('B3', 'Menu link navigates', b3);
  const b4 = [];
  await go(page, '/');
  await page.click('.wp-block-navigation__responsive-container-open'); await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  if (await page.$('.is-menu-open')) b4.push('Esc does not close the menu');
  record('B4', 'Esc closes the menu', b4);
  const b5 = [];
  await page.evaluate(() => window.scrollTo(0, 2500)); await page.waitForTimeout(300);
  const top = await page.evaluate(() => document.querySelector('.nab-header').getBoundingClientRect().top);
  if (Math.abs(top) > 2) b5.push(`header top is ${Math.round(top)}px after scrolling`);
  record('B5', 'Header sticks to the top', b5);
  await page.context().close();
}
{
  const issues = [];
  const links = [...internalLinks].filter((l) => !/\/(cart|checkout|my-account)\/?\?|add-to-cart|wp-login|\/feed\//.test(l));
  for (const l of links) {
    let url = l, hops = 0, status;
    for (; hops < 4; hops++) {
      const res = await fetch(url, { redirect: 'manual' });
      status = res.status;
      if (status >= 300 && status < 400) url = new URL(res.headers.get('location'), url).href; else break;
    }
    if (status >= 400) issues.push(`${l.replace(BASE, '')} → ${status}`);
    else if (hops > 1) issues.push(`${l.replace(BASE, '')} → ${hops} redirects`);
  }
  record('B6', `Every internal link resolves (${links.length} links)`, issues);
}
{
  const issues = [];
  for (const [from, to] of [['/guides/claude-api-tutorial.html', '/guides/claude-api-tutorial/'], ['/shop/', null]]) {
    const res = await fetch(BASE + from, { redirect: 'manual' });
    if (res.status !== 301) issues.push(`${from}: ${res.status} (want 301)`);
    else if (to && !res.headers.get('location').endsWith(to)) issues.push(`${from} → ${res.headers.get('location')}`);
  }
  record('B7', 'Old URLs redirect', issues);
}
{
  const page = await newPage(1440);
  await go(page, '/');
  const issues = [];
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { t: a.textContent.trim(), w: r.width }; });
  if (!/skip/i.test(first.t) || first.w < 20) issues.push(`first Tab: "${first.t}" (${Math.round(first.w)}px wide)`);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); return { n: a.tagName + ' "' + (a.textContent || a.value || '').trim().slice(0, 20) + '"', ring: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' }; });
    if (!f.ring) issues.push(`no focus ring: ${f.n}`);
  }
  record('B8', 'Keyboard: skip link and focus rings', issues);
  await page.context().close();
}

/* ------------------------------------------------ C. homepage */
{
  const page = await newPage(1440);
  await go(page, '/');
  const hrefOf = (text) => page.evaluate((t) => [...document.querySelectorAll('a')].filter((a) => a.textContent.trim().toLowerCase() === t.toLowerCase()).map((a) => a.getAttribute('href')), text);
  const c1 = (await hrefOf('Join the live cohort'));
  record('C1', 'Hero "Join the live cohort" goes to the live course', c1.length && c1.every((h) => h.includes('live')) ? [] : [`hrefs: ${c1.join(', ') || 'none'}`]);
  const c2 = [];
  const cur = (await hrefOf('See the curriculum'))[0];
  if (!cur) c2.push('button missing');
  else if (cur.startsWith('#') && !(await page.$(cur))) c2.push(`target ${cur} not on the page`);
  record('C2', '"See the curriculum" target exists', c2);
  const c3 = [];
  const n = await page.$$eval('details', (d) => d.length);
  if (n !== 13) c3.push(`${n} FAQ questions (want 13)`);
  for (let i = 0; i < n; i++) {
    const s = (await page.$$('details > summary'))[i];
    await s.scrollIntoViewIfNeeded(); await s.click(); await page.waitForTimeout(80);
    const open = await page.evaluate((i) => document.querySelectorAll('details')[i].open, i);
    if (!open) c3.push(`question ${i + 1} does not open`);
    await s.click(); await page.waitForTimeout(50);
    if (await page.evaluate((i) => document.querySelectorAll('details')[i].open, i)) c3.push(`question ${i + 1} does not close`);
  }
  record('C3', 'FAQ questions open and close', c3);
  const sp = [...(await hrefOf('Start self-paced')), ...(await hrefOf('Start self-paced today'))];
  record('C4', 'Pricing/CTA buttons go to the right course', sp.length && sp.every((h) => h.includes('recorded')) ? [] : [`self-paced hrefs: ${sp.join(', ') || 'none'}`]);
  await page.context().close();
}

/* ------------------------------------------------ D. courses */
{
  const page = await newPage(1440);
  const d1 = [];
  for (const [q, want] of [['', 2], ['?format=live', 1], ['?format=recorded', 1]]) {
    await go(page, '/courses/' + q);
    const cards = await page.$$eval('main article, .nab-course-card, .nab-courses > *', (c) => c.length);
    if (cards !== want && cards) d1.push(`/courses/${q}: ${cards} cards (want ${want})`);
  }
  record('D1', 'Course list filters', LOCAL ? [] : d1, LOCAL ? 'local has extra June 2026 courses; checked on live' : '');
  await go(page, LIVE);
  const d2 = [];
  const det = await page.$$('main details > summary');
  if (!det.length) d2.push('no expandable syllabus weeks');
  for (const s of det.slice(0, 5)) { await s.scrollIntoViewIfNeeded(); const before = await s.evaluate((x) => x.parentElement.open); await s.click(); await page.waitForTimeout(80); if (before === (await s.evaluate((x) => x.parentElement.open))) d2.push(`"${(await s.textContent()).trim().slice(0, 30)}" does not toggle`); }
  const free = await page.$$eval('a', (as) => as.filter((a) => /watch free/i.test(a.textContent)).map((a) => a.href));
  for (const f of free) { const r = await fetch(f); if (r.status !== 200) d2.push(`free preview ${f.replace(BASE, '')} → ${r.status}`); }
  record('D2', 'Syllabus weeks toggle, free preview opens', d2);
  const d3 = [];
  const liveText = await page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText);
  if (!liveText.includes('$3,000') || !liveText.includes('$1,000')) d3.push('live page missing $3,000 / $1,000');
  await go(page, RECORDED);
  const recText = await page.evaluate(() => document.body.innerText);
  if (!recText.includes('$200') || !recText.includes('$67')) d3.push('recorded page missing $200 / $67');
  record('D3', 'Prices shown correctly', d3);
  await page.context().close();
  const ph = await newPage(390);
  await go(ph, LIVE);
  const d4 = [];
  await ph.evaluate(() => window.scrollTo(0, 1500)); await ph.waitForTimeout(400);
  const bar = await ph.evaluate(() => { const b = document.querySelector('.nab-cp-bar'); if (!b) return null; const r = b.getBoundingClientRect(); return { vis: getComputedStyle(b).display !== 'none' && r.top < innerHeight, h: r.height }; });
  if (!bar?.vis) d4.push('sticky enroll bar not visible after scrolling');
  await ph.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await ph.waitForTimeout(400);
  const covered = await ph.evaluate(() => { const b = document.querySelector('.nab-cp-bar'); const last = [...document.querySelectorAll('footer a')].pop(); if (!b || !last) return false; const br = b.getBoundingClientRect(); const lr = last.getBoundingClientRect(); return getComputedStyle(b).display !== 'none' && br.top < innerHeight && lr.bottom > br.top; });
  if (covered) d4.push('sticky bar covers the last footer links at the bottom of the page');
  record('D4', 'Phone sticky enroll bar', d4);
  await ph.context().close();
}

/* ------------------------------------------------ F/H. sign-in and forms (read-only part) */
{
  const page = await newPage(390);
  await go(page, '/sign-in/');
  const f1 = [];
  const has = await page.evaluate(() => ({ google: !![...document.querySelectorAll('a')].find((a) => /google/i.test(a.textContent)), magic: !!document.querySelector('#nab-magic-email'), pass: !!document.querySelector('#user_pass') }));
  for (const [k, v] of Object.entries(has)) if (!v) f1.push(`${k} sign-in option missing`);
  record('F1', 'Sign-in shows Google, email link and password', f1);
  const f7 = [];
  for (const p of STUDENT) {
    const res = await fetch(BASE + p, { redirect: 'manual' });
    const loc = res.headers.get('location') || '';
    if (res.status >= 300 && res.status < 400) { if (!/sign-in|wp-login/.test(loc)) f7.push(`${p} → ${loc}`); }
    else if (res.status === 200) { const t = await res.text(); if (!/sign-in|loginform|Sign in/i.test(t)) f7.push(`${p} shows content to signed-out visitors`); }
    else f7.push(`${p} → ${res.status}`);
  }
  record('F7', 'Student pages ask signed-out visitors to sign in', f7);
  await go(page, '/apply/');
  const h1 = [];
  const valid = await page.evaluate(() => document.querySelector('form.nab-apply').checkValidity());
  if (valid) h1.push('empty application form passes validation');
  await page.fill('form.nab-apply [name=email]', 'not-an-email');
  if (await page.evaluate(() => document.querySelector('form.nab-apply [name=email]').checkValidity())) h1.push('invalid email accepted');
  record('H1', 'Apply form validates before sending', h1);
  const h4 = [];
  for (const p of ['/apply/', '/sign-in/']) {
    await go(page, p);
    const missing = await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([name=website]), select, textarea')].filter((el) => getComputedStyle(el).display !== 'none' && !(el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))).map((el) => el.name || el.id));
    missing.forEach((m) => h4.push(`${p}: field "${m}" has no label`));
  }
  record('H4', 'Form fields have labels', h4);
  await page.context().close();
}

/* ------------------------------------------------ I. SEO */
{
  const titles = {}, descs = {};
  const i1 = [], i2 = [], i4 = [], i5 = [];
  for (const p of PAGES.filter((p) => !p.includes('no-such') && !p.includes('?') && p !== '/setup/')) {
    const html = await (await fetch(BASE + p)).text();
    if (/<meta name=['"]robots['"] content=['"][^'"]*noindex/.test(html)) continue; // not in search results
    const title = (html.match(/<title>([^<]*)/) || [])[1];
    const desc = (html.match(/<meta name="description" content="([^"]*)/) || [])[1];
    const canon = (html.match(/<link rel="canonical" href="([^"]*)/) || [])[1];
    if (!title) i1.push(`${p}: no title`); else (titles[title] ||= []).push(p);
    if (!desc) i1.push(`${p}: no meta description`); else { (descs[desc] ||= []).push(p); if (desc.length < 70 || desc.length > 200) i1.push(`${p}: description ${desc.length} chars`); }
    if (!canon) i2.push(`${p}: no canonical`); else if (canon !== BASE + p && canon !== (BASE + p).replace('http://', 'https://')) i2.push(`${p}: canonical ${canon}`);
    for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch { i4.push(`${p}: JSON-LD does not parse`); } }
    const types = [...html.matchAll(/"@type":\s*"([A-Za-z]+)"/g)].map((m) => m[1]);
    if (p === '/' && !types.includes('FAQPage')) i4.push('/: no FAQPage');
    if (p.startsWith('/courses/b') && !types.includes('Course')) i4.push(`${p}: no Course`);
    if (ARTICLES.includes(p) && !types.some((t) => /Article/.test(t))) i4.push(`${p}: no Article`);
    for (const og of ['og:title', 'og:description', 'og:image']) if (!html.includes(`property="${og}"`)) i5.push(`${p}: no ${og}`);
    const img = (html.match(/property="og:image" content="([^"]*)/) || [])[1];
    if (img && (await fetch(img)).status !== 200) i5.push(`${p}: og:image does not load`);
  }
  Object.entries(titles).filter(([, v]) => v.length > 1).forEach(([t, v]) => i1.push(`duplicate title "${t.slice(0, 40)}": ${v.join(', ')}`));
  Object.entries(descs).filter(([, v]) => v.length > 1).forEach(([, v]) => i1.push(`duplicate description: ${v.join(', ')}`));
  record('I1', 'Unique titles and descriptions', i1);
  record('I2', 'Canonical tags', i2);
  const i3 = [];
  for (const f of ['/robots.txt', '/wp-sitemap.xml', '/llms.txt']) { const r = await fetch(BASE + f); if (r.status !== 200) i3.push(`${f} → ${r.status}`); }
  record('I3', 'robots.txt, sitemap, llms.txt', i3);
  record('I4', 'Structured data', i4);
  record('I5', 'Social preview tags', i5);
}

/* ------------------------------------------------ J. live-site security */
if (!LOCAL) {
  const j2 = [];
  const h = (await fetch(BASE + '/')).headers;
  for (const k of ['strict-transport-security', 'x-content-type-options', 'referrer-policy']) if (!h.get(k)) j2.push(`missing ${k}`);
  if (!h.get('x-frame-options') && !/frame-ancestors/.test(h.get('content-security-policy') || '')) j2.push('missing frame protection');
  record('J2', 'Security headers', j2);
  const j3 = [];
  for (const u of ['http://nextaibuilder.com/', 'https://www.nextaibuilder.com/', 'http://www.nextaibuilder.com/']) {
    let url = u, hops = 0;
    for (; hops < 4; hops++) { const r = await fetch(url, { redirect: 'manual' }); if (r.status < 300 || r.status >= 400) break; url = new URL(r.headers.get('location'), url).href; }
    if (url !== 'https://nextaibuilder.com/') j3.push(`${u} ends at ${url}`);
    else if (hops > 1) j3.push(`${u} takes ${hops} redirects (one is better)`);
  }
  record('J3', 'http and www redirect to https://nextaibuilder.com', j3);
  const j4 = [];
  const users = await fetch(BASE + '/wp-json/wp/v2/users');
  if (users.status === 200) { const j = await users.json(); if (Array.isArray(j) && j.length) j4.push(`lists ${j.length} users`); }
  record('J4', 'REST API does not list users', j4);
  const j5 = [];
  const a = await fetch(BASE + '/?author=1', { redirect: 'manual' });
  if (/\/author\//.test(a.headers.get('location') || '')) j5.push(`?author=1 → ${a.headers.get('location')}`);
  record('J5', 'Author enumeration blocked', j5);
} else ['J2', 'J3', 'J4', 'J5'].forEach((id) => skip(id, 'Security checks', 'live site only'));

/* ------------------------------------------------ Local-only flows (create data) */
if (LOCAL) {
  const login = `qa_${randomBytes(3).toString('hex')}`;
  const pass = randomBytes(12).toString('base64url');
  const email = `${login}@example.test`;
  const uid = wp(`wp user create ${login} ${email} --role=customer --user_pass=${pass} --first_name=QA --porcelain`);
  const recordedCourse = wp(`wp post list --post_type=courses --name=build-production-ready-ai-agents-recorded --field=ID`);
  const signIn = async (page, extra = '') => {
    await go(page, '/sign-in/' + extra);
    await page.click('.nab-signin__password > summary');
    await page.fill('#user_login', login); await page.fill('#user_pass', pass);
    await Promise.all([page.waitForNavigation({ timeout: 30000 }), page.click('#wp-submit')]);
  };
  try {
    // F2 wrong password
    {
      const page = await newPage(390); await go(page, '/sign-in/');
      await page.click('.nab-signin__password > summary');
      await page.fill('#user_login', login); await page.fill('#user_pass', 'wrong-' + pass);
      await Promise.all([page.waitForNavigation({ timeout: 30000 }), page.click('#wp-submit')]);
      const t = await page.evaluate(() => document.body.innerText);
      const f2 = [];
      if (/dashboard/.test(page.url())) f2.push('signed in with a wrong password');
      if (!/don.t match|incorrect|error|not.*(valid|correct)/i.test(t)) f2.push(`no error message (on ${page.url().replace(BASE, '')})`);
      if (!/sign-in/.test(page.url())) f2.push(`left the sign-in page: ${page.url().replace(BASE, '')}`);
      record('F2', 'Wrong password shows an error', f2);
      await page.context().close();
    }
    // F3 + F4
    {
      const page = await newPage(390);
      await signIn(page);
      record('F3', 'Right password lands on the dashboard', /\/dashboard\//.test(page.url()) ? [] : [`landed on ${page.url().replace(BASE, '')}`]);
      await page.context().close();
      const p2 = await newPage(390);
      await signIn(p2, '?redirect_to=' + encodeURIComponent('https://evil.example/'));
      record('F4', 'Off-site redirect_to is ignored', p2.url().startsWith(BASE) ? [] : [`sent to ${p2.url()}`]);
      await p2.context().close();
    }
    // F5 magic link request
    {
      const page = await newPage(390); await go(page, '/sign-in/');
      await page.fill('#nab-magic-email', email);
      await Promise.all([page.waitForNavigation({ timeout: 30000 }), page.click('form:has(#nab-magic-email) button')]);
      const t = await page.evaluate(() => document.body.innerText);
      record('F5', 'Email sign-in link request', /check your (email|inbox)|sent|link/i.test(t) ? [] : ['no confirmation message after requesting a link']);
      await page.context().close();
    }
    // G: enroll the QA user, then the student pages
    wp(`wp eval '$e = tutor_utils()->do_enroll( ${recordedCourse}, 0, ${uid} ); tutor_utils()->course_enrol_status_change( $e, "completed" );'`);
    {
      const g1 = [], g2 = [], g6 = [], f8 = [];
      for (const w of [390, 768, 1440]) {
        const page = await newPage(w); await signIn(page);
        for (const p of STUDENT) {
          const res = await go(page, p);
          if (res.status() >= 400) g1.push(`${p} @${w}: HTTP ${res.status()}`);
          if (/sign-in/.test(page.url())) g1.push(`${p} @${w}: sent to sign-in while signed in`);
          const r = await page.evaluate((w) => ({ sw: document.documentElement.scrollWidth, php: /<b>(Warning|Notice|Fatal error)<\/b>/.test(document.documentElement.innerHTML) }), w);
          if (r.sw > w) g1.push(`${p} @${w}: page is ${r.sw}px wide`);
          if (r.php) g1.push(`${p} @${w}: PHP warning in page`);
        }
        if (w === 1440) {
          await go(page, '/dashboard/');
          const t = await page.evaluate(() => document.body.innerText);
          if (!/Build Production-Ready/i.test(t)) g1.push('dashboard does not show the enrolled course');
          // G2: second lesson locked.
          const lessons = JSON.parse(wp(`wp eval 'echo wp_json_encode( array_map( "get_permalink", array_slice( nab_course_lesson_ids( ${recordedCourse} ), 0, 2 ) ) );'`));
          const r1 = await go(page, new URL(lessons[0]).pathname);
          if (r1.status() !== 200) g2.push(`first lesson → ${r1.status()}`);
          await go(page, new URL(lessons[1]).pathname);
          const t2 = await page.evaluate(() => document.body.innerText);
          if (!/nab_locked=1/.test(page.url()) && !/locked/i.test(t2)) g2.push('second lesson opened while the first is unfinished');
          else if (!/still locked/i.test(t2)) g2.push('redirected without explaining the lesson is locked');
          if (!(await page.$('.nab-lock-badge'))) g2.push('locked lessons not marked in the sidebar');
          await go(page, '/notifications/');
          const tn = await page.evaluate(() => document.body.innerText);
          if (!/enrol/i.test(tn)) g6.push('no enrollment notification');
          // F8 sign out (the dashboard menu has the Logout link).
          await go(page, '/dashboard/');
          const out = await page.evaluate(() => [...document.querySelectorAll('a')].find((a) => /log ?out|sign out/i.test(a.textContent))?.href);
          if (!out) f8.push('no sign-out link on student pages');
          else { await page.goto(out, { waitUntil: 'networkidle' }); const confirm = await page.$('a:has-text("log out")'); if (confirm) await Promise.all([page.waitForNavigation(), confirm.click()]); const r = await fetch(BASE + '/dashboard/', { redirect: 'manual' }); await go(page, '/dashboard/'); if (!/sign-in|wp-login/.test(page.url()) && !/loginform|Sign in/i.test(await page.content())) f8.push('still signed in after signing out'); }
        }
        await page.context().close();
      }
      record('G1', 'Student pages work at phone/tablet/desktop', g1);
      record('G2', 'Lessons unlock in order', g2);
      record('G6', 'Notifications show enrollment', g6);
      record('F8', 'Sign out works', f8);
    }
    // G4 certificate verify with a made-up code
    {
      const r = await fetch(BASE + '/verify/QA-NOT-A-REAL-CODE-123/');
      const t = await r.text();
      record('G4', 'Fake certificate code is reported not found', /not found|no certificate|invalid|could not/i.test(t) ? [] : [`HTTP ${r.status}, no "not found" message`]);
    }
    // D5 + E1 + E4: enroll as a new visitor and pay by bank transfer
    {
      const page = await newPage(1440);
      await go(page, RECORDED);
      const d5 = [], e1 = [], e4 = [];
      const enroll = await page.$('a:has-text("Enroll"), a:has-text("Start self-paced"), button:has-text("Enroll")');
      if (!enroll) d5.push('no Enroll button');
      else {
        await Promise.all([page.waitForNavigation({ timeout: 30000 }), enroll.click()]);
        await page.waitForLoadState('networkidle');
        if (!/checkout/.test(page.url())) d5.push(`Enroll went to ${page.url().replace(BASE, '')}, not checkout`);
        // The summary first renders an empty placeholder with the same class; wait for real text.
        await page.waitForFunction(() => [...document.querySelectorAll('.wc-block-components-order-summary-item, .woocommerce-checkout-review-order-table')].some((e) => e.innerText.trim().length > 10), null, { timeout: 20000 }).catch(() => d5.push('order summary never finished loading'));
        const t = await page.evaluate(() => document.body.innerText);
        if (!/Build Production-Ready/i.test(t)) d5.push('course not in the order summary');
        const addr = await page.$$eval('input[name*="address"], input[name*="postcode"], input[name*="city"], input[id*="address"]', (els) => els.filter((e) => e.offsetParent).map((e) => e.name || e.id));
        if (addr.length) e1.push(`address fields shown: ${addr.join(', ')}`);
        const gateways = await page.$$eval('input[name="payment_method"], input[name="radio-control-wc-payment-method-options"]', (els) => els.map((e) => e.value));
        if (!gateways.length) e4.push('no payment methods offered');
        else if (!gateways.includes('bacs')) e4.push(`bank transfer not offered (methods: ${gateways.join(', ')})`);
        else {
          const fill = async (sel, v) => { const el = await page.$(sel); if (el) await el.fill(v); };
          await fill('#billing_first_name, #billing-first_name', 'QA'); await fill('#billing_last_name, #billing-last_name', 'Buyer');
          await fill('#billing_email, #email', `buyer_${login}@example.test`); await fill('#billing_phone, #billing-phone', '5555550100');
          await page.check('input[value="bacs"]');
          const terms = await page.$('#terms, input[name="terms"]'); if (terms) await terms.check();
          await Promise.all([page.waitForURL(/order-received/, { timeout: 45000 }).catch(() => e4.push(`order not placed (still on ${page.url().replace(BASE, '')})`)), page.click('#place_order, .wc-block-components-checkout-place-order-button')]);
          if (/order-received/.test(page.url())) {
            const t2 = await page.evaluate(() => document.body.innerText);
            if (!/bank|account number|IBAN|transfer/i.test(t2)) e4.push('thank-you page has no bank details');
            if (!(await page.$('input[type=file]'))) e4.push('no receipt upload on the thank-you page');
            else {
              // E5: wrong type rejected, PDF accepted.
              const e5 = [];
              const up = async (name, mime, buf) => { await page.setInputFiles('input[type=file]', { name, mimeType: mime, buffer: buf }); await Promise.all([page.waitForNavigation({ timeout: 30000 }), page.click('form:has(input[type=file]) button, form:has(input[type=file]) [type=submit]')]); return page.evaluate(() => document.body.innerText); };
              const bad = await up('receipt.exe', 'application/octet-stream', Buffer.from('MZ not a receipt'));
              if (!/not allowed|type|PDF|JPG|PNG|invalid/i.test(bad)) e5.push('wrong file type not clearly rejected');
              if (await page.$('input[type=file]')) {
                const ok = await up('receipt.pdf', 'application/pdf', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'));
                if (!/received|uploaded|review|thank/i.test(ok)) e5.push('PDF receipt upload not confirmed');
              }
              record('E5', 'Receipt upload accepts PDF, rejects other files', e5);
            }
          }
        }
      }
      record('D5', 'Enroll goes straight to checkout with the course', d5);
      record('E1', 'Checkout asks no address fields', e1);
      record('E4', 'Bank transfer order shows bank details and receipt upload', e4);
      await page.context().close();
    }
    // H2 apply form submission
    {
      const page = await newPage(390); await go(page, '/apply/');
      await page.fill('form.nab-apply [name=full_name]', 'QA Applicant');
      await page.fill('form.nab-apply [name=email]', `apply_${login}@example.test`);
      await page.fill('form.nab-apply [name=phone]', '5555550100');
      await Promise.all([page.waitForNavigation({ timeout: 30000 }), page.click('form.nab-apply button')]);
      const t = await page.evaluate(() => document.body.innerText);
      record('H2', 'Valid application is accepted', /thank|received|we.ll (be in touch|reply)|submitted/i.test(t) ? [] : [`no confirmation (on ${page.url().replace(BASE, '')})`]);
      await page.context().close();
    }
  } finally {
    try { wp(`wp user delete ${uid} --yes`); } catch {}
  }
}

await browser.close();
const fails = results.filter((r) => r.status === 'FAIL');
const md = [`# QA report: ${BASE}`, '', `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. ${results.filter((r) => r.status === 'PASS').length} pass, ${fails.length} fail, ${results.filter((r) => r.status === 'SKIP').length} skipped.`, '', '| ID | Test | Result | Details |', '|---|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.title} | ${r.status} | ${(r.issues.join('<br>') + (r.more ? `<br>…and ${r.more} more` : '') + (r.note ? ` _${r.note}_` : '')).replace(/\|/g, '\\|')} |`)].join('\n');
const tag = LOCAL ? 'local' : 'live';
writeFileSync(new URL(`report-${tag}.md`, import.meta.url), md + '\n');
writeFileSync(new URL(`results-${tag}.json`, import.meta.url), JSON.stringify(results, null, 1));
console.log(`\n${results.length - fails.length}/${results.length} not failing. Report: tools/qa/report-${tag}.md`);
process.exit(fails.length ? 1 : 0);
