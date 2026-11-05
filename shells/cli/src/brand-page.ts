// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly system publish`: writes a brand page's folder from the file given with --file, the
 * active terminal system, or a content profile named on purpose. Nothing goes public here:
 * the command writes a local folder and lists what it held back, and hosting is the
 * publisher's own act.
 */
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBrandPage, type BrandPageExampleInputV1, type BrandPageInputV1 } from '../../../engine/src/brand-page.ts';
import type { BrandPageHeldV1, BrandPageUsageV1 } from '@lolly-tools/core/brand-page-v1';
import { designBrief } from '@lolly/engine';
import { redistribution } from '../../../engine/src/asset-rights.ts';
import { axisOfKind, modeAxis, readTokenAxes } from '../../../engine/src/token-axes.ts';
import { createNodeTextAPI } from '@lolly-tools/node-shell/text';
import { emitResult } from './envelope.ts';
import { writeOut } from './output.ts';
import { usageError } from './exit-codes.ts';

type Flags = Record<string, string>;

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LOLLY_BIN = fileURLToPath(new URL('../bin/lolly.ts', import.meta.url));

interface UsageFile extends BrandPageUsageV1 { fonts?: Record<string, { url?: string; licence?: string }> }

async function readUsageFile(path: string): Promise<UsageFile> {
  const raw = await readFile(path, 'utf8').catch(() => { throw usageError(`Could not read ${path}.`, 'BAD_USAGE_FILE'); });
  if (!path.toLowerCase().endsWith('.json')) return { statement: raw.trim() };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw usageError(`${path} is not valid JSON.`, 'BAD_USAGE_FILE'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw usageError(`${path} must hold an object with statement, contact, url and fonts.`, 'BAD_USAGE_FILE');
  return parsed as UsageFile;
}

/** One example drawn by this CLI with no credential, imprint or record written into it, and text as outlines so it reads without the font. */
function drawExample(values: unknown, dir: string, id: string, frame: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  const inputs = join(dir, `${id}.json`);
  const output = join(dir, `${id}.svg`);
  const args = [LOLLY_BIN, 'design', `--inputs=${inputs}`, `--s=${frame}`, '--export=svg', '--convertPaths=true', '--text=outline', '--c2pa=off', '--imprint=0', '--no-madewith', `--output=${output}`];
  return new Promise((done, fail) => {
    writeFile(inputs, JSON.stringify(values)).then(() => {
      execFile(process.execPath, args, { env, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 }, error => {
        if (error) { done(null); return; }
        readFile(output, 'utf8').then(done, () => done(null));
      });
    }, fail);
  });
}

async function emptyOrMissing(dir: string): Promise<boolean> {
  const info = await stat(dir).catch(() => null);
  if (!info) return true;
  if (!info.isDirectory()) return false;
  return (await readdir(dir)).length === 0;
}

export async function publishBrandPage(flags: Flags, json: boolean): Promise<void> {
  if (!flags.out || flags.out === '1') throw usageError('usage: lolly system publish --out=<dir> [--origin=<url>] [--usage-file=<file>] [--include=<id,id>] [--profile=<name>] [--file=<tokens>] [--no-examples]', 'MISSING_ARGUMENT');
  for (const key of ['origin', 'usage-file', 'include', 'profile', 'file', 'name', 'id']) if (flags[key] === '1') throw usageError(`--${key} needs a value.`, 'MISSING_FLAG_VALUE');
  if (flags.origin && !/^https?:\/\//.test(flags.origin)) throw usageError('--origin must be an http or https address.', 'BAD_ORIGIN');
  const out = resolve(flags.out);
  if (!await emptyOrMissing(out)) throw usageError(`${flags.out} is not empty. Choose a new folder, so nothing is overwritten or left behind.`, 'OUT_NOT_EMPTY');

  // A profile is a brand somebody manages, so it is published by name and never by default.
  const { readActiveDesignSystemTokens } = await import('@lolly-tools/node-shell/design-systems');
  const pageSources = await import('@lolly-tools/node-shell/brand-page');
  const { readProfileTokenDocument } = await import('@lolly-tools/node-shell/design-brief');
  const { importSystemTokens } = await import('./system.ts');
  const profile = flags.profile ?? process.env.LOLLY_PROFILE;
  let tokens: unknown = null;
  let name = flags.name;
  let sources: Awaited<ReturnType<typeof pageSources.readProfileBrandPageSources>> = null;
  let catalog: BrandPageInputV1['catalog'] = null;
  const allowManaged = flags['manager-allows'] === '1';
  if (flags.profile) process.env.LOLLY_PROFILE = flags.profile;
  if (flags.file) {
    tokens = (await importSystemTokens(flags.file)).doc;
  } else if (profile) {
    const doc = readProfileTokenDocument({ profile });
    if (!doc) throw usageError(`The content profile ${profile} has no token document to publish.`, 'NO_TOKENS');
    tokens = doc.doc;
    name ??= doc.label;
    sources = await pageSources.readProfileBrandPageSources({ profile, allowManaged, ...(flags.origin ? { origin: flags.origin } : {}) });
    catalog = pageSources.brandPageCatalog({ profile });
    if (sources?.managed && !allowManaged) throw usageError(`${name ?? profile} is a managed design system. Its manager publishes it, with --manager-allows.`, 'MANAGED_SYSTEM');
  } else {
    tokens = await readActiveDesignSystemTokens();
    if (!tokens) throw usageError('Nothing to publish. Import a design system, pass --file=tokens.json, or name a content profile with --profile=<name>.', 'NO_TOKENS');
    sources = await pageSources.readTerminalBrandPageSources(tokens);
  }

  const usage: UsageFile | null = flags['usage-file'] ? await readUsageFile(flags['usage-file']) : null;
  const held: BrandPageHeldV1[] = [];
  const brief = designBrief(tokens, catalog ?? null, name ? { name } : {});
  name ??= brief.name;

  // Outlines, so a face can be seen without its file.
  const seen = new Set<string>();
  const faces = brief.fonts.flatMap(f => {
    const family = String(f.value).split(',')[0]!.trim().replace(/^['"]|['"]$/g, '');
    if (!family || seen.has(family)) return [];
    seen.add(family);
    return [{ family, display: f.path === 'font.display' }];
  });
  const text = createNodeTextAPI({ repoRoot: REPO_ROOT });
  const outlines = await pageSources.brandPageOutlines(text, name, faces);
  for (const face of faces) if (!outlines.some(o => o.family === face.family && o.role === 'specimen')) held.push({ item: `Specimen of ${face.family}`, reason: 'this machine holds no file for the face, so it could not be drawn', kind: 'unknown' });

  // Examples. A logo appears only if the page may publish that logo.
  const examples: BrandPageExampleInputV1[] = [];
  if (flags['no-examples'] !== '1') {
    const include = new Set((flags.include ?? '').split(',').map(s => s.trim()).filter(Boolean));
    const usable = (id: unknown): string | null => {
      const row = sources?.input.logos?.find(l => l.id === id);
      if (!row || !profile) return null;
      return include.has(row.id) || redistribution({ license: row.license, rights: row.rights, brandLock: row.brandLock }).travels ? row.id : null;
    };
    const axes = readTokenAxes(tokens).axes;
    const colourAxis = axisOfKind(axes, 'colourway');
    const modeOf = modeAxis(axes);
    const selection: Record<string, string> = {
      ...(modeOf?.options[0] ? { [modeOf.group]: modeOf.options[0].id } : {}),
      ...(colourAxis ? { [colourAxis.group]: colourAxis.canonical } : {}),
    };
    const dir = await mkdtemp(join(tmpdir(), 'lolly-brand-page-'));
    try {
      const env = { ...process.env, ...(profile ? { LOLLY_PROFILE: profile } : {}) };
      for (const example of pageSources.BRAND_PAGE_EXAMPLES) {
        const logo = example.id === 'poster' ? usable(brief.logos.onDark) : usable(brief.logos.onLight);
        const values = pageSources.brandPageExampleValues(tokens, selection, example, { logo });
        const svg = values ? await drawExample(values, dir, example.id, example.frame, env) : null;
        if (svg) examples.push({ id: example.id, name: example.name, svg });
        else held.push({ item: `Example ${example.name}`, reason: 'the example could not be drawn on this machine', kind: 'content' });
      }
    } finally { await rm(dir, { recursive: true, force: true }); }
  }

  const built = await buildBrandPage({
    tokens, catalog, name,
    ...(flags.id ? { id: flags.id } : {}),
    ...(flags.origin ? { origin: flags.origin } : {}),
    ...(usage ? { usage: { ...(usage.statement ? { statement: usage.statement } : {}), ...(usage.contact ? { contact: usage.contact } : {}), ...(usage.url ? { url: usage.url } : {}) } } : {}),
    ...(usage?.fonts ? { fontSources: usage.fonts } : {}),
    ...(sources?.input ?? {}),
    examples, outlines, held,
    ...(flags['no-made-with-link'] === '1' ? { madeWith: false } : {}),
    ...(flags.include ? { include: flags.include.split(',').map(s => s.trim()).filter(Boolean) } : {}),
  });

  await mkdir(out, { recursive: true });
  for (const file of built.files) {
    const target = resolve(out, file.path);
    if (!target.startsWith(out + sep)) throw new Error(`Refusing to write outside the folder: ${file.path}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.bytes);
  }
  const { manifest } = built;
  if (json) { await emitResult({ out, manifest }); return; }
  const lines = [
    `Wrote the ${manifest.name} brand page to ${flags.out}: ${manifest.files.length + 1} files.`,
    `Checked ${manifest.checks.pairs} colour pairs across ${manifest.checks.variants} colourway and mode pairs, and ${manifest.checks.rules} house rules. See checks.json.`,
    manifest.held.length ? `Held back ${manifest.held.length}:` : 'Nothing was held back.',
    ...manifest.held.map(h => `  ${h.item}: ${h.reason}`),
    'Nothing has gone public. Read the folder, then host the folder wherever you choose.',
  ];
  await writeOut(`${lines.join('\n')}\n`);
}
