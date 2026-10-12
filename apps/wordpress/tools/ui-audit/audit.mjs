/**
 * UI audit for the nextaibuilder WordPress site.
 *
 *   cd apps/wordpress/tools/ui-audit && npm install && npm run audit
 *
 * Checks every page at phone → desktop widths for:
 *   1. Sideways scrolling / content spilling past the screen edge
 *   2. Accessibility problems (axe-core: WCAG 2.2 AA + best practices)
 *   3. Keyboard focus: every tabbable element shows a focus ring
 *
 * Options (env):
 *   NAB_URL=http://localhost:8895   site to audit
 *   NAB_COOKIE="wordpress_logged_in_…=…"   also audit student pages (copy the
 *        cookie from a signed-in test student in your browser's dev tools)
 *   CHROME=google-chrome   browser binary
 *
 * Exits 1 when any page scrolls sideways or has a serious/critical axe issue.
 * Needs Node 22+ (built-in WebSocket) and Chrome.
 */
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.NAB_URL || 'http://localhost:8895';
const COOKIE = process.env.NAB_COOKIE || '';
const PUBLIC = ['/', '/courses/', '/courses/?format=live', '/guides/', '/resources/', '/about/', '/apply/', '/refund-policy/', '/sign-in/'];
const STUDENT = ['/dashboard/', '/setup/', '/notifications/', '/live-sessions/', '/book-a-call/', '/certificates/'];
const WIDTHS = [320, 390, 768, 1024, 1440];
const AXE_WIDTHS = [390, 1280];
const axeSrc = readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9222 + Math.floor(Math.random() * 500);
const chrome = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'nab-audit-'))}`, 'about:blank'], { stdio: 'ignore' });
let tabs;
for (let i = 0; i < 60 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(150); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0; const pending = {};
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d.result); delete pending[d.id]; } };
const send = (method, params = {}) => new Promise((r) => { pending[++seq] = r; ws.send(JSON.stringify({ id: seq, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
const size = (w) => send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
const open = async (path) => { await send('Page.navigate', { url: BASE + path }); await sleep(1500); };

if (COOKIE) {
  const host = new URL(BASE).hostname;
  for (const part of COOKIE.split(/;\s*/)) { const i = part.indexOf('='); await send('Network.setCookie', { name: part.slice(0, i), value: part.slice(i + 1), domain: host, path: '/' }); }
}
const pages = COOKIE ? [...PUBLIC, ...STUDENT] : PUBLIC;

const OVERFLOW = `(() => {
  const vw = document.documentElement.clientWidth;
  const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { if (/(hidden|auto|scroll|clip)/.test(getComputedStyle(a).overflowX)) { const r = a.getBoundingClientRect(); if (r.right <= vw + 1 && r.left >= -1) return true; } } return false; };
  const out = [...document.body.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height && (r.right > vw + 1 || r.left < -1) && !clipped(el); });
  const leaf = out.filter((e) => !out.some((o) => o !== e && e.contains(o)));
  return { scroll: document.documentElement.scrollWidth > vw + 1, items: leaf.slice(0, 4).map((e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/)[0] : '')) };
})()`;

let failed = false;
console.log(`Auditing ${pages.length} pages on ${BASE}${COOKIE ? ' (with student cookie)' : ''}\n`);

console.log('1. Responsive');
for (const w of WIDTHS) {
  await size(w);
  for (const p of pages) {
    await open(p);
    const r = await ev(OVERFLOW);
    if (r.scroll) { failed = true; console.log(`   ✗ ${w}px ${p} scrolls sideways: ${r.items.join(', ')}`); }
  }
}
console.log('   done');

console.log('\n2. Accessibility (axe)');
const agg = {};
for (const w of AXE_WIDTHS) {
  await size(w);
  for (const p of pages) {
    await open(p);
    await ev(axeSrc);
    const v = await ev(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice'] } }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => n.target.join(' ')) })))`);
    for (const x of v || []) { const a = (agg[x.id] ||= { ...x, where: new Set(), targets: new Set() }); a.where.add(`${p}@${w}`); x.nodes.forEach((n) => a.targets.add(n)); }
  }
}
for (const a of Object.values(agg).sort((x, y) => y.targets.size - x.targets.size)) {
  if (['serious', 'critical'].includes(a.impact)) failed = true;
  console.log(`   ${['serious', 'critical'].includes(a.impact) ? '✗' : '!'} [${a.impact}] ${a.id}: ${a.help}`);
  console.log(`       ${[...a.targets].slice(0, 3).join(' | ')}  (${[...a.where].slice(0, 3).join(', ')})`);
}
if (!Object.keys(agg).length) console.log('   no issues');

console.log('\n3. Keyboard focus');
await size(1280);
for (const p of pages) {
  await open(p);
  const miss = [];
  for (let i = 0; i < 40; i++) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await sleep(60);
    const r = await ev(`(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return { el: e.tagName.toLowerCase() + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30) + '"', ring: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' }; })()`);
    if (r && !r.ring) miss.push(r.el);
  }
  if (miss.length) { failed = true; console.log(`   ✗ ${p}: no focus ring on ${[...new Set(miss)].slice(0, 4).join(', ')}`); }
}
console.log('   done');

console.log(failed ? '\nFAILED: fix the ✗ items above.' : '\nPASSED');
ws.close(); chrome.kill();
process.exit(failed ? 1 : 0);
