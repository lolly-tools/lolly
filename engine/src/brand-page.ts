// SPDX-License-Identifier: MPL-2.0
/**
 * A brand page: one published address that is a press kit and an agent kit. `buildBrandPage`
 * turns a design system and what its host hands over into the folder's files.
 *
 * The host supplies bytes and facts it alone can reach: logo files, font files, rendered
 * examples, outlined type specimens and exported skills. This module decides what may go
 * public, measures what can be measured and writes every text file. Same input, same bytes:
 * no clock, no random ids, sorted output. A host may add a publish time outside the digest.
 *
 * Rights decide the bytes. A font file needs a recorded licence that allows passing it on,
 * and nothing overrides that. A logo with an unrecorded licence is held back unless the
 * publisher lists that logo in `include`. An internal skill never appears. Everything held back is
 * listed with its reason, except an internal skill's name, because the list is public too.
 *
 * Pure: no DOM, no storage, no network.
 */
import { BRAND_PAGE_VERSION, DESIGN_MD_TARGET } from '@lolly-tools/core/brand-page-v1';
import type { TextAPI } from '@lolly-tools/core/host-v1';
import type {
  BrandPageCheckVariantV1, BrandPageChecksV1, BrandPageColourPairV1, BrandPageColourwayV1, BrandPageFileRoleV1, BrandPageFileV1,
  BrandPageHeldKindV1, BrandPageHeldV1, BrandPagePairReadingV1, BrandPageRuleCheckV1, BrandPageUsageV1, BrandPageV1,
} from '@lolly-tools/core/brand-page-v1';
import { redistribution } from './asset-rights.ts';
import { apcaContrast } from './color-tools.ts';
import { contrastRatio } from './brand-derive.ts';
import { canonicalJson } from './canonical-json.ts';
import { bytesToHex, sha256 } from './bytes.ts';
import { designBrief, type DesignBriefCatalogV1, type DesignBriefV1 } from './design-brief.ts';
import { checkDesignHouseRules } from './design-house-rules.ts';
import { withRecordedBrandPage } from './brand-page-address.ts';
import { readDesignSystemIdentity, slugifyDesignSystemId } from './design-system.ts';
import { writeDesignMd } from './design-md.ts';
import { brandSystemOf } from './brand-system.ts';
import { brandSkillScopeHints } from './brand-skill.ts';
import { colorToHex, createTokenSet, TOKEN_EXT } from './tokens.ts';
import { axisOfKind, modeAxis, readTokenAxes } from './token-axes.ts';
import { ENGINE_VERSION } from './version.ts';
import { writeAgentsMd, writeIndexHtml, writeIndexMd, writeLlmsTxt, writePageCss } from './brand-page-render.ts';

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);

/** A logo or other asset the host read. Bytes are never altered. */
export interface BrandPageAssetInputV1 {
  id: string;
  name?: string;
  format: string;
  bytes: Uint8Array;
  license?: unknown;
  rights?: unknown;
  attribution?: unknown;
  brandLock?: boolean;
  tags?: readonly string[];
}

export interface BrandPageFontInputV1 {
  family: string;
  weight?: string;
  style?: string;
  format: string;
  bytes: Uint8Array;
  license?: unknown;
  rights?: unknown;
  /** What the font's own `fsType` says, when the host could read the field. `restricted` holds the file back whatever the licence record says. */
  embedding?: string;
  /** The licence's own text. It goes beside the font file, because a licence such as the OFL asks for its text to travel with each copy. */
  licenceText?: Uint8Array;
}

export interface BrandPageSkillInputV1 {
  name: string;
  label?: string;
  audience: 'public' | 'internal' | string;
  discipline?: string;
  description?: string;
  /** Paths inside the Agent Skills folder. */
  files: Record<string, string | Uint8Array>;
}

export interface BrandPageExampleInputV1 {
  id: string;
  name: string;
  svg: string;
}

/** Text drawn as a vector path, so a licensed face can be seen without its file. */
export interface BrandPageOutlineV1 {
  family: string;
  /** `name` draws the brand's name in the page head. `specimen` is a line in the Type section. */
  role: 'name' | 'specimen';
  text: string;
  d: string;
  viewBox: { x: number; y: number; width: number; height: number };
}

export interface BrandPageDocumentInputV1 {
  id: string;
  boxes: unknown;
  background?: unknown;
}

export interface BrandPageInputV1 {
  tokens: unknown;
  catalog?: DesignBriefCatalogV1 | null;
  name?: string;
  id?: string;
  publishedVersion?: string;
  origin?: string;
  usage?: BrandPageUsageV1;
  /** Where each face can be licensed, in the publisher's words. */
  fontSources?: Record<string, { url?: string; licence?: string }>;
  logos?: readonly BrandPageAssetInputV1[];
  fonts?: readonly BrandPageFontInputV1[];
  skills?: readonly BrandPageSkillInputV1[];
  examples?: readonly BrandPageExampleInputV1[];
  outlines?: readonly BrandPageOutlineV1[];
  /** Design documents the house rules run on, for each colourway and mode. */
  documents?: readonly BrandPageDocumentInputV1[];
  /** Show the "Made with Lolly" link in the page's footer. On unless the publisher turns it off. */
  madeWith?: boolean;
  /** Asset ids the publisher chooses to publish although no licence allows it on record: their stated choice. */
  include?: readonly string[];
  /** What the host could not supply, with its reason. */
  held?: readonly BrandPageHeldV1[];
}

export interface BrandPageFileOutV1 {
  path: string;
  role: BrandPageFileRoleV1 | 'manifest';
  mediaType: string;
  bytes: Uint8Array;
}

export interface BrandPageBuildV1 {
  manifest: BrandPageV1;
  checks: BrandPageChecksV1;
  /** Every file including `brand.json`, sorted by path. */
  files: BrandPageFileOutV1[];
}

// ── What the writers read ───────────────────────────────────────────────────

export interface PageVariantV1 {
  colourway: string;
  colourwayName: string;
  mode: string;
  modeName: string;
  selection: Record<string, string>;
  slots: Record<string, string>;
  /** `dark` when light artwork reads on the primary colour. */
  heroSurface: 'dark' | 'light';
  checks: BrandPageCheckVariantV1;
}

export interface PageFactsV1 {
  id: string;
  name: string;
  /** One sentence. */
  summary: string;
  overview: string;
  usage: BrandPageUsageV1 | null;
  origin: string | null;
  colourways: BrandPageColourwayV1[];
  modes: Array<{ id: string; name: string }>;
  variants: PageVariantV1[];
  /** The named colours, resolved in the canonical variant. */
  named: Array<{ name: string; path: string; value: string }>;
  logos: Array<{ id: string; name: string; path: string; surface: 'light' | 'dark' | 'any'; mono: boolean; licence?: string }>;
  heroLogos: { onDark: string | null; onLight: string | null };
  faces: Array<{ family: string; tokens: string[]; files: string[]; licence: string | null; licenceFile: string | null; source: string | null; outline: BrandPageOutlineV1 | null }>;
  nameOutline: BrandPageOutlineV1 | null;
  examples: Array<{ id: string; name: string; path: string }>;
  rules: Array<{ id: string; label: string; requirement: 'required' | 'advisory'; description: string }>;
  skills: Array<{ name: string; label: string; description: string; discipline: string; path: string }>;
  checks: BrandPageChecksV1;
  held: BrandPageHeldV1[];
  tokenPaths: string[];
  masterSize: { width: number; height: number } | null;
  madeWith: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const ENCODER = new TextEncoder();
const MAX_VARIANTS = 64;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const MAX_SVG_BYTES = 8 * 1024 * 1024;

/** The slots the page and the checks read, in reading order. */
const SLOTS = ['primary', 'on-primary', 'secondary', 'surface', 'text', 'muted', 'edge'] as const;

const PAIRS: ReadonlyArray<{ id: string; label: string; foreground: string; background: string }> = [
  { id: 'text-on-surface', label: 'Text on surface', foreground: 'text', background: 'surface' },
  { id: 'muted-on-surface', label: 'Muted text on surface', foreground: 'muted', background: 'surface' },
  { id: 'on-primary', label: 'Text on primary', foreground: 'on-primary', background: 'primary' },
  { id: 'primary-on-surface', label: 'Primary on surface', foreground: 'primary', background: 'surface' },
  { id: 'secondary-on-surface', label: 'Secondary on surface', foreground: 'secondary', background: 'surface' },
];

const CHECK_STATEMENT = 'These are measurements of token pairs and rule checks on example documents. They do not judge any finished piece, and a person still decides.';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const text = (v: unknown, limit = 400): string => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
const pathSegment = (raw: string): string => raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 96);
const slug = (raw: string): string => raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
const hexOf = (value: unknown): string | null => {
  const hex = colorToHex(value);
  return typeof hex === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex) ? hex.slice(0, 7).toLowerCase() : null;
};
const firstSentence = (raw: string): string => {
  const hit = /^(.{20,240}?[.!?])(\s|$)/.exec(raw);
  return (hit ? hit[1]! : raw).slice(0, 280);
};

const MEDIA: Readonly<Record<string, string>> = {
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf',
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf', json: 'application/json', md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8',
};
const mediaOf = (path: string): string => MEDIA[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';

const SPECIMEN_TEXT = 'Aa Bb Cc Dd Ee Ff Gg 0123456789';

const round = (n: number): number => Math.round(n * 100) / 100;

async function outline(text: TextAPI, family: string, line: string, role: BrandPageOutlineV1['role'], weight: number, fontSize: number): Promise<BrandPageOutlineV1 | null> {
  if (!text.fontUrl) return null;
  const font = await text.fontUrl(family, { weight });
  if (!font) return null;
  const drawn = await text.toPath({ text: line, fontUrl: font.url, fontSize, ...(font.variations ? { variations: font.variations } : {}) });
  if (!drawn.d || drawn.notdef || !drawn.bbox) return null;
  const pad = fontSize * 0.04;
  const { x1, y1, x2, y2 } = drawn.bbox;
  return {
    family, role, text: line, d: drawn.d,
    viewBox: { x: round(x1 - pad), y: round(y1 - pad), width: round(x2 - x1 + pad * 2), height: round(y2 - y1 + pad * 2) },
  };
}

/** The brand's name and one specimen line per family, drawn with `text`. A face the host cannot read is left to the page's plain text. */
export async function brandPageOutlines(text: TextAPI, name: string, faces: ReadonlyArray<{ family: string; display?: boolean }>): Promise<BrandPageOutlineV1[]> {
  const out: BrandPageOutlineV1[] = [];
  const display = faces.find(f => f.display) ?? faces[0];
  if (display) {
    const drawn = await outline(text, display.family, name, 'name', 600, 160).catch(() => null);
    if (drawn) out.push(drawn);
  }
  for (const face of faces) {
    const drawn = await outline(text, face.family, SPECIMEN_TEXT, 'specimen', 400, 80).catch(() => null);
    if (drawn) out.push(drawn);
  }
  return out;
}

/** Why an SVG cannot sit in a public folder, or null. Logos and examples are shown, so they must be inert. */
export function brandPageSvgProblem(svg: string): string | null {
  if (svg.length > MAX_SVG_BYTES) return 'the file is larger than the 8 MiB limit for SVG';
  if (!/<svg[\s>]/i.test(svg)) return 'the file is not an SVG';
  if (/<script[\s>/]/i.test(svg)) return 'it contains a script';
  if (/\son[a-z]+\s*=/i.test(svg)) return 'it contains an event handler';
  if (/javascript:/i.test(svg)) return 'it contains a javascript link';
  if (/<foreignObject[\s>/]/i.test(svg)) return 'it contains embedded HTML';
  if (/(?:href\s*=\s*["']|url\(\s*["']?)(?:https?:)?\/\//i.test(svg)) return 'it loads a file from another site';
  if (/@import\b/i.test(svg)) return 'it imports a stylesheet';
  return null;
}

/** The token document that goes public. Source evidence and people's names stay out. */
function publishableTokens(doc: unknown, held: BrandPageHeldV1[]): unknown {
  if (!isRow(doc)) return doc;
  // A setting about this publisher's own exports, not a fact about the brand. Left out,
  // so turning the setting on or off leaves the folder's bytes as they were.
  const out = withRecordedBrandPage(doc, null) as Row;
  const extensions = isRow(out.$extensions) ? out.$extensions : null;
  const vendor = extensions && isRow(extensions[TOKEN_EXT]) ? extensions[TOKEN_EXT] as Row : null;
  if (!vendor) return out;
  const dropped: string[] = [];
  for (const key of ['reference', 'upstream']) if (key in vendor) { delete vendor[key]; dropped.push(key); }
  if (dropped.length) held.push({ item: 'Source evidence in the token document', reason: 'where the tokens came from is a private record', kind: 'policy' });
  const system = isRow(vendor.brandSystem) ? vendor.brandSystem : null;
  if (system && Array.isArray(system.rules)) {
    let named = false;
    for (const rule of system.rules) {
      if (!isRow(rule)) continue;
      if (isRow(rule.review) && typeof rule.review.authority === 'string') { rule.review.authority = 'publisher'; named = true; }
      if (isRow(rule.origin) && typeof rule.origin.author === 'string') { rule.origin.author = 'publisher'; named = true; }
    }
    if (named) held.push({ item: 'Names on house rule reviews', reason: 'a public file does not name who reviewed a rule', kind: 'policy' });
  }
  return out;
}

/** Nested DTCG of one variant's resolved values. */
function resolvedTokens(doc: unknown, selection: Record<string, string>): Row {
  const out: Row = {};
  for (const entry of createTokenSet(doc, { selection }).query()) {
    if (entry.value === undefined) continue;
    const parts = entry.path.split('.');
    let at = out;
    let ok = true;
    for (const part of parts.slice(0, -1)) {
      if (part === '__proto__' || part === 'constructor' || part === 'prototype') { ok = false; break; }
      const next = at[part];
      if (next !== undefined && !isRow(next)) { ok = false; break; }
      if (next === undefined) at[part] = {};
      at = at[part] as Row;
    }
    const leaf = parts[parts.length - 1]!;
    if (!ok || leaf === '__proto__' || leaf === 'constructor' || leaf === 'prototype') continue;
    at[leaf] = { ...(entry.type ? { $type: entry.type } : {}), $value: entry.value };
  }
  return out;
}

function slotsOf(doc: unknown, selection: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of createTokenSet(doc, { selection }).colors()) {
    if (!c.path.startsWith('color.semantic.')) continue;
    const hex = hexOf(c.value);
    if (hex) out[c.path.slice('color.semantic.'.length)] = hex;
  }
  return out;
}

const readingOf = (contrast: number): BrandPagePairReadingV1 => contrast >= 4.5 ? 'body-text' : contrast >= 3 ? 'large-text' : 'below-3';

function measure(id: string, label: string, fgSlot: string, bgSlot: string, fg: string, bg: string): BrandPageColourPairV1 {
  const contrast = round2(contrastRatio(fg, bg));
  return { id, label, foreground: { slot: fgSlot, value: fg }, background: { slot: bgSlot, value: bg }, contrast, apca: Math.round(apcaContrast(fg, bg)), reads: readingOf(contrast) };
}

function pairsFor(doc: unknown, selection: Record<string, string>, slots: Record<string, string>, brief: DesignBriefV1): BrandPageColourPairV1[] {
  const out: BrandPageColourPairV1[] = [];
  for (const p of PAIRS) {
    const fg = slots[p.foreground];
    const bg = slots[p.background];
    if (fg && bg) out.push(measure(p.id, p.label, p.foreground, p.background, fg, bg));
  }
  // A brand's declared pairings, in this variant's values.
  if (brief.combinations.from === 'declared') {
    const byPath = new Map(createTokenSet(doc, { selection }).colors().map(c => [c.path, hexOf(c.value)]));
    for (const pair of brief.combinations.pairs as Array<{ background: { path?: string; name?: string }; text?: Array<{ path?: string; name?: string }> }>) {
      const bg = pair.background.path ? byPath.get(pair.background.path) : null;
      if (!bg) continue;
      for (const t of pair.text ?? []) {
        const fg = t.path ? byPath.get(t.path) : null;
        if (!fg || out.length >= 64) continue;
        out.push(measure(`declared-${slug(t.path!)}-on-${slug(pair.background.path!)}`, `${text(t.name, 60) || t.path} on ${text(pair.background.name, 60) || pair.background.path}`, t.path!, pair.background.path!, fg, bg));
      }
    }
  }
  return out;
}

function surfaceOfLogo(brief: DesignBriefV1, id: string): { surface: 'light' | 'dark' | 'any'; mono: boolean } {
  const variant = (brief.logos.variants as Array<{ id: string; surface: 'light' | 'dark' | 'any'; mono: boolean }>).find(v => v.id === id);
  return variant ? { surface: variant.surface, mono: variant.mono } : { surface: 'any', mono: false };
}

/** The hash of what a manifest says, without the digest itself or a host's publish time. */
export async function brandPageDigest(manifest: Omit<BrandPageV1, 'digest'> & { digest?: string }): Promise<string> {
  const { digest: _digest, publishedAt: _publishedAt, ...body } = manifest;
  return bytesToHex(await sha256(ENCODER.encode(canonicalJson(body))));
}

// ── The build ───────────────────────────────────────────────────────────────

/** Builds a brand page's folder. Same input, same bytes. */
export async function buildBrandPage(input: BrandPageInputV1): Promise<BrandPageBuildV1> {
  const doc = input.tokens;
  const brief = designBrief(doc, input.catalog ?? null, input.name ? { name: input.name } : {});
  const name = text(input.name ?? brief.name, 200) || 'Design system';
  const identity = readDesignSystemIdentity(doc);
  const idCandidate = slug(input.id ?? identity?.id ?? slugifyDesignSystemId(name));
  const id = (idCandidate.replace(/^-+/, '').slice(0, 48).replace(/-+$/, '')) || 'design-system';
  const raw = isRow(doc) ? doc : {};
  const stated = text(raw.$description, 2000);
  // A description that reaches for permissions or code is not what a page leads with.
  const overview = brandSkillScopeHints(stated).length ? '' : stated;
  const held: BrandPageHeldV1[] = (input.held ?? []).map(h => ({ item: text(h.item, 300), reason: text(h.reason, 600), kind: h.kind }));
  const hold = (item: string, reason: string, kind: BrandPageHeldKindV1): void => { held.push({ item: text(item, 300), reason: text(reason, 600), kind }); };
  if (stated && !overview) hold('The description in the token document', 'its text speaks about permissions or running code', 'content');

  const files = new Map<string, BrandPageFileOutV1>();
  let total = 0;
  const add = (path: string, role: BrandPageFileRoleV1, bytes: Uint8Array): boolean => {
    if (bytes.byteLength > MAX_FILE_BYTES) { hold(path, 'the file is larger than the 32 MiB limit', 'limit'); return false; }
    if (total + bytes.byteLength > MAX_TOTAL_BYTES) { hold(path, 'the folder would pass the 256 MiB limit', 'limit'); return false; }
    total += bytes.byteLength;
    files.set(path, { path, role, mediaType: mediaOf(path), bytes });
    return true;
  };
  const addText = (path: string, role: BrandPageFileRoleV1, value: string): boolean => add(path, role, ENCODER.encode(value));
  const pretty = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

  // Token document, source evidence and names removed. The revision follows what goes public.
  const published = publishableTokens(doc, held);
  const revision = `sha256:${bytesToHex(await sha256(ENCODER.encode(canonicalJson(published))))}`;
  addText('tokens/tokens.json', 'tokens', pretty(published));

  // Colourways and modes.
  const axes = readTokenAxes(doc).axes;
  const colourAxis = axisOfKind(axes, 'colourway');
  const modeOf = modeAxis(axes);
  const safeIds = (options: ReadonlyArray<{ id: string; name: string }>): Array<{ source: string; id: string; name: string }> => {
    const seen = new Set<string>();
    return options.map(option => {
      const base = slug(option.id) || 'option';
      let safe = base;
      for (let n = 2; seen.has(safe); n++) safe = `${base}-${n}`;
      seen.add(safe);
      return { source: option.id, id: safe, name: text(option.name, 200) || option.id };
    });
  };
  const allColourways = colourAxis ? safeIds([...colourAxis.options].sort((a, b) => Number(b.id === colourAxis.canonical) - Number(a.id === colourAxis.canonical))) : [{ source: '', id: 'default', name: 'Default' }];
  const modes = modeOf
    ? safeIds(modeOf.options).map(m => ({ ...m, name: m.name.charAt(0).toUpperCase() + m.name.slice(1) }))
    : [{ source: '', id: 'default', name: 'Default' }];
  const colourwayLimit = Math.max(1, Math.floor(MAX_VARIANTS / Math.max(1, modes.length)));
  const colourwayRows = allColourways.slice(0, colourwayLimit);
  for (const dropped of allColourways.slice(colourwayLimit)) hold(`Colourway ${dropped.name}`, `a page holds at most ${MAX_VARIANTS} colourway and mode pairs`, 'limit');

  // Rules: only text free of the scope hints reaches a page or an agent file.
  const rulesAll = Array.isArray(brief.houseRules) ? brief.houseRules : [];
  const rules: PageFactsV1['rules'] = [];
  for (const rule of rulesAll) {
    const label = text(rule.label, 300);
    const description = text(rule.description, 600);
    if (brandSkillScopeHints(`${label}\n${description}`).length) { hold(`House rule ${rule.id}`, 'its text speaks about permissions or running code, so it stays out of what agents read', 'content'); continue; }
    rules.push({ id: rule.id, label, requirement: rule.requirement, description });
  }

  // Checks and resolved files, per colourway and mode.
  const variants: PageVariantV1[] = [];
  const brandRules = brandSystemOf(doc)?.rules ?? [];
  const notes = new Map<string, BrandPageRuleCheckV1['notes']>();
  const counts = new Map<string, number>();
  const unknownRules = new Set<string>();
  const documents = input.documents ?? [];
  for (const colourway of colourwayRows) {
    for (const mode of modes) {
      const selection: Record<string, string> = {
        ...(modeOf ? { [modeOf.group]: mode.source } : {}),
        ...(colourAxis ? { [colourAxis.group]: colourway.source } : {}),
      };
      const slots = slotsOf(doc, selection);
      const primary = slots.primary;
      const heroSurface = primary && contrastRatio('#ffffff', primary) < contrastRatio('#000000', primary) ? 'light' : 'dark';
      const pairs = pairsFor(doc, selection, slots, brief);
      const stem = `${colourway.id}.${mode.id}`;
      addText(`tokens/${stem}.tokens.json`, 'tokens-resolved', pretty(resolvedTokens(doc, selection)));
      addText(`design/${stem}.DESIGN.md`, 'design-md-variant', writeDesignMd({
        doc, name, selection, brief,
        ...(overview ? { description: firstSentence(overview) } : {}),
        variant: { ...(colourAxis ? { colourway: colourway.name } : {}), ...(modeOf ? { mode: mode.name } : {}) },
      }));
      variants.push({ colourway: colourway.id, colourwayName: colourway.name, mode: mode.id, modeName: mode.name, selection, slots, heroSurface, checks: { colourway: colourway.id, mode: mode.id, pairs } });
      for (const piece of documents) {
        const result = checkDesignHouseRules(piece.boxes, brandRules, doc, { selection, ...(input.catalog ? { catalog: input.catalog } : {}), ...(piece.background !== undefined ? { background: piece.background } : {}) });
        for (const ruleId of result.unknown) unknownRules.add(ruleId);
        for (const finding of result.findings) {
          counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
          const list = notes.get(finding.ruleId) ?? [];
          if (list.length < 16) list.push({ colourway: colourway.id, mode: mode.id, document: text(piece.id, 80), layer: text(finding.layerId, 80), message: text(finding.message, 300) });
          notes.set(finding.ruleId, list);
        }
      }
    }
  }
  const ruleChecks: BrandPageRuleCheckV1[] = rulesAll.map(rule => ({
    id: rule.id,
    label: text(rule.label, 300),
    kind: rule.kind,
    requirement: rule.requirement,
    state: unknownRules.has(rule.id) ? 'unknown' : documents.length ? 'checked' : 'not-run',
    findings: counts.get(rule.id) ?? 0,
    notes: notes.get(rule.id) ?? [],
  }));
  const checks: BrandPageChecksV1 = {
    version: BRAND_PAGE_VERSION, statement: CHECK_STATEMENT, documents: documents.map(d => text(d.id, 80)),
    variants: variants.map(v => v.checks), rules: ruleChecks,
  };
  addText('checks.json', 'checks', pretty(checks));

  const canonical = variants[0]!;
  addText('DESIGN.md', 'design-md', writeDesignMd({
    doc, name, selection: canonical.selection, brief,
    ...(overview ? { description: firstSentence(overview) } : {}),
    variant: { ...(colourAxis ? { colourway: canonical.colourwayName } : {}), ...(modeOf ? { mode: canonical.modeName } : {}) },
  }));

  // Logos. Sorted so input order cannot change the bytes.
  const include = new Set(input.include ?? []);
  const logos: PageFactsV1['logos'] = [];
  // An owner's terms go on the page with the marks they cover, beside any words of the publisher's.
  const ownerTerms: string[] = [];
  for (const logo of [...(input.logos ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const label = text(logo.name, 200) || logo.id;
    const answer = redistribution({ license: logo.license, rights: logo.rights, attribution: logo.attribution, brandLock: logo.brandLock });
    if (!answer.travels && (answer.kind === 'policy' || !include.has(logo.id))) { hold(logo.id, answer.reason, answer.kind); continue; }
    const format = pathSegment(logo.format).toLowerCase();
    if (format === 'svg') {
      const problem = brandPageSvgProblem(new TextDecoder().decode(logo.bytes));
      if (problem) { hold(logo.id, problem, 'content'); continue; }
    }
    const path = `logos/${logo.id.split('/').map(pathSegment).filter(Boolean).join('/')}.${format}`;
    if (!add(path, 'logo', logo.bytes)) continue;
    logos.push({ id: logo.id, name: label, path, ...surfaceOfLogo(brief, logo.id), ...(answer.licence ? { licence: answer.licence } : {}) });
    if (answer.owner && !ownerTerms.includes(answer.owner.terms)) ownerTerms.push(answer.owner.terms);
  }
  const logoFor = (want: unknown, surface: 'light' | 'dark'): string | null => {
    const hit = logos.find(l => l.id === want) ?? logos.find(l => l.surface === surface && !l.mono) ?? logos.find(l => l.surface === surface);
    return hit?.path ?? null;
  };
  const heroLogos = { onDark: logoFor(brief.logos.onDark, 'dark'), onLight: logoFor(brief.logos.onLight, 'light') };

  // Fonts: a recorded licence that allows it, and nothing overrides that.
  const families = new Map<string, string[]>();
  for (const f of brief.fonts) {
    const family = String(f.value).split(',')[0]!.trim().replace(/^['"]|['"]$/g, '');
    if (!family) continue;
    families.set(family, [...(families.get(family) ?? []), f.path]);
  }
  const fontFiles = new Map<string, { paths: string[]; licence: string; licenceFile: string | null }>();
  for (const font of [...(input.fonts ?? [])].sort((a, b) => `${a.family}${a.weight}${a.style}`.localeCompare(`${b.family}${b.weight}${b.style}`, 'en'))) {
    const label = [font.family, font.weight, font.style].filter(Boolean).join(' ');
    const answer = redistribution({ license: font.license, rights: font.rights });
    if (font.embedding === 'restricted') { hold(`Font ${label}`, 'the font file says it must not be embedded or passed on', 'licence'); continue; }
    if (!answer.travels) { hold(`Font ${label}`, answer.reason, answer.kind); continue; }
    const stem = [font.family, font.weight, font.style].filter(Boolean).map(s => slug(String(s))).filter(Boolean).join('-') || 'font';
    const path = `fonts/${stem}.${pathSegment(font.format).toLowerCase()}`;
    if (!add(path, 'font', font.bytes)) continue;
    const row = fontFiles.get(font.family) ?? { paths: [], licence: answer.licence, licenceFile: null };
    row.paths.push(path);
    if (font.licenceText && !row.licenceFile) {
      const licencePath = `fonts/${slug(font.family) || 'font'}-licence.txt`;
      if (add(licencePath, 'font', font.licenceText)) row.licenceFile = licencePath;
    }
    fontFiles.set(font.family, row);
  }
  const outlines = input.outlines ?? [];
  const validOutline = (o: BrandPageOutlineV1): boolean => /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*$/.test(o.d) && o.d.length <= 2_000_000 && Number.isFinite(o.viewBox.width) && o.viewBox.width > 0 && Number.isFinite(o.viewBox.height) && o.viewBox.height > 0;
  const specimenFor = (family: string): BrandPageOutlineV1 | null => outlines.find(o => o.role === 'specimen' && o.family === family && validOutline(o)) ?? null;
  const faces: PageFactsV1['faces'] = [...families].map(([family, tokens]) => {
    const file = fontFiles.get(family);
    const source = input.fontSources?.[family];
    if (!file && !(input.fonts ?? []).some(f => f.family === family)) hold(`Font ${family}`, 'no font file with a recorded licence that allows passing it on', 'unknown');
    return {
      // Upright first, because the page's "Font file" link goes to the first file.
      family, tokens, files: [...(file?.paths ?? [])].sort((a, b) => Number(a.includes('italic')) - Number(b.includes('italic')) || (a < b ? -1 : 1)),
      licence: file?.licence || text(source?.licence, 120) || null,
      licenceFile: file?.licenceFile ?? null,
      source: source?.url && /^https?:\/\//.test(source.url) ? source.url.slice(0, 2000) : null,
      outline: specimenFor(family),
    };
  });
  const nameOutline = outlines.find(o => o.role === 'name' && validOutline(o)) ?? null;

  // Skills: public only. Names of internal skills stay out of a public list.
  const skills: PageFactsV1['skills'] = [];
  const skillRows = input.skills ?? [];
  const internal = skillRows.filter(s => s.audience !== 'public').length;
  if (internal) hold(internal === 1 ? 'An internal brand skill' : `${internal} internal brand skills`, 'internal skills are not published', 'policy');
  for (const skill of [...skillRows].filter(s => s.audience === 'public').sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const folder = pathSegment(skill.name);
    if (!folder) { hold(`Brand skill ${text(skill.name, 80)}`, 'its name cannot be used as a folder', 'content'); continue; }
    const paths = Object.keys(skill.files).sort();
    if (paths.some(p => p.split('/').some(seg => seg === '..' || seg === '' || seg === '.'))) { hold(`Brand skill ${folder}`, 'a file in the skill has an unsafe path', 'content'); continue; }
    for (const rel of paths) {
      const value = skill.files[rel]!;
      add(`skills/${folder}/${rel}`, 'skill', typeof value === 'string' ? ENCODER.encode(value) : value);
    }
    skills.push({ name: folder, label: text(skill.label, 200) || folder, description: text(skill.description, 400), discipline: text(skill.discipline, 60), path: `skills/${folder}/SKILL.md` });
  }

  // Examples.
  const examples: PageFactsV1['examples'] = [];
  // In the host's order: a poster before its slides reads better than the alphabet.
  for (const example of input.examples ?? []) {
    const problem = brandPageSvgProblem(example.svg);
    if (problem) { hold(`Example ${example.id}`, problem, 'content'); continue; }
    const path = `examples/${pathSegment(example.id) || 'example'}.svg`;
    if (addText(path, 'example', example.svg)) examples.push({ id: example.id, name: text(example.name, 200) || example.id, path });
  }

  // Named colours, in the canonical variant.
  const named = createTokenSet(doc, { selection: canonical.selection }).colors()
    .filter(c => !/^color\.(semantic|chrome|role|colourway)\./.test(c.path))
    .flatMap(c => { const value = hexOf(c.value); return value ? [{ name: text(c.name, 80) || c.path, path: c.path, value }] : []; })
    // A chart spectrum repeats named colours. One swatch per name and value is enough.
    .filter((c, i, all) => all.findIndex(o => o.name === c.name && o.value === c.value) === i)
    .slice(0, 240);

  const tokenPaths = createTokenSet(doc, { selection: canonical.selection }).query().map(e => e.path);
  const colourways: BrandPageColourwayV1[] = colourwayRows.map(c => ({ id: c.id, name: c.name, modes: modes.map(m => m.id) }));
  const usage = cleanUsage(withOwnerTerms(input.usage, ownerTerms));
  const origin = input.origin && /^https?:\/\//.test(input.origin) ? input.origin.replace(/\/+$/, '').slice(0, 2000) : null;
  const orderedHeld = sortHeld(held);
  const facts: PageFactsV1 = {
    id, name, summary: overview ? firstSentence(overview) : `The ${name} design system.`, overview, usage, origin,
    colourways, modes: modes.map(m => ({ id: m.id, name: m.name })), variants, named, logos, heroLogos, faces, nameOutline, examples,
    rules, skills, checks, held: orderedHeld, tokenPaths, madeWith: input.madeWith !== false,
    masterSize: brief.coverage.type === 'declared' && brief.master?.size ? { width: brief.master.size.width, height: brief.master.size.height } : null,
  };

  addText('assets/page.css', 'page-style', writePageCss(facts));
  addText('index.html', 'page', writeIndexHtml(facts));
  addText('index.md', 'page-markdown', writeIndexMd(facts));
  addText('AGENTS.md', 'agents', writeAgentsMd(facts));
  addText('llms.txt', 'llms', writeLlmsTxt(facts));

  const sorted = [...files.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const listed: BrandPageFileV1[] = [];
  for (const file of sorted) {
    listed.push({ path: file.path, role: file.role as BrandPageFileRoleV1, mediaType: file.mediaType, sha256: bytesToHex(await sha256(file.bytes)), size: file.bytes.byteLength });
  }
  const pairs = checks.variants.flatMap(v => v.pairs);
  const body: Omit<BrandPageV1, 'digest'> = {
    version: BRAND_PAGE_VERSION, id, name, revision,
    ...(input.publishedVersion ? { publishedVersion: text(input.publishedVersion, 200) } : {}),
    ...(origin ? { origin } : {}),
    generator: { name: 'lolly', engine: ENGINE_VERSION, designMd: DESIGN_MD_TARGET },
    ...(usage ? { usage } : {}),
    colourways, files: listed,
    ...(logos.length ? { logos: logos.map(l => (l.id === brief.logos.onLight || l.id === brief.logos.onDark ? { ...l, primary: true } : l)) } : {}),
    held: orderedHeld,
    checks: {
      file: 'checks.json', variants: checks.variants.length, pairs: pairs.length, pairsBelow3: pairs.filter(p => p.reads === 'below-3').length,
      rules: ruleChecks.length, rulesWithFindings: ruleChecks.filter(r => r.findings > 0).length,
    },
  };
  const manifest: BrandPageV1 = { ...body, digest: await brandPageDigest(body) };
  const manifestFile: BrandPageFileOutV1 = { path: 'brand.json', role: 'manifest', mediaType: MEDIA.json!, bytes: ENCODER.encode(pretty(manifest)) };
  const out = [...sorted, manifestFile].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { manifest, checks, files: out };
}

/** The publisher's words first, then each owner's terms the words do not already hold. */
function withOwnerTerms(usage: BrandPageUsageV1 | undefined, terms: readonly string[]): BrandPageUsageV1 | undefined {
  if (!terms.length) return usage;
  const statement = typeof usage?.statement === 'string' ? usage.statement.trim() : '';
  const missing = terms.filter(term => !statement.includes(term));
  return { ...usage, statement: [statement, ...missing].filter(Boolean).join('\n\n') };
}

function cleanUsage(usage: BrandPageUsageV1 | undefined): BrandPageUsageV1 | null {
  if (!usage) return null;
  const statement = typeof usage.statement === 'string' ? usage.statement.trim().slice(0, 8000) : '';
  const contact = text(usage.contact, 400);
  const url = typeof usage.url === 'string' && /^https?:\/\//.test(usage.url) ? usage.url.slice(0, 2000) : '';
  return statement || contact || url ? { ...(statement ? { statement } : {}), ...(contact ? { contact } : {}), ...(url ? { url } : {}) } : null;
}

function sortHeld(rows: BrandPageHeldV1[]): BrandPageHeldV1[] {
  const seen = new Set<string>();
  const out: BrandPageHeldV1[] = [];
  for (const row of [...rows].sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0))) {
    const key = `${row.item}\n${row.reason}`;
    if (!seen.has(key)) { seen.add(key); out.push(row); }
  }
  return out;
}

export { SLOTS as BRAND_PAGE_SLOTS };
