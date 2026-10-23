// SPDX-License-Identifier: MPL-2.0
/**
 * Brand skills (plan 323): reading, admitting, mapping and exporting a brand's standards
 * when they arrive as Agent Skills.
 *
 * A brand skill is the brand's own text. Lolly never rewrites the stored bytes. What it
 * adds sits beside them: frontmatter when the file has none, links mapped to catalog
 * assets, a coverage map that sets what the skill says against what Lolly checks, and the
 * generated baseline every design system gets from its brief.
 *
 * Everything here is deterministic pattern work. No model reads the skill, so a coverage
 * row means "this line matched this pattern", never "Lolly understood the guide". The
 * catalog record and its validator live in `@lolly-tools/core/brand-skill-v1`.
 *
 * Pure: no network, no clock, no filesystem. Callers hand in bytes and catalog facts.
 */
import {
  BRAND_SKILL_FILES_MAX_BYTES, BRAND_SKILL_MAX_BYTES, BRAND_SKILL_MAX_REFERENCES, isBrandSkillReference,
  type BrandSkillIndexEntryV1, type BrandSkillMetaV1,
} from '@lolly-tools/core/brand-skill-v1';
import {
  isAgentSkillName, parseSkillFrontmatter, writeSkillFrontmatter, SKILL_DESCRIPTION_MAX,
  type SkillFrontmatterV1,
} from '@lolly-tools/core/skill-frontmatter-v1';
import { sha256Hex } from './bytes.ts';

/** One problem or note about a skill, for its owner. Advisory unless `severity` is `error`. */
export interface BrandSkillFindingV1 {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  line?: number;
}

export interface BrandSkillHeadingV1 {
  level: number;
  text: string;
  slug: string;
  line: number;
}

export interface BrandSkillLinkV1 {
  target: string;
  text: string;
  line: number;
  image: boolean;
}

export interface ParsedBrandSkillV1 {
  frontmatter: SkillFrontmatterV1;
  /** The body after any frontmatter, unchanged. */
  body: string;
  headings: BrandSkillHeadingV1[];
  links: BrandSkillLinkV1[];
  findings: BrandSkillFindingV1[];
  lines: number;
  /** Characters divided by four: the rough token count the specification's 5000 guide uses. */
  approxTokens: number;
}

const FENCE = /^\s{0,3}(```|~~~)/;

function slugOf(text: string): string {
  return text.toLowerCase().replace(/[`*_~]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
}

/** The body's lines with a flag for fenced code, so patterns skip code samples. */
function bodyLines(body: string, offset: number): Array<{ text: string; line: number; code: boolean }> {
  let inFence: string | null = null;
  return body.split('\n').map((raw, i) => {
    const text = raw.replace(/\r$/, '');
    const fence = FENCE.exec(text);
    const code = inFence !== null || !!fence;
    if (fence) inFence = inFence === null ? fence[1]! : (inFence === fence[1] ? null : inFence);
    return { text, line: i + 1 + offset, code };
  });
}

const MD_LINK = /(!?)\[([^\]\n]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"\n]*")?\s*\)/g;
const AUTOLINK = /<(https?:\/\/[^>\s]+)>/g;
const BARE_URL = /https?:\/\/[^\s`'"<>()[\]]+/g;

/**
 * Scope hints: phrases that reach past brand intent into permissions or code. An owner
 * reads these as lint. They are no safety claim: a skill without them can still mislead.
 */
const SCOPE_PATTERNS: Array<{ code: string; pattern: RegExp; message: string }> = [
  { code: 'scope.override', pattern: /\b(ignore|disregard|forget)\b.{0,30}\b(previous|prior|above|earlier|other|system)\b.{0,20}\b(instructions?|prompts?|rules?)\b/i, message: 'Asks the reader to set aside other instructions. A brand skill speaks for brand intent only.' },
  { code: 'scope.permission', pattern: /\b(you (are|have been) (granted|given|allowed)|grant yourself|without asking|do not ask (for )?(permission|confirmation))\b/i, message: 'Speaks about permissions. Grants decide what an agent may do; a skill cannot.' },
  { code: 'scope.tools', pattern: /^\s*allowed-tools\s*:/i, message: 'Names allowed tools. Lolly does not grant tools from a brand skill.' },
  { code: 'scope.execute', pattern: /\b(curl|wget)\b[^|\n]*\|\s*(ba|z)?sh\b|\b(run|execute)\s+(this|the following)\s+(command|script|code)\b/i, message: 'Asks the reader to run code. A brand skill is guidance, not a script.' },
];

export function brandSkillScopeHints(text: string): BrandSkillFindingV1[] {
  const out: BrandSkillFindingV1[] = [];
  text.split('\n').forEach((line, i) => {
    for (const p of SCOPE_PATTERNS) if (p.pattern.test(line)) out.push({ code: p.code, severity: 'warning', message: p.message, line: i + 1 });
  });
  return out;
}

/** Reads a skill's text: frontmatter, headings, links and the owner's lint findings. */
export function parseBrandSkill(text: string): ParsedBrandSkillV1 {
  const frontmatter = parseSkillFrontmatter(text);
  const body = frontmatter.body;
  const offset = frontmatter.present && !frontmatter.errors.some((e) => e.includes('not closed')) ? text.slice(0, frontmatter.length).split('\n').length - 1 : 0;
  const rows = bodyLines(body, offset);
  const findings: BrandSkillFindingV1[] = [];
  const headings: BrandSkillHeadingV1[] = [];
  const links: BrandSkillLinkV1[] = [];
  for (const row of rows) {
    if (row.code) continue;
    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(row.text);
    if (h?.[2]) headings.push({ level: h[1]!.length, text: h[2].replace(/\*\*/g, '').trim(), slug: slugOf(h[2]), line: row.line });
    let masked = row.text;
    for (const m of row.text.matchAll(MD_LINK)) {
      links.push({ target: m[3]!, text: m[2]!, line: row.line, image: m[1] === '!' });
      masked = masked.replace(m[0], ' '.repeat(m[0].length));
    }
    for (const m of masked.matchAll(AUTOLINK)) {
      links.push({ target: m[1]!, text: m[1]!, line: row.line, image: false });
      masked = masked.replace(m[0], ' '.repeat(m[0].length));
    }
    for (const m of masked.matchAll(BARE_URL)) {
      const target = m[0].replace(/[.,;:!?]+$/, '');
      links.push({ target, text: target, line: row.line, image: false });
    }
  }
  if (!frontmatter.present) {
    findings.push({ code: 'frontmatter.absent', severity: 'info', message: 'No frontmatter. Lolly supplies the name and description from the catalog record when it hands the skill out.' });
  }
  for (const error of frontmatter.errors) findings.push({ code: 'frontmatter.invalid', severity: 'error', message: error, line: 1 });
  if (frontmatter.present && !frontmatter.errors.length) {
    const { name, description } = frontmatter.fields;
    if (name !== undefined && !isAgentSkillName(name)) findings.push({ code: 'frontmatter.name', severity: 'warning', message: `The name "${name}" is not an Agent Skills name (lowercase letters, digits and single hyphens, at most 64 characters). Lolly uses the catalog name instead.`, line: 2 });
    if (description !== undefined && (!description.trim() || description.length > SKILL_DESCRIPTION_MAX)) findings.push({ code: 'frontmatter.description', severity: 'warning', message: `The description must be 1 to ${SKILL_DESCRIPTION_MAX} characters. Lolly uses the catalog description instead.` });
  }
  if (rows.length > 500) findings.push({ code: 'body.lines', severity: 'warning', message: `The body has ${rows.length} lines. The Agent Skills guide keeps a SKILL.md under 500 and moves detail into references.` });
  const approxTokens = Math.ceil(body.length / 4);
  if (approxTokens > 5000) findings.push({ code: 'body.tokens', severity: 'warning', message: `The body is about ${approxTokens} tokens. The Agent Skills guide keeps a SKILL.md under 5000 and moves detail into references.` });
  let open: number | null = null;
  for (const row of rows) if (FENCE.test(row.text)) open = open === null ? row.line : null;
  if (open !== null) findings.push({ code: 'body.fence', severity: 'warning', message: 'A code fence is never closed, so everything after it reads as code.', line: open });
  const seen = new Map<string, number>();
  for (const h of headings) {
    const key = `${h.level}:${h.slug}`;
    if (seen.has(key)) findings.push({ code: 'heading.duplicate', severity: 'info', message: `The heading "${h.text}" appears twice at the same level, so a citation to it is ambiguous.`, line: h.line });
    else seen.set(key, h.line);
  }
  const hosts = new Map<string, number>();
  for (const l of links) {
    if (!/^https?:\/\//i.test(l.target)) continue;
    try { const host = new URL(l.target).host; if (!hosts.has(host)) hosts.set(host, l.line); } catch { /* not a URL then */ }
  }
  for (const [host, line] of hosts) findings.push({ code: 'link.external', severity: 'info', message: `Links to ${host}. Lolly never fetches external links and cannot say whether an agent can open them.`, line });
  for (const hint of brandSkillScopeHints(body)) findings.push({ ...hint, line: (hint.line ?? 0) + offset });
  return { frontmatter, body, headings, links, findings, lines: rows.length, approxTokens };
}

/** An admitted skill: its text, references and fingerprint, ready to store or serve. */
export interface AdmittedBrandSkillV1 {
  markdown: string;
  references: Record<string, string>;
  /** `sha256:<hex>`: of SKILL.md alone when there are no references, else of a `<hex>  <path>` manifest. */
  sha256: string;
  size: number;
  parsed: ParsedBrandSkillV1;
}

export type BrandSkillAdmissionV1 = { ok: true; skill: AdmittedBrandSkillV1 } | { ok: false; code: string; reason: string };

const EXECUTABLE = /\.(?:js|mjs|cjs|ts|mts|cts|jsx|tsx|py|pyc|sh|bash|zsh|fish|ps1|psm1|bat|cmd|exe|com|dll|so|dylib|rb|pl|php|lua|jar|class|wasm|bin|app|scr|vbs|applescript)$/i;

/**
 * Admits a skill's files. `files` maps a path to its bytes: `SKILL.md` plus optional
 * `references/*`. A single Markdown file under any name stands in for SKILL.md, because
 * brands hand over one `.md` as often as a folder. Anything else is refused with a reason:
 * scripts, images (a skill names catalog assets by id), traversal, malformed UTF-8 and
 * files over the limits. Nothing is stripped silently and nothing is admitted in part.
 */
export async function admitBrandSkill(files: Record<string, Uint8Array>): Promise<BrandSkillAdmissionV1> {
  const paths = Object.keys(files);
  const refuse = (code: string, reason: string): BrandSkillAdmissionV1 => ({ ok: false, code, reason });
  if (!paths.length) return refuse('empty', 'No files were supplied.');
  for (const path of paths) {
    if (path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split('/').some((p) => p === '..' || p === '.' || p === '')) {
      return refuse('path', `The path "${path}" leaves the skill folder.`);
    }
    if (path.split('/')[0] === 'scripts' || EXECUTABLE.test(path)) {
      return refuse('executable', `"${path}" is code. A brand skill is guidance, so it cannot carry scripts or executables.`);
    }
  }
  const markdownPaths = paths.filter((p) => /\.md$/i.test(p) && !p.includes('/'));
  const entryPath = paths.includes('SKILL.md') ? 'SKILL.md' : (paths.length === 1 && markdownPaths.length === 1 ? markdownPaths[0]! : null);
  if (!entryPath) return refuse('entry', 'No SKILL.md was found. Supply one Markdown file, or a folder with SKILL.md at its top.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const decode = (path: string): string | null => {
    try { return decoder.decode(files[path]!).replace(/^﻿/, ''); } catch { return null; }
  };
  const entryBytes = files[entryPath]!;
  if (entryBytes.length > BRAND_SKILL_MAX_BYTES) return refuse('size', `SKILL.md is ${entryBytes.length} bytes; the limit is ${BRAND_SKILL_MAX_BYTES}.`);
  const markdown = decode(entryPath);
  if (markdown === null) return refuse('encoding', `${entryPath} is not valid UTF-8 text.`);
  const references: Record<string, string> = {};
  const refPaths = paths.filter((p) => p !== entryPath).sort();
  if (refPaths.length > BRAND_SKILL_MAX_REFERENCES) return refuse('references', `${refPaths.length} reference files; the limit is ${BRAND_SKILL_MAX_REFERENCES}.`);
  let total = entryBytes.length;
  for (const path of refPaths) {
    if (path.startsWith('assets/')) return refuse('asset-file', `"${path}" is a file inside the skill. Images and other media a skill refers to must be catalog assets, named by id.`);
    if (!isBrandSkillReference(path)) return refuse('reference-path', `"${path}" is not a reference Lolly carries. References sit one level deep under references/ as .md, .json, .csv or .txt.`);
    total += files[path]!.length;
    if (total > BRAND_SKILL_FILES_MAX_BYTES) return refuse('size', `The skill and its references exceed ${BRAND_SKILL_FILES_MAX_BYTES} bytes.`);
    const text = decode(path);
    if (text === null) return refuse('encoding', `${path} is not valid UTF-8 text.`);
    references[path] = text;
  }
  const parsed = parseBrandSkill(markdown);
  const invalid = parsed.findings.find((f) => f.severity === 'error');
  if (invalid) return refuse('frontmatter', invalid.message);
  let sha256: string;
  if (!refPaths.length) sha256 = `sha256:${await sha256Hex(entryBytes)}`;
  else {
    const rows: string[] = [];
    for (const path of ['SKILL.md', ...refPaths]) rows.push(`${await sha256Hex(path === 'SKILL.md' ? entryBytes : files[path]!)}  ${path}\n`);
    sha256 = `sha256:${await sha256Hex(new TextEncoder().encode(rows.join('')))}`;
  }
  return { ok: true, skill: { markdown, references, sha256, size: total, parsed } };
}

/** The fields of a catalog asset that link mapping reads. */
export interface BrandSkillCatalogAssetV1 {
  id: string;
  type?: string;
  name?: string;
  formats?: Array<{ format: string; url: string }>;
}

export interface BrandSkillLinkClassV1 extends BrandSkillLinkV1 {
  kind: 'asset' | 'file' | 'anchor' | 'external' | 'other';
  /** The catalog asset the link means: by id, by catalog url, or by an approved mapping. */
  asset?: string;
  /** The catalog url of that asset's first format. */
  assetUrl?: string;
  /** For an external link: the one asset whose file name matches best, for the owner to approve. */
  proposed?: string;
  /** Every asset whose file-name words all appear in the link's file name, best first. */
  candidates?: string[];
  approved?: boolean;
}

/** The words of a URL's file name: `SUSE_Logo-hor_L_Green-pos_sRGB.svg` is suse, logo, hor, l, green, pos, srgb. */
const words = (url: string): string[] => {
  const path = url.split(/[?#]/)[0]!;
  return (path.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
};

/**
 * Sorts a skill's links into catalog assets, the skill's own files, anchors and external
 * URLs. An external URL the owner mapped (`meta.references`) counts as its asset; one whose
 * file name matches an asset's file is proposed, never assumed.
 */
export function classifyBrandSkillLinks(
  links: readonly BrandSkillLinkV1[],
  assets: readonly BrandSkillCatalogAssetV1[],
  meta?: Pick<BrandSkillMetaV1, 'references'> | null,
): BrandSkillLinkClassV1[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const byUrl = new Map<string, BrandSkillCatalogAssetV1>();
  const named: Array<{ asset: BrandSkillCatalogAssetV1; words: string[] }> = [];
  for (const a of assets) for (const f of a.formats ?? []) {
    byUrl.set(f.url, a);
    const w = words(f.url);
    if (w.length >= 2 && !named.some((n) => n.asset.id === a.id)) named.push({ asset: a, words: w });
  }
  const approved = new Map((meta?.references ?? []).map((r) => [r.url, r.asset]));
  const urlOf = (a: BrandSkillCatalogAssetV1 | undefined): string | undefined => a?.formats?.[0]?.url;
  return links.map((link) => {
    const target = link.target;
    const id = target.replace(/^asset:/, '');
    if (byId.has(id)) return { ...link, kind: 'asset', asset: id, ...(urlOf(byId.get(id)) ? { assetUrl: urlOf(byId.get(id)) } : {}) };
    const pathOnly = target.split(/[?#]/)[0]!;
    if (byUrl.has(pathOnly)) { const a = byUrl.get(pathOnly)!; return { ...link, kind: 'asset', asset: a.id, assetUrl: pathOnly }; }
    if (target.startsWith('#')) return { ...link, kind: 'anchor' };
    if (/^https?:\/\//i.test(target)) {
      const mapped = approved.get(target);
      if (mapped) return { ...link, kind: 'asset', asset: mapped, approved: true, ...(urlOf(byId.get(mapped)) ? { assetUrl: urlOf(byId.get(mapped)) } : {}) };
      // A catalog file whose every word is in the link's file name is a candidate. The
      // owner approves a mapping; one best candidate is offered, a tie offers none.
      const linkWords = new Set(words(target));
      const hits = named.filter((n) => n.words.every((w) => linkWords.has(w)))
        .sort((a, b) => b.words.length - a.words.length || a.asset.id.localeCompare(b.asset.id));
      const best = hits.length && (hits.length === 1 || hits[0]!.words.length > hits[1]!.words.length) ? hits[0]!.asset.id : undefined;
      return { ...link, kind: 'external', ...(hits.length ? { candidates: hits.map((h) => h.asset.id) } : {}), ...(best ? { proposed: best } : {}) };
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith('/')) return { ...link, kind: 'file' };
    return { ...link, kind: 'other' };
  });
}

/** The design-system facts a coverage map compares a skill against. */
export interface BrandSkillCoverageFactsV1 {
  colours: Array<{ value: string; name?: string; path?: string }>;
  /** Font family stacks as the tokens state them (`SUSE, sans-serif`). */
  fonts: string[];
  houseRules: Array<{ id: string; kind: string; label?: string }>;
}

export type BrandSkillCoverageStatusV1 = 'agree' | 'conflict' | 'not-in-tokens' | 'checked' | 'guidance-only';

export interface BrandSkillCoverageRowV1 {
  status: BrandSkillCoverageStatusV1;
  kind: 'colour' | 'font' | 'rule';
  /** The heading the line sits under, or '' before the first heading. */
  section: string;
  line: number;
  /** The first matching line, trimmed. */
  text: string;
  detail: string;
  /** House rule kind this matched, checked or not. */
  ruleKind?: string;
  ruleIds?: string[];
  /** Hex values, for colour rows. */
  values?: string[];
}

export interface BrandSkillCoverageV1 {
  rows: BrandSkillCoverageRowV1[];
  summary: Record<BrandSkillCoverageStatusV1, number>;
  note: string;
}

function hexOf(value: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const h = m[1]!.toLowerCase();
  return `#${h.length === 3 ? h.split('').map((c) => c + c).join('') : h}`;
}

const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong']);

/** Family names in declared stacks, generic families left out. */
function familiesOf(stacks: readonly string[]): string[] {
  const out = new Set<string>();
  for (const stack of stacks) for (const part of stack.split(',')) {
    const name = part.trim().replace(/^["']|["']$/g, '');
    if (name && !GENERIC_FAMILIES.has(name.toLowerCase())) out.add(name);
  }
  return [...out];
}

/** Words that say a line is about type, so a brand name or a placement word is not read as a type rule. */
const TYPE_WORDS = /\b(fonts?|typefaces?|type|typography|headlines?|headings?|sub ?heads?|sub ?headlines?|body|titles?|quotes?|text|weights?|captions?|labels?)\b/i;

/** Line patterns that point at a house rule kind. Weight and alignment words need a type word too. */
const RULE_PATTERNS: Array<{ kind: string; test: (line: string) => boolean }> = [
  { kind: 'text-case', test: (l) => /\b(all caps|uppercase|upper case|sentence case|title case|capitali[sz]ation)\b/i.test(l) },
  { kind: 'text-weight', test: (l) => /\b(semi ?bold|bold|medium|regular|light|weight)\b/i.test(l) && TYPE_WORDS.test(l) },
  { kind: 'text-align', test: (l) => /\b(align(ed|ment)?|centred|centered|justif(y|ied))\b/i.test(l) && TYPE_WORDS.test(l) && !/\blogo\b/i.test(l) },
  { kind: 'color-pairing', test: (l) => /\b(colou?r combinations?|backgrounds? and foregrounds?|\w+ backgrounds?\s*:)/i.test(l) },
  { kind: 'logo-surface', test: (l) => /\blogo\b/i.test(l) && /\b(background|surface|luminance)\b/i.test(l) },
  { kind: 'stroke-on-rounded', test: (l) => /\bstrokes?\b/i.test(l) && /\b(round(ed)?|corners?)\b/i.test(l) },
  { kind: 'dash-reserved', test: (l) => /\bdash(ed|es)?\b/i.test(l) && !/\bdashboards?\b/i.test(l) },
];

/** Statements no house rule kind can check yet, named so the owner sees the gap. */
const UNCHECKED_PATTERNS: Array<{ topic: string; test: (line: string) => boolean }> = [
  { topic: 'logo scale', test: (l) => /\blogo\b.*\b\d+\s*%|\b\d+\s*%.*\b(canvas|logo)\b/i.test(l) || (/\bscale\b/i.test(l) && /\b(logo|canvas)\b/i.test(l)) },
  { topic: 'logo clear space', test: (l) => /\b(clear ?space|clearance|minimum margin|padding around)\b/i.test(l) },
  { topic: 'orphans and widows', test: (l) => /\b(orphans?|widows?)\b/i.test(l) },
  { topic: 'type consistency', test: (l) => /\b(type consistency|same font size|same (font )?weight|consistent (size|weight)s?)\b/i.test(l) },
  { topic: 'logo position', test: (l) => /\b(default position|top-left|top left)\b/i.test(l) },
];

/**
 * Sets what a skill says against what the design system declares and what Lolly checks.
 * Colours are compared by hex value, fonts by family name, and statements are matched to
 * house rule kinds by fixed line patterns. Rows are grouped per section, so a palette
 * of forty swatches is one or two rows, not forty.
 */
export function brandSkillCoverage(body: string, facts: BrandSkillCoverageFactsV1): BrandSkillCoverageV1 {
  const declared = new Map<string, string[]>();
  for (const c of facts.colours) {
    const h = hexOf(c.value);
    if (h) declared.set(h, [...(declared.get(h) ?? []), c.name ?? c.path ?? h]);
  }
  const families = familiesOf(facts.fonts);
  const rulesByKind = new Map<string, Array<{ id: string; label?: string }>>();
  for (const r of facts.houseRules) rulesByKind.set(r.kind, [...(rulesByKind.get(r.kind) ?? []), r]);
  const rows: BrandSkillCoverageRowV1[] = [];
  const grouped = new Map<string, BrandSkillCoverageRowV1>();
  const colourSeen = new Set<string>();
  let section = '';
  const push = (key: string, row: BrandSkillCoverageRowV1, value?: string): void => {
    const hit = grouped.get(key);
    if (hit) { if (value && !hit.values!.includes(value)) hit.values!.push(value); return; }
    const fresh = { ...row, ...(value ? { values: [value] } : {}) };
    grouped.set(key, fresh);
    rows.push(fresh);
  };
  for (const row of bodyLines(body, 0)) {
    if (row.code) continue;
    const h = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(row.text);
    if (h) { section = h[1]!.replace(/\*\*/g, '').trim(); continue; }
    const text = row.text.trim();
    if (!text) continue;
    for (const m of text.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
      const h6 = hexOf(m[0]);
      if (!h6 || colourSeen.has(`${section}:${h6}`)) continue;
      colourSeen.add(`${section}:${h6}`);
      const known = declared.has(h6);
      push(`colour:${section}:${known}`, {
        status: known ? 'agree' : 'not-in-tokens', kind: 'colour', section, line: row.line, text: text.slice(0, 160),
        detail: known ? 'These values are colours in the design system.' : 'These values are not colours in the design system. Tokens win when Lolly renders; tell the owner which is right.',
      }, h6);
    }
    for (const family of families) {
      // A family named like the brand ("SUSE") counts only on a line about type.
      if (TYPE_WORDS.test(text) && !/\blogo\b/i.test(text) && new RegExp(`(^|[^\\w])${family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`).test(text)) {
        push(`font:${family}`, { status: 'agree', kind: 'font', section, line: row.line, text: text.slice(0, 160), detail: `${family} is a declared font family.` });
      }
    }
    const only = /\b(?:only|always)\s+use\s+(?:the\s+)?([A-Z][\w-]*(?:\s+[A-Z][\w-]*)*)\s+font\b|\bnever use a font that is not (?:the\s+)?([A-Z][\w-]*(?:\s+[A-Z][\w-]*)*)\s+font\b/i.exec(text);
    if (only) {
      const named = (only[1] ?? only[2])!;
      const others = families.filter((f) => f !== named && !f.startsWith(`${named} `));
      push(`exclusive:${named}`, {
        status: others.length ? 'conflict' : 'agree', kind: 'font', section, line: row.line, text: text.slice(0, 160),
        detail: others.length
          ? `The skill allows only ${named}; the design system also declares ${others.join(', ')}. Tell the owner which is right.`
          : `The design system declares ${named} and no other family.`,
      });
    }
    for (const p of RULE_PATTERNS) {
      if (!p.test(text)) continue;
      const rules = rulesByKind.get(p.kind) ?? [];
      push(`rule:${section}:${p.kind}`, rules.length
        ? { status: 'checked', kind: 'rule', section, line: row.line, text: text.slice(0, 160), ruleKind: p.kind, ruleIds: rules.map((r) => r.id), detail: `Lolly checks this kind of statement with ${rules.map((r) => r.label ?? r.id).join(', ')}. Read the rule to see whether it says the same thing.` }
        : { status: 'guidance-only', kind: 'rule', section, line: row.line, text: text.slice(0, 160), ruleKind: p.kind, detail: `Not checked: the design system has no ${p.kind} rule. One could be drafted in Usage & rules.` });
    }
    for (const p of UNCHECKED_PATTERNS) {
      // A section named for the topic ("Orphans and widows") counts for its lines.
      if (!p.test(text) && !p.test(section)) continue;
      push(`gap:${section}:${p.topic}`, { status: 'guidance-only', kind: 'rule', section, line: row.line, text: text.slice(0, 160), detail: `Not checked: Lolly has no rule for ${p.topic} yet.` });
    }
  }
  const summary: Record<BrandSkillCoverageStatusV1, number> = { agree: 0, conflict: 0, 'not-in-tokens': 0, checked: 0, 'guidance-only': 0 };
  for (const r of rows) summary[r.status]++;
  return {
    rows, summary,
    note: 'Lines were matched by fixed patterns: colour values, font names and words that point at a house rule. Nothing here says Lolly understood the guide, and lines that matched nothing are guidance for people and agents to read.',
  };
}

/** The coverage facts of a design brief (or anything with the brief's colours, fonts and house rules). */
export function brandSkillCoverageFacts(brief: { colors?: unknown; fonts?: unknown; houseRules?: unknown } | null | undefined): BrandSkillCoverageFactsV1 {
  const list = (v: unknown): Array<Record<string, unknown>> => Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
  return {
    colours: list(brief?.colors).filter((c) => typeof c.value === 'string').map((c) => ({ value: c.value as string, ...(typeof c.name === 'string' ? { name: c.name } : {}), ...(typeof c.path === 'string' ? { path: c.path } : {}) })),
    fonts: list(brief?.fonts).map((f) => f.value).filter((v): v is string => typeof v === 'string'),
    houseRules: list(brief?.houseRules).filter((r) => typeof r.id === 'string' && typeof r.kind === 'string').map((r) => ({ id: r.id as string, kind: r.kind as string, ...(typeof r.label === 'string' ? { label: r.label } : {}) })),
  };
}

export type BrandSkillExportModeV1 = 'linked' | 'bundled';

export interface BrandSkillExportInputV1 {
  /** The stored SKILL.md text, unchanged. */
  markdown: string;
  references?: Record<string, string>;
  meta: BrandSkillMetaV1;
  asset: { id: string; version: string; name?: string; license?: string; url?: string };
  system?: { id?: string; label?: string };
  /** The admitted fingerprint (`sha256:<hex>`). */
  sha256: string;
  mode: BrandSkillExportModeV1;
  /** The instance origin (`https://lolly.tools`); linked mode needs one to point anywhere. */
  origin?: string;
  /** Classified links, from classifyBrandSkillLinks. */
  links?: readonly BrandSkillLinkClassV1[];
  /** Bundled mode: the bytes for each asset id the caller may redistribute. */
  bundle?: Record<string, { file: string; bytes: Uint8Array }>;
  /** Assets the caller held back, with the reason (licence, audience, budget). */
  heldBack?: Array<{ asset: string; reason: string }>;
  /** Extra files for the folder: exemplars under assets/ and a conformance profile under references/. */
  extras?: Record<string, string | Uint8Array>;
  coverage?: BrandSkillCoverageV1;
}

export interface BrandSkillExportV1 {
  name: string;
  /** Paths inside a folder called `name`. */
  files: Record<string, string | Uint8Array>;
  rewrites: Array<{ from: string; to: string }>;
  heldBack: Array<{ asset: string; reason: string }>;
}

const ENCODER = new TextEncoder();

/**
 * A standards-conforming Agent Skills folder for one brand skill: `SKILL.md`, its
 * references, any bundled assets and a `lolly.json` companion that says where it came
 * from. The body changes only where a link target is rewritten, and every rewrite is
 * listed in the companion. Frontmatter is generated when the source has none; when it
 * has some, only Lolly's `metadata` keys are merged in.
 */
export function exportBrandSkillFolder(input: BrandSkillExportInputV1): BrandSkillExportV1 {
  const fm = parseSkillFrontmatter(input.markdown);
  const name = isAgentSkillName(fm.fields.name) ? fm.fields.name : input.meta.name;
  const origin = input.origin?.replace(/\/+$/, '');
  const rewrites: Array<{ from: string; to: string }> = [];
  const heldBack = [...(input.heldBack ?? [])];
  const files: Record<string, string | Uint8Array> = {};
  let body = fm.body;
  const seen = new Set<string>();
  for (const link of input.links ?? []) {
    if (link.kind !== 'asset' || !link.asset || seen.has(link.target)) continue;
    seen.add(link.target);
    let to: string | null = null;
    if (input.mode === 'bundled') {
      const b = input.bundle?.[link.asset];
      if (b) { to = `assets/${b.file}`; files[to] = b.bytes; }
      else if (!heldBack.some((h) => h.asset === link.asset)) heldBack.push({ asset: link.asset, reason: 'Not bundled: no redistributable file was supplied for it.' });
    } else if (origin && link.assetUrl) to = `${origin}${link.assetUrl}`;
    if (to && to !== link.target) {
      body = body.split(link.target).join(to);
      rewrites.push({ from: link.target, to });
    }
  }
  const source = origin && input.asset.url ? `${origin}${input.asset.url}` : `asset:${input.asset.id}`;
  const metadata: Record<string, string> = {
    ...fm.metadata,
    'lolly-asset': input.asset.id,
    'lolly-source': source,
    'lolly-revision': input.meta.skillRevision,
    'lolly-version': input.asset.version,
    'lolly-sha256': input.sha256.replace(/^sha256:/, ''),
    'lolly-audience': input.meta.audience,
    ...(input.meta.generated ? { 'lolly-generated': 'true' } : {}),
  };
  const fields: Record<string, string> = fm.present && !fm.errors.length
    ? { ...fm.fields, name }
    : { name, description: input.meta.description, ...(input.asset.license ? { license: input.asset.license } : {}) };
  if (!fields.description?.trim() || fields.description.length > SKILL_DESCRIPTION_MAX) fields.description = input.meta.description;
  files['SKILL.md'] = `${writeSkillFrontmatter(fields, metadata)}\n${body.replace(/^\r?\n/, '')}`;
  for (const [path, text] of Object.entries(input.references ?? {})) files[path] = text;
  for (const [path, bytes] of Object.entries(input.extras ?? {})) files[path] = bytes;
  files['lolly.json'] = `${JSON.stringify({
    format: 'lolly-brand-skill', version: 1,
    asset: input.asset.id, assetVersion: input.asset.version, name, label: input.asset.name ?? name,
    ...(input.system ? { system: input.system } : {}),
    discipline: input.meta.discipline, audience: input.meta.audience, status: input.meta.status,
    skillRevision: input.meta.skillRevision, sha256: input.sha256, source, mode: input.mode,
    ...(input.meta.owner ? { owner: input.meta.owner } : {}),
    ...(input.meta.maintainer ? { maintainer: input.meta.maintainer } : {}),
    note: 'This folder is a snapshot. The body is the brand\'s text; only the link targets listed in rewrites were changed. Run `lolly system skill check <folder>` to compare it with the design system\'s current revision.',
    rewrites, heldBack,
    ...(input.coverage ? { coverage: input.coverage } : {}),
  }, null, 2)}\n`;
  return { name, files, rewrites, heldBack };
}

export interface BrandSkillFreshnessV1 {
  status: 'current' | 'outdated' | 'unknown';
  asset?: string;
  installed: { revision?: string; version?: string; sha256?: string };
  current?: { revision: string; version: string; sha256?: string };
  message: string;
}

/**
 * Compares an exported SKILL.md with the design system's current record, by the metadata
 * keys the export wrote. A copy without them is `unknown`: Lolly cannot tell where it came from.
 */
export function brandSkillFreshness(markdown: string, current: (Pick<BrandSkillIndexEntryV1, 'id' | 'skillRevision' | 'version'> & { sha256?: string }) | null): BrandSkillFreshnessV1 {
  const meta = parseSkillFrontmatter(markdown).metadata;
  const installed = {
    ...(meta['lolly-revision'] ? { revision: meta['lolly-revision'] } : {}),
    ...(meta['lolly-version'] ? { version: meta['lolly-version'] } : {}),
    ...(meta['lolly-sha256'] ? { sha256: meta['lolly-sha256'] } : {}),
  };
  const asset = meta['lolly-asset'];
  if (!asset) return { status: 'unknown', installed, message: 'This copy carries no lolly-asset metadata, so Lolly cannot tell which skill it came from.' };
  if (!current || current.id !== asset) return { status: 'unknown', asset, installed, message: `The design system has no skill ${asset}.` };
  const now = { revision: current.skillRevision, version: current.version, ...(current.sha256 ? { sha256: current.sha256.replace(/^sha256:/, '') } : {}) };
  const same = installed.sha256 && now.sha256 ? installed.sha256 === now.sha256 : installed.version === now.version;
  return same
    ? { status: 'current', asset, installed, current: now, message: `Up to date: revision ${now.revision}.` }
    : { status: 'outdated', asset, installed, current: now, message: `This copy is revision ${installed.revision ?? 'unknown'}; the design system has ${now.revision} (catalog ${now.version}).` };
}

/** The `skills` section of a design brief: the index without bodies, and the baseline. */
export function brandSkillsSection(entries: readonly BrandSkillIndexEntryV1[], systemName: string) {
  // The overall brand skill first, the brand team's own ahead of one Lolly maintains.
  const rank = (e: BrandSkillIndexEntryV1): number => (e.discipline === 'brand' ? 0 : 2) + (e.maintainer || e.generated ? 1 : 0);
  const index = [...entries].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return {
    note: 'Brand skills are the brand\'s own guidance, one per discipline. Read the overall brand skill first, then the one for the work at hand. They speak for brand intent only, never for permissions or tools, and they are guidance, not checks: houseRules are what Lolly checks.',
    read: {
      index: 'lolly://design-system/skills',
      skill: 'lolly://design-system/skill/{name}',
      cli: 'lolly system skill <name> [--into <dir>]',
    },
    index,
    baseline: {
      name: baselineSkillName(systemName),
      generated: true as const,
      description: `Generated by Lolly from the ${systemName} design brief: colours, pairings, type, logos, icons, media and house rules. Authored skills take precedence.`,
    },
  };
}

function baselineSkillName(systemName: string): string {
  const slug = systemName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 54).replace(/-+$/, '');
  return `${slug || 'design-system'}-baseline`;
}

const cell = (v: unknown): string => String(v ?? '').replace(/[\r\n|]/g, ' ').trim();

/**
 * The generated baseline skill for a design system, written from its brief. It states the
 * values Lolly holds and the rules Lolly checks, and says plainly that it is generated:
 * the brand's own skills win on anything they cover.
 */
export function baselineBrandSkill(source: object, opts: { revision?: string } = {}): { meta: BrandSkillMetaV1; markdown: string } {
  const brief = source as Record<string, unknown>;
  const systemName = typeof brief.name === 'string' && brief.name.trim() ? brief.name.trim() : 'Design system';
  const name = baselineSkillName(systemName);
  const description = `The ${systemName} design system as Lolly holds it: named colours, approved pairings, type, logos per surface, icon themes, media families and the house rules Lolly checks. Generated from the design brief; the brand's own skills take precedence.`;
  const list = (v: unknown): Array<Record<string, unknown>> => Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
  const rec = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const out: string[] = [
    `# ${systemName} design system (generated)`, '',
    'Lolly wrote this from the design system\'s tokens and catalog. It states values, not intent: where one of the brand\'s own skills covers the same ground, follow that skill. Use asset ids exactly as written, never redraw a logo, and check finished work with `lolly_check` or `lolly system check`.', '',
  ];
  const colours = list(brief.colors);
  if (colours.length) {
    out.push('## Colours', '', '| Name | Value | Token |', '| --- | --- | --- |');
    for (const c of colours.slice(0, 120)) out.push(`| ${cell(c.name ?? '')} | ${cell(c.value)} | \`${cell(c.path)}\` |`);
    if (colours.length > 120) out.push('', `${colours.length - 120} more colours are in the design context.`);
    out.push('');
  }
  const combos = rec(brief.combinations);
  const pairs = list(combos.pairs);
  if (pairs.length) {
    out.push('## Pairings', '');
    if (combos.from === 'derived' && typeof combos.note === 'string') out.push(combos.note, '');
    const label = (s: unknown): string => { const r = rec(s); return cell(r.name ?? r.slot ?? r.path ?? r.value); };
    for (const p of pairs.slice(0, 24)) {
      const text = list(p.text).map(label).filter(Boolean);
      const graphic = list(p.graphicOnly ?? p.graphic).map(label).filter(Boolean);
      out.push(`- On ${label(p.background)}: text ${text.join(', ') || 'none'}${graphic.length ? `; graphics only ${graphic.join(', ')}` : ''}.`);
    }
    out.push('');
  }
  const type = rec(brief.type);
  const families = list(type.families);
  if (families.length || list(type.rules).length) {
    out.push('## Type', '');
    for (const f of families) out.push(`- \`${cell(f.path)}\`: ${cell(f.value)}`);
    for (const r of list(type.rules)) out.push(`- ${cell(r.label ?? r.ruleId)} (${cell(r.requirement ?? 'advisory')})`);
    out.push('');
  }
  const logos = rec(brief.logos);
  const variants = list(logos.variants);
  if (variants.length) {
    out.push('## Logos', '');
    for (const key of ['onLight', 'onDark', 'monoOnLight', 'monoOnDark']) if (typeof logos[key] === 'string') out.push(`- ${key}: \`${logos[key]}\``);
    for (const v of variants.slice(0, 40)) out.push(`- \`${cell(v.id)}\`${v.name ? ` ${cell(v.name)}` : ''} (surface ${cell(v.surface)})`);
    out.push('', 'Write a logo as `<id>?theme=auto` to let it follow the surface under it.', '');
  }
  const icons = rec(brief.icons);
  if (typeof icons.count === 'number' && icons.count > 0) {
    out.push('## Icons', '', `${icons.count} icons. Themes:`, '');
    for (const t of list(icons.themes)) out.push(`- \`${cell(t.id)}\`: accent ${cell(t.c1)}, base ${cell(t.c2)}${Array.isArray(t.surfaces) ? ` (for ${t.surfaces.map(cell).join(', ')} surfaces)` : ''}`);
    out.push('', 'Write an icon as `<id>?theme=<themeId>` or `<id>?theme=auto`.', '');
  }
  const families2 = Object.entries(rec(rec(brief.media).families));
  if (families2.length) {
    out.push('## Media', '');
    for (const [family, f] of families2) { const r = rec(f); out.push(`- ${cell(family)}: ${cell(r.count)} ${cell(r.type)}${Array.isArray(r.licenses) && r.licenses.length ? ` (${r.licenses.map(cell).join(', ')})` : ''}`); }
    out.push('', 'Ids are references, not a licence: check each family\'s licence before media leaves the brand.', '');
  }
  const rules = list(brief.houseRules);
  if (rules.length) {
    out.push('## House rules Lolly checks', '');
    for (const r of rules) out.push(`- **${cell(r.label ?? r.id)}** (${cell(r.requirement ?? 'advisory')}): ${cell(r.description ?? r.kind)}`);
    out.push('');
  }
  const markdown = writeSkillFrontmatter({ name, description }, { 'lolly-generated': 'true' }) + out.join('\n');
  const bytes = ENCODER.encode(markdown).length;
  const meta: BrandSkillMetaV1 = {
    name, description, discipline: 'brand', audience: 'public', status: 'draft',
    skillRevision: opts.revision ?? 'generated', maintainer: 'lolly', generated: true,
  };
  return { meta, markdown: bytes > BRAND_SKILL_MAX_BYTES ? markdown.slice(0, BRAND_SKILL_MAX_BYTES - 200) + '\n\nThe rest is in the design context.\n' : markdown };
}

/** Measured facts about an SVG asset family, for a draft conformance profile the owner reviews. */
export interface SvgFamilyMeasureV1 {
  count: number;
  viewBoxes: Array<{ value: string; count: number }>;
  /** Files that paint through the themable `.c1`/`.c2` classes. */
  themable: number;
  /** Distinct literal fill colours across the family, most used first. */
  fills: Array<{ value: string; count: number }>;
  /** Files holding text, raster images, scripts or filters. */
  disallowed: { text: number; image: number; script: number; filter: number };
  paths: { min: number; median: number; max: number };
}

/**
 * Measures a family of SVG sources with plain text patterns (no DOM), so the numbers a
 * production skill states can be compared with the assets the brand actually ships.
 */
export function measureSvgFamily(sources: readonly string[]): SvgFamilyMeasureV1 {
  const tally = (m: Map<string, number>, k: string): void => { m.set(k, (m.get(k) ?? 0) + 1); };
  const views = new Map<string, number>();
  const fills = new Map<string, number>();
  const pathCounts: number[] = [];
  const disallowed = { text: 0, image: 0, script: 0, filter: 0 };
  let themable = 0;
  for (const svg of sources) {
    const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? '';
    tally(views, (/\bviewBox\s*=\s*["']([^"']+)["']/i.exec(root)?.[1] ?? 'none').trim().replace(/\s+/g, ' '));
    if (/\.c1\b/.test(svg) && /\.c2\b/.test(svg)) themable++;
    for (const m of svg.matchAll(/\bfill\s*[:=]\s*["']?\s*(#[0-9a-f]{3,8})\b/gi)) tally(fills, hexOf(m[1]!) ?? m[1]!.toLowerCase());
    pathCounts.push((svg.match(/<(path|circle|rect|ellipse|polygon|polyline|line)\b/gi) ?? []).length);
    if (/<text\b/i.test(svg)) disallowed.text++;
    if (/<image\b/i.test(svg)) disallowed.image++;
    if (/<script\b|\bon[a-z]+\s*=/i.test(svg)) disallowed.script++;
    if (/<filter\b/i.test(svg)) disallowed.filter++;
  }
  const sorted = (m: Map<string, number>) => [...m].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  const counts = [...pathCounts].sort((a, b) => a - b);
  return {
    count: sources.length, viewBoxes: sorted(views), themable, fills: sorted(fills).slice(0, 24), disallowed,
    paths: { min: counts[0] ?? 0, median: counts[Math.floor(counts.length / 2)] ?? 0, max: counts[counts.length - 1] ?? 0 },
  };
}

/** An evenly spread pick of `limit` ids from a family, so exemplars cover the whole family. */
export function spreadExemplars(ids: readonly string[], limit = 12): string[] {
  const sorted = [...ids].sort();
  if (sorted.length <= limit) return sorted;
  const step = sorted.length / limit;
  return Array.from({ length: limit }, (_, i) => sorted[Math.floor(i * step)]!);
}

/** The encoded size of a file map, for budgets. */
export function brandSkillFilesSize(files: Record<string, string | Uint8Array>): number {
  return Object.values(files).reduce((n, v) => n + (typeof v === 'string' ? ENCODER.encode(v).length : v.length), 0);
}
