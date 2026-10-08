#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Sidebar capture for the chrome-craft review (.claude/skills/chrome-craft/SKILL.md).
 *
 * Run as: node scripts/capture-sidebars.ts [--url=http://localhost:5173] [--out=<dir>] [id ...]
 *
 * Drives every tool (or the ids given) in headless Chromium against the running dev
 * server and writes, per tool, a folded and an expanded screenshot of the input
 * sidebar plus one JSON audit of what it found: row and section counts with their
 * open state, the labels in order, the control each row renders, controls under 24px,
 * dashed borders (drop areas are the only legitimate ones), accent-coloured borders
 * at rest on rounded elements, and any label text still carrying an em dash or an
 * arrow. That JSON is what a review agent reads first; the screenshots are what it
 * looks at second.
 *
 * Two things the harness has to know about the app. Rows inside a folded section are
 * attached but not visible, so the wait is for an ATTACHED row: a tool whose every
 * input sits in a section would otherwise time out, and that shape is exactly the
 * first impression the audit needs to record. And a fresh profile opens the "New from
 * template" chooser over the sidebar on tools that declare templates, so the harness
 * presses Escape once the page has settled, which proceeds to the tool's own default.
 *
 * Tools with no generic sidebar (the file-first utilities before a file is chosen,
 * the design canvas, tools not mounted by the active profile) time out and are
 * recorded as failures rather than aborting the run.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { contentRoots } from '../packages/node-shell/src/content-roots.ts';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = flag('url', 'http://localhost:5173');
// Outside the tree by default: these are working files for a review, never a commit.
const OUT = resolve(flag('out', join(tmpdir(), 'lolly-sidebar-shots')));
const only = args.filter((a) => !a.startsWith('--'));

/** Every tool id the active profile mounts (or the ids asked for). */
function toolIds(): string[] {
  if (only.length) return only;
  const ids = new Set<string>();
  for (const root of contentRoots().toolRoots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      if (!name.startsWith('_') && !name.startsWith('.') && existsSync(join(root, name, 'tool.json'))) ids.add(name);
    }
  }
  return [...ids].sort();
}

/** Runs inside the page: the structural audit of the sidebar as rendered. */
const AUDIT = `(() => {
  const sb = document.querySelector('.sidebar');
  const inputs = document.querySelector('.tool-inputs');
  if (!sb || !inputs) return { missing: true };
  const rect = (el) => el.getBoundingClientRect();
  const vis = (el) => { const r = rect(el); return r.width > 0 && r.height > 0; };
  const cls = (el) => (el.className && String(el.className).split(' ').slice(0, 2).join(' ')) || el.tagName;
  const rows = [...inputs.querySelectorAll('.input-row')].filter(vis);
  const sections = [...inputs.querySelectorAll('details.input-section')].map((d) => ({
    name: d.querySelector('summary')?.textContent?.trim(), open: d.open, rows: d.querySelectorAll('.input-row').length }));
  const flat = [...inputs.children].filter((c) => c.classList.contains('input-row')).length;
  const labels = rows.map((r) => (r.querySelector('.input-label-text, .input-label')?.textContent || '').trim()).filter(Boolean);
  const controls = rows.map((r) => {
    const c = r.querySelector('input, select, textarea, button, .custom-slider, .badge-select, .vector-input, .blocks-input, [data-color-field], jelly-input, jelly-switch, jelly-textarea');
    return c ? c.tagName.toLowerCase() + (c.type ? ':' + c.type : '') + (c.className ? '.' + String(c.className).split(' ')[0] : '') : 'none';
  });
  const dashed = [...sb.querySelectorAll('*')].filter(vis).filter((el) => {
    const cs = getComputedStyle(el); return cs.borderTopStyle === 'dashed' || cs.outlineStyle === 'dashed';
  }).map(cls).slice(0, 12);
  const small = [...sb.querySelectorAll('button, input, select, textarea, a, [role=button], [tabindex="0"]')].filter(vis).map((el) => {
    const r = rect(el); return { cls: cls(el), w: Math.round(r.width), h: Math.round(r.height) };
  }).filter((x) => x.w < 24 || x.h < 24).slice(0, 20);
  const glyphs = [...sb.querySelectorAll('*')].filter((el) => el.children.length === 0 && /\\u2014|\\u2192|\\u2190/.test(el.textContent || '')).map((el) => (el.textContent || '').trim().slice(0, 80)).slice(0, 10);
  const accentBorder = [...sb.querySelectorAll('*')].filter(vis).filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.borderTopStyle === 'none' || parseFloat(cs.borderTopWidth) === 0) return false;
    if (parseFloat(cs.borderTopLeftRadius) < 4) return false;
    const m = cs.borderTopColor.match(/rgba?\\((\\d+), (\\d+), (\\d+)(?:, ([\\d.]+))?\\)/); if (!m) return false;
    const [r, g, b] = [+m[1], +m[2], +m[3]]; const a = m[4] === undefined ? 1 : +m[4];
    const max = Math.max(r, g, b), min = Math.min(r, g, b); const sat = max === 0 ? 0 : (max - min) / max;
    return a > 0.15 && sat > 0.35;
  }).map((el) => ({ cls: cls(el), color: getComputedStyle(el).borderTopColor })).slice(0, 12);
  const firstLabel = rows[0]?.querySelector('.input-label');
  const labelStyle = firstLabel ? { fs: getComputedStyle(firstLabel).fontSize, ls: getComputedStyle(firstLabel).letterSpacing, tt: getComputedStyle(firstLabel).textTransform } : null;
  return { rows: rows.length, flat, sections, labels, controls, dashed, small, glyphs, accentBorder, labelStyle,
    sidebarHeight: Math.round(inputs.scrollHeight), sidebarWidth: Math.round(rect(sb).width) };
})()`;

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const ids = toolIds();
  // The shell needs a WebGPU adapter to start (webgpu-launch.ts).
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2200 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const results: Record<string, unknown> = {};
  for (const id of ids) {
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    const t0 = Date.now();
    try {
      await page.goto(`${BASE}/t/${id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.tool-inputs .input-row', { state: 'attached', timeout: 45000 });
      await page.waitForTimeout(1800);
      if (await page.$('[class*="tmpl-chooser"]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(1200); }
      const folded = await page.evaluate(AUDIT);
      const sb = await page.$('.sidebar');
      if (sb) await sb.screenshot({ path: join(OUT, `${id}.folded.png`) });
      await page.evaluate(() => { document.querySelectorAll('details.input-section').forEach((d) => { (d as HTMLDetailsElement).open = true; }); });
      await page.waitForTimeout(400);
      const expanded = await page.evaluate(AUDIT) as Record<string, unknown>;
      if (sb) await sb.screenshot({ path: join(OUT, `${id}.expanded.png`) });
      results[id] = { ok: true, ms: Date.now() - t0, errors: errors.slice(0, 6), folded, expanded };
      const f = folded as { rows: number; flat: number; sections: unknown[] };
      console.log(`ok   ${id.padEnd(22)} rows=${f.rows} flat=${f.flat} sections=${f.sections.length} errors=${errors.length} ${Date.now() - t0}ms`);
    } catch (e) {
      results[id] = { ok: false, error: String(e).slice(0, 300), errors: errors.slice(0, 6), ms: Date.now() - t0 };
      console.log(`FAIL ${id.padEnd(22)} ${String(e).slice(0, 120)}`);
    }
    await page.close();
  }
  await browser.close();
  const auditPath = join(OUT, 'sidebar-audit.json');
  let merged: Record<string, unknown> = {};
  try { merged = JSON.parse(readFileSync(auditPath, 'utf8')); } catch { /* first run */ }
  Object.assign(merged, results);
  writeFileSync(auditPath, `${JSON.stringify(merged, null, 1)}\n`);
  console.log(`wrote ${auditPath}: ${Object.keys(results).length} captured this run, ${Object.keys(merged).length} total`);
}

main().catch((e) => { console.error(e); process.exit(1); });
