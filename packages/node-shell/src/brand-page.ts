// SPDX-License-Identifier: MPL-2.0
/**
 * The Node half of a brand page: reads what `buildBrandPage` needs from a content profile
 * or the active terminal design system. Logo and font bytes, public brand skills, the Design
 * documents the house rules run on, and type drawn as outlines so a face can be seen
 * without its file.
 *
 * Reads files and shapes text. No network, no clock. Decides nothing about rights: that is
 * the engine's job, so every shell gives the same answer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createTokenSet, designBrief } from '@lolly/engine';
import type {
  BrandPageAssetInputV1, BrandPageDocumentInputV1, BrandPageFontInputV1, BrandPageInputV1, BrandPageSkillInputV1,
} from '../../../engine/src/brand-page.ts';

import { contentRoots, contentUrlFile, toolFile, type ContentRoots } from './content-roots.ts';
import { exportProfileBrandSkill, listProfileBrandSkills } from './brand-skills.ts';
import { readProfileBriefCatalog, readProfileTokenDocument } from './design-brief.ts';
import { activeNodeDesignSystem } from './design-systems.ts';
import { assetsOf } from './rebrand/design-system.ts';
import { resolveStateDir } from './state-dir.ts';

interface CatalogAsset {
  id: string; name?: string; type?: string; tags?: string[]; license?: unknown; rights?: unknown; attribution?: unknown;
  brandLock?: boolean; deprecated?: boolean; meta?: Record<string, unknown>;
  formats?: Array<{ format?: string; url?: string }>;
}

const VECTOR_FIRST = ['svg', 'png', 'webp', 'jpg', 'jpeg'];
const FONT_FORMATS = ['woff2', 'woff', 'otf', 'ttf'];
/** The Design templates the house rules are tried on. */
const RULE_DOCUMENTS = ['poster', 'slide-deck', 'pull-quote'] as const;

const pickFormat = (asset: CatalogAsset, order: readonly string[]): { format: string; url: string } | null => {
  for (const format of order) {
    const hit = asset.formats?.find(f => f.format === format && f.url);
    if (hit?.url) return { format, url: hit.url };
  }
  return null;
};

export interface BrandPageSourcesV1 {
  input: Pick<BrandPageInputV1, 'logos' | 'fonts' | 'skills' | 'documents'>;
  /** The system's token document is marked managed by its pack. */
  managed: boolean;
}

/** Everything a content profile can supply. The caller adds usage, origin, examples and outlines. */
export async function readProfileBrandPageSources(opts: { profile?: string; root?: string; origin?: string; allowManaged?: boolean } = {}): Promise<BrandPageSourcesV1 | null> {
  let roots: ContentRoots;
  try { roots = contentRoots({ ...(opts.profile ? { profile: opts.profile } : {}), ...(opts.root ? { root: opts.root } : {}) }); } catch { return null; }
  const assets = assetsOf(roots) as CatalogAsset[];
  const lockOf = (asset: CatalogAsset): { brandLock?: boolean } => asset.brandLock === true && !opts.allowManaged ? { brandLock: true } : {};
  const logos: BrandPageAssetInputV1[] = [];
  const fonts: BrandPageFontInputV1[] = [];
  for (const asset of assets) {
    if (asset.deprecated === true) continue;
    if ((asset.tags ?? []).includes('logo')) {
      const file = pickFormat(asset, VECTOR_FIRST);
      const path = file ? contentUrlFile(file.url, roots) : null;
      if (!file || !path) continue;
      logos.push({
        id: asset.id, format: file.format, bytes: readFileSync(path), ...lockOf(asset),
        ...(asset.name ? { name: asset.name } : {}), ...(asset.tags ? { tags: asset.tags } : {}),
        ...(asset.license !== undefined ? { license: asset.license } : {}), ...(asset.rights !== undefined ? { rights: asset.rights } : {}),
        ...(asset.attribution !== undefined ? { attribution: asset.attribution } : {}),
      });
    } else if (asset.type === 'font') {
      const file = pickFormat(asset, FONT_FORMATS);
      const path = file ? contentUrlFile(file.url, roots) : null;
      const family = typeof asset.meta?.family === 'string' ? asset.meta.family : asset.name;
      if (!file || !path || !family) continue;
      fonts.push({
        family, format: file.format, bytes: readFileSync(path),
        ...(typeof asset.meta?.weight === 'string' || typeof asset.meta?.weight === 'number' ? { weight: String(asset.meta.weight) } : {}),
        ...(typeof asset.meta?.style === 'string' ? { style: asset.meta.style } : {}),
        ...(asset.license !== undefined ? { license: asset.license } : {}), ...(asset.rights !== undefined ? { rights: asset.rights } : {}),
      });
    }
  }

  // Skills: public ones as exported folders. Internal ones only as a count, never their text.
  const skills: BrandPageSkillInputV1[] = [];
  const scope = { ...(opts.profile ? { profile: opts.profile } : {}), ...(opts.root ? { root: opts.root } : {}) };
  const listed = listProfileBrandSkills({ ...scope, audience: 'all' });
  for (const entry of listed?.skills ?? []) {
    if (entry.audience !== 'public') { skills.push({ name: entry.name, audience: entry.audience, files: {} }); continue; }
    const folder = await exportProfileBrandSkill(entry.name, { ...scope, audience: 'public', mode: 'linked', ...(opts.origin ? { origin: opts.origin } : {}) });
    if (folder) skills.push({ name: folder.name, label: entry.label, audience: 'public', discipline: entry.discipline, description: entry.description, files: folder.files });
  }
  if (listed?.baseline?.name) {
    const folder = await exportProfileBrandSkill(listed.baseline.name, { ...scope, audience: 'public', mode: 'linked', ...(opts.origin ? { origin: opts.origin } : {}) });
    if (folder) skills.push({ name: folder.name, label: 'Baseline, generated from the tokens', audience: 'public', discipline: 'brand', description: listed.baseline.description, files: folder.files });
  }

  const documents: BrandPageDocumentInputV1[] = [];
  for (const id of RULE_DOCUMENTS) {
    const path = toolFile('design', `templates/${id}.json`, roots);
    if (!path) continue;
    try {
      const values = (JSON.parse(readFileSync(path, 'utf8')) as { values?: { boxes?: unknown; background?: unknown } }).values;
      if (Array.isArray(values?.boxes)) documents.push({ id: `design/${id}`, boxes: values.boxes, background: values.background ?? '{color.semantic.surface}' });
    } catch { /* a template that cannot be read is one fewer document, and the report lists what ran */ }
  }
  const tokensAsset = readProfileTokenDocument(scope)?.tokensAsset;
  const managed = assets.some(a => a.id === tokensAsset && a.brandLock === true);
  return { input: { logos, fonts, skills, documents }, managed };
}

/** The active terminal system's retained resources. Nothing in them records a licence, so the engine holds them back by default. */
export async function readTerminalBrandPageSources(tokens: unknown): Promise<BrandPageSourcesV1> {
  const active = await activeNodeDesignSystem();
  const logos: BrandPageAssetInputV1[] = [];
  const fonts: BrandPageFontInputV1[] = [];
  const families = designBrief(tokens, null, {}).fonts.map(f => String(f.value).split(',')[0]!.trim().replace(/^['"]|['"]$/g, ''));
  const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const resource of active?.resources ?? []) {
    const ext = resource.name.slice(resource.name.lastIndexOf('.') + 1).toLowerCase();
    const read = (): Uint8Array => readFileSync(join(resolveStateDir().dir, resource.file));
    if (VECTOR_FIRST.includes(ext)) {
      logos.push({ id: resource.name, name: resource.name, format: ext, bytes: read() });
    } else if (FONT_FORMATS.includes(ext)) {
      const family = families.find(f => squash(resource.name).startsWith(squash(f)));
      if (family) fonts.push({ family, format: ext, bytes: read() });
    }
  }
  return { input: { logos, fonts, skills: [], documents: [] }, managed: false };
}

/** The catalog facts for a profile, the same ones the brief reads. */
export function brandPageCatalog(opts: { profile?: string; root?: string } = {}) {
  return readProfileBriefCatalog({ ...opts, skillAudience: 'public' });
}

const EXAMPLE_TEXT = {
  heading: 'Make room for your next idea.',
  body: 'A fresh direction, made with your colours.',
  dense: 'A clear starting point\nBring your colours, type and artwork together.\n\nSpace to explore\nMake useful variations without losing what makes the work yours.',
};

/** The examples a page shows: one frame of a Design template, painted from the system's own tokens. */
export const BRAND_PAGE_EXAMPLES = [
  { id: 'poster', name: 'Poster', template: 'poster', frame: 'frame', prefix: '' },
  { id: 'slide-title', name: 'Title slide', template: 'slide-deck', frame: 'slide1', prefix: 's1' },
  { id: 'slide-content', name: 'Content slide', template: 'slide-deck', frame: 'slide2', prefix: 's2' },
] as const;

/**
 * The Design input values for one example, with every colour and face read from the tokens
 * so the render needs no theme of its own. A logo appears only when the caller says it may
 * be published, because an example must not carry artwork the page holds back.
 */
export function brandPageExampleValues(
  doc: unknown,
  selection: Record<string, string>,
  example: (typeof BRAND_PAGE_EXAMPLES)[number],
  opts: { logo?: string | null; root?: string } = {},
): { boxes: Array<Record<string, unknown>> } | null {
  let roots: ContentRoots;
  try { roots = contentRoots(opts.root ? { root: opts.root } : {}); } catch { return null; }
  const path = toolFile('design', `templates/${example.template}.json`, roots);
  if (!path) return null;
  let seed: unknown;
  try { seed = (JSON.parse(readFileSync(path, 'utf8')) as { values?: { boxes?: unknown } }).values?.boxes; } catch { return null; }
  if (!Array.isArray(seed)) return null;
  const tokens = createTokenSet(doc, { selection });
  const slot = (name: string): string | null => {
    const hit = tokens.colors().find(c => c.path === `color.semantic.${name}`);
    return hit && typeof hit.value === 'string' ? hit.value : null;
  };
  const familyOf = (tokenPath: string): string | null => {
    const value = tokens.resolve(tokenPath);
    return typeof value === 'string' && value.trim() ? value.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '') : null;
  };
  const display = familyOf('font.display') ?? familyOf('font.brand');
  const textFace = familyOf('font.brand') ?? display;
  const poster = example.id === 'poster';
  const ground = (poster ? slot('primary') : slot('surface')) ?? '#ffffff';
  const ink = (poster ? slot('on-primary') : slot('text')) ?? '#000000';
  const accent = (poster ? slot('secondary') ?? slot('on-primary') : slot('primary')) ?? ink;
  const titleInk = poster ? ink : slot('primary') ?? ink;
  const titleId = example.prefix ? `${example.prefix}title` : 'title';
  const bodyId = `${example.prefix}body`, accentId = `${example.prefix}accent`;
  const frameRow = seed.find((b): b is Record<string, unknown> => !!b && typeof b === 'object' && (b as Record<string, unknown>).id === example.frame);
  if (!frameRow) return null;
  const ox = Number(frameRow.x) || 0, oy = Number(frameRow.y) || 0;
  const boxes: Array<Record<string, unknown>> = [];
  for (const raw of seed as Array<Record<string, unknown>>) {
    if (raw.id !== example.frame && raw.frame !== example.frame) continue;
    const box: Record<string, unknown> = { ...raw, x: (Number(raw.x) || 0) - ox, y: (Number(raw.y) || 0) - oy };
    if (raw.id === example.frame) box.bg = ground;
    if (raw.kind === 'text') { box.fg = ink; if (textFace) box.font = textFace; }
    if (raw.id === titleId) { box.text = EXAMPLE_TEXT.heading; box.fg = titleInk; if (display) box.font = display; }
    if (raw.id === bodyId) box.text = example.id === 'slide-content' ? EXAMPLE_TEXT.dense : EXAMPLE_TEXT.body;
    if (raw.id === accentId) box.bg = accent;
    if (example.id === 'slide-content' && raw.id === bodyId) { box.fontSize = 40; box.lineHeight = 1.4; box.h = 560; }
    boxes.push(box);
  }
  if (opts.logo) boxes.push({ id: 'brand-device', kind: 'image', image: opts.logo, x: 1500, y: 70, w: 260, h: 110, frame: example.frame, fit: 'contain' });
  return { boxes };
}

export { brandPageOutlines } from '../../../engine/src/brand-page.ts';
