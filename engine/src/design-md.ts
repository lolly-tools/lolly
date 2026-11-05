// SPDX-License-Identifier: MPL-2.0
/**
 * DESIGN.md in and out (`google-labs-code/design.md`, version `alpha`).
 *
 * YAML tokens are the normative values and a Markdown body explains them. The format has
 * no theme or mode concept, so `writeDesignMd` writes one file per colourway and mode.
 * `parseDesignMd` reads a file somebody handed over: it is bounded, refuses what it cannot
 * read rather than guessing, returns a proposal rather than applying anything, and keeps
 * the prose as text. A file's prose is data, never instructions.
 *
 * The format is alpha, so the target is recorded (`DESIGN_MD_TARGET`) and every mapping
 * from its names to Lolly's token paths sits in the tables below.
 *
 * Pure: no DOM, no storage, no network, no clock.
 */
import { isAlias, isMap, isScalar, isSeq, parseDocument, visit } from 'yaml';
import { DESIGN_MD_TARGET } from '@lolly-tools/core/brand-page-v1';
import { parseColor } from './css-color.ts';
import { createTokenSet } from './tokens.ts';
import { TOKEN_EXT } from './token-ext.ts';
import { designBrief, type DesignBriefCatalogV1, type DesignBriefV1 } from './design-brief.ts';
import { brandSkillScopeHints } from './brand-skill.ts';

export { DESIGN_MD_TARGET };

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);

/** Lolly's semantic slot to the DESIGN.md colour name. */
const SLOT_TO_NAME: Readonly<Record<string, string>> = {
  primary: 'primary', 'on-primary': 'on-primary', secondary: 'secondary', surface: 'surface', text: 'on-surface', muted: 'muted', edge: 'edge',
};
const NAME_TO_SLOT: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(SLOT_TO_NAME).map(([slot, name]) => [name, slot]));

/** Lolly's text style to the DESIGN.md typography name. */
const STYLE_TO_NAME: Readonly<Record<string, string>> = {
  title: 'headline-lg', subtitle: 'headline-md', number: 'display-number', quote: 'display-quote',
  body: 'body-md', caption: 'body-sm', label: 'label-md', attribution: 'label-sm',
};
const DISPLAY_STYLES = new Set(['title', 'subtitle', 'number', 'quote']);

/** The spec's sections, in order, and the other headings each may go by. */
const SECTIONS: ReadonlyArray<{ name: string; aliases: readonly string[] }> = [
  { name: 'Overview', aliases: ['Brand & Style'] },
  { name: 'Colors', aliases: [] },
  { name: 'Typography', aliases: [] },
  { name: 'Layout', aliases: ['Layout & Spacing'] },
  { name: 'Elevation & Depth', aliases: ['Elevation'] },
  { name: 'Shapes', aliases: [] },
  { name: 'Components', aliases: [] },
  { name: "Do's and Don'ts", aliases: [] },
];

const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;
/** A YAML key that stays a plain key and a DESIGN.md reference. */
const tokenName = (raw: string): string => raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
const line = (raw: unknown, limit = 400): string => String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
const quoted = (s: string): string => JSON.stringify(s);

/** A dimension the format allows, from a token value, or null. */
function dimensionOf(value: unknown): string | null {
  if (typeof value === 'string' && /^-?\d*\.?\d+(px|em|rem)$/.test(value.trim())) return value.trim();
  if (isRow(value) && typeof value.value === 'number' && Number.isFinite(value.value) && ['px', 'em', 'rem'].includes(String(value.unit))) return `${value.value}${String(value.unit)}`;
  return null;
}

function firstFamily(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const first = raw.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '');
  return first || null;
}

export interface DesignMdWriteInputV1 {
  doc: unknown;
  name?: string;
  description?: string;
  /** Token group to option, the shape `createTokenSet` takes. */
  selection?: Record<string, string>;
  /** What this file is, for its Overview. */
  variant?: { colourway?: string; mode?: string };
  catalog?: DesignBriefCatalogV1 | null;
  /** A brief the caller already built, so many variants share one. */
  brief?: DesignBriefV1;
}

/** One DESIGN.md for one colourway and mode. */
export function writeDesignMd(input: DesignMdWriteInputV1): string {
  const brief = input.brief ?? designBrief(input.doc, input.catalog ?? null, input.name ? { name: input.name } : {});
  const name = line(input.name ?? brief.name, 200) || 'Design system';
  const raw = isRow(input.doc) ? input.doc : {};
  const description = line(input.description ?? (typeof raw.$description === 'string' ? raw.$description : ''), 600);
  const tokens = createTokenSet(input.doc, input.selection ? { selection: input.selection } : {});
  const swatches = tokens.colors().filter(c => typeof c.value === 'string' && parseColor(c.value));

  const colors = new Map<string, string>();
  const slotRows: Array<{ slot: string; name: string; value: string; path: string }> = [];
  for (const c of swatches) {
    if (!c.path.startsWith('color.semantic.')) continue;
    const slot = c.path.slice('color.semantic.'.length);
    if (!SAFE_NAME.test(slot)) continue;
    const key = SLOT_TO_NAME[slot] ?? slot;
    colors.set(key, c.value);
    slotRows.push({ slot, name: key, value: c.value, path: c.path });
  }
  const named = swatches.filter(c => !c.path.startsWith('color.semantic.') && !c.path.startsWith('color.chrome.') && !c.path.startsWith('color.role.') && !c.path.startsWith('color.colourway.'));

  // Typography: sizes only when the system states a master. A stand-in master is Lolly's, not the brand's.
  const family = (path: string): string | null => firstFamily(brief.fonts.find(f => f.path === path)?.value);
  const bodyFamily = family('font.brand') ?? firstFamily(brief.fonts[0]?.value);
  const displayFamily = family('font.display') ?? bodyFamily;
  const monoFamily = family('font.mono');
  const typography = new Map<string, Row>();
  const declared = brief.coverage.type === 'declared';
  if (declared) {
    for (const [style, spec] of Object.entries(brief.type.styles ?? {})) {
      const key = STYLE_TO_NAME[style];
      if (!key || !isRow(spec)) continue;
      const fam = DISPLAY_STYLES.has(style) ? displayFamily : bodyFamily;
      typography.set(key, {
        ...(fam ? { fontFamily: fam } : {}),
        ...(typeof spec.fontSize === 'number' ? { fontSize: `${spec.fontSize}px` } : {}),
        ...(Number.isFinite(Number(spec.weight)) ? { fontWeight: Number(spec.weight) } : {}),
        ...(typeof spec.lineHeight === 'number' ? { lineHeight: spec.lineHeight } : {}),
      });
    }
  } else {
    if (displayFamily) typography.set('headline-lg', { fontFamily: displayFamily });
    if (bodyFamily) typography.set('body-md', { fontFamily: bodyFamily });
  }
  if (monoFamily) typography.set('code-md', { fontFamily: monoFamily });

  const scale = (prefixes: readonly string[]): Map<string, string> => {
    const out = new Map<string, string>();
    for (const e of tokens.query()) {
      const prefix = prefixes.find(p => e.path.startsWith(`${p}.`));
      if (!prefix) continue;
      const key = tokenName(e.path.slice(prefix.length + 1));
      const dim = dimensionOf(e.value);
      if (key && dim && !out.has(key)) out.set(key, dim);
    }
    return out;
  };
  const rounded = scale(['radius', 'rounded', 'border.radius']);
  const spacing = scale(['spacing', 'space']);

  // Every token is referenced by a component, because the format's linter treats anything
  // else as orphaned. Only the pairs a system actually states carry a foreground and a
  // background; the rest name one colour, so nothing here claims a pairing nobody made.
  const components = new Map<string, Row>();
  const textStyle = (...names: string[]): Row => {
    const hit = names.find(n => typography.has(n));
    return hit ? { typography: `{typography.${hit}}` } : {};
  };
  const usedType = new Set<string>();
  const addComponent = (id: string, row: Row): void => {
    components.set(id, row);
    if (typeof row.typography === 'string') usedType.add(row.typography.slice('{typography.'.length, -1));
  };
  if (colors.has('surface') && colors.has('on-surface')) addComponent('page', { backgroundColor: '{colors.surface}', textColor: '{colors.on-surface}', ...textStyle('body-md') });
  if (colors.has('primary') && colors.has('on-primary')) addComponent('primary', { backgroundColor: '{colors.primary}', textColor: '{colors.on-primary}', ...textStyle('label-md', 'headline-lg') });
  else if (colors.has('primary')) addComponent('primary', { backgroundColor: '{colors.primary}' });
  for (const key of colors.keys()) {
    if ((key === 'surface' && components.has('page')) || (key === 'on-surface' && components.has('page')) || key === 'primary' || (key === 'on-primary' && components.has('primary'))) continue;
    addComponent(`colour-${key}`, ['muted', 'on-surface', 'on-primary'].includes(key) ? { textColor: `{colors.${key}}` } : { backgroundColor: `{colors.${key}}` });
  }
  for (const key of typography.keys()) if (!usedType.has(key)) addComponent(`text-${key}`, { typography: `{typography.${key}}` });
  for (const key of rounded.keys()) addComponent(`rounded-${key}`, { rounded: `{rounded.${key}}` });
  for (const key of spacing.keys()) addComponent(`spacing-${key}`, { padding: `{spacing.${key}}` });

  const yaml: string[] = ['---', `version: ${quoted(DESIGN_MD_TARGET)}`, `name: ${quoted(name)}`];
  if (description) yaml.push(`description: ${quoted(description)}`);
  const omitted: Array<{ section: string; reason: string }> = [];
  if (!rounded.size) omitted.push({ section: 'rounded', reason: 'This design system declares no radius tokens.' });
  if (!spacing.size) omitted.push({ section: 'spacing', reason: 'This design system declares no spacing tokens.' });
  if (omitted.length) {
    yaml.push('omitted:');
    for (const o of omitted) yaml.push(`  - section: ${quoted(o.section)}`, `    reason: ${quoted(o.reason)}`);
  }
  const block = (key: string, rows: Iterable<[string, string]>): void => {
    const list = [...rows];
    if (!list.length) return;
    yaml.push(`${key}:`);
    for (const [k, v] of list) yaml.push(`  ${k}: ${quoted(v)}`);
  };
  block('colors', colors);
  if (typography.size) {
    yaml.push('typography:');
    for (const [key, row] of typography) {
      yaml.push(`  ${key}:`);
      for (const [field, value] of Object.entries(row)) yaml.push(`    ${field}: ${typeof value === 'number' ? value : quoted(String(value))}`);
    }
  }
  block('rounded', rounded);
  block('spacing', spacing);
  if (components.size) {
    yaml.push('components:');
    for (const [id, row] of components) {
      yaml.push(`  ${id}:`);
      for (const [field, value] of Object.entries(row)) yaml.push(`    ${field}: ${quoted(String(value))}`);
    }
  }
  yaml.push('---');

  const variantWords = [input.variant?.colourway ? `${input.variant.colourway} colourway` : '', input.variant?.mode ? `${input.variant.mode} mode` : ''].filter(Boolean).join(', ');
  const body: string[] = ['', `# ${name}`, '', '## Overview', ''];
  if (description) body.push(description, '');
  body.push(`Lolly wrote this file from the design system's tokens${variantWords ? ` for the ${variantWords}` : ''}. The tokens above are the values to use.`, '');
  body.push('## Colors', '');
  for (const r of slotRows) body.push(`- **${r.name} (${r.value}):** token \`${r.path}\`.`);
  if (named.length) {
    body.push('', 'The named colours, for reference. Use them through the tokens they belong to.', '', '| Name | Value | Token |', '| --- | --- | --- |');
    for (const c of named.slice(0, 120)) body.push(`| ${line(c.name, 80).replace(/\|/g, '\\|')} | ${c.value} | \`${c.path}\` |`);
  }
  body.push('', '## Typography', '');
  const families = new Map<string, string>();
  for (const f of brief.fonts) { const fam = firstFamily(f.value); if (fam) families.set(f.path, fam); }
  for (const [path, fam] of families) body.push(`- **${fam}:** token \`${path}\`.`);
  if (declared && brief.master?.size) body.push('', `Sizes are stated at ${brief.master.size.width} by ${brief.master.size.height}. Scale them with the page.`);
  else if (typography.size) body.push('', 'This design system states families, not a type scale.');
  if (components.size) body.push('', '## Components', '', 'Lolly tools draw from tokens rather than from components. These entries name the pairs the system states.');
  const rules = Array.isArray(brief.houseRules) ? brief.houseRules : [];
  if (rules.length) {
    body.push('', "## Do's and Don'ts", '');
    for (const rule of rules) {
      const words = line(rule.label, 200);
      if (!words || brandSkillScopeHints(`${words} ${rule.description ?? ''}`).length) continue;
      const note = line(rule.description, 400);
      body.push(`- **${rule.requirement === 'required' ? 'Required' : 'Advisory'}:** ${words}.${note ? ` ${note}` : ''}`);
    }
  }
  return `${yaml.join('\n')}\n${body.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

// ── Reading ─────────────────────────────────────────────────────────────────

const MAX_BYTES = 1024 * 1024;
const MAX_LINES = 40000;
const MAX_TOKENS = 4000;
const MAX_DEPTH = 8;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const KNOWN_KEYS = new Set(['version', 'name', 'description', 'omitted', 'colors', 'typography', 'rounded', 'spacing', 'components']);
const TYPOGRAPHY_FIELDS = new Set(['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFeature', 'fontVariation']);
const REFERENCE = /^\{[A-Za-z0-9_.-]+\}$/;

export interface DesignMdFindingV1 {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
}

export interface DesignMdSectionV1 {
  heading: string;
  /** The spec's name for the section, or null when it is one the spec does not list. */
  canonical: string | null;
  text: string;
}

/** What a DESIGN.md proposes. Nothing has been applied. */
export interface DesignMdProposalV1 {
  format: 'lolly-design-md-proposal';
  version: 1;
  target: typeof DESIGN_MD_TARGET;
  /** The `version` the file states, or null. */
  fileVersion: string | null;
  name: string | null;
  description: string | null;
  /** An ordinary token document, ready for review and `createTokenSet`. */
  tokens: Record<string, unknown>;
  sections: DesignMdSectionV1[];
  /** The whole Markdown body. Data, not instructions: a person reads the text before keeping the file. */
  prose: string;
  omitted: string[];
  /** The component entries as stated. Lolly has no component tokens, so they stay here. */
  components: Record<string, Record<string, string>>;
  findings: DesignMdFindingV1[];
}

export type DesignMdParseV1 = { ok: true; proposal: DesignMdProposalV1 } | { ok: false; code: string; reason: string; line?: number };

const refuse = (code: string, reason: string, at?: number): DesignMdParseV1 => ({ ok: false, code, reason, ...(at ? { line: at } : {}) });

/** A YAML node as plain data with no prototype keys, or a thrown refusal. */
function plain(node: unknown, depth: number, budget: { left: number }): unknown {
  if (depth > MAX_DEPTH) throw new RangeError('The YAML is nested too deeply.');
  if (--budget.left < 0) throw new RangeError('The YAML holds too many values.');
  if (isScalar(node)) return node.value;
  if (isSeq(node)) return node.items.map(item => plain(item, depth + 1, budget));
  if (isMap(node)) {
    const out: Row = Object.create(null) as Row;
    for (const pair of node.items) {
      const key = isScalar(pair.key) ? String(pair.key.value) : null;
      if (key === null) throw new RangeError('The YAML uses a key that is not plain text.');
      if (UNSAFE_KEYS.has(key)) throw new RangeError(`The YAML uses the reserved key ${key}.`);
      out[key] = plain(pair.value, depth + 1, budget);
    }
    return out;
  }
  if (node === null || node === undefined) return null;
  throw new RangeError('The YAML uses a form this reader does not accept.');
}

function readYaml(text: string, startLine: number): { ok: true; value: Row } | { ok: false; reason: string; line: number } {
  const doc = parseDocument(text, { version: '1.2', merge: false, uniqueKeys: true, schema: 'core', prettyErrors: false, strict: true });
  if (doc.errors.length) {
    const first = doc.errors[0]!;
    const offset = first.pos?.[0] ?? 0;
    return { ok: false, reason: first.message.split('\n')[0]!.slice(0, 200), line: startLine + text.slice(0, offset).split('\n').length - 1 };
  }
  let unsafe = false;
  visit(doc, {
    Alias() { unsafe = true; return visit.BREAK; },
    Node(_key, node) {
      if (isAlias(node)) { unsafe = true; return visit.BREAK; }
      if ((node as { anchor?: string }).anchor) { unsafe = true; return visit.BREAK; }
      return undefined;
    },
  });
  if (unsafe) return { ok: false, reason: 'The YAML uses anchors or aliases, which this reader does not accept.', line: startLine };
  try {
    const value = plain(doc.contents, 0, { left: MAX_TOKENS * 8 });
    if (value === null || value === undefined) return { ok: true, value: Object.create(null) as Row };
    if (!isRow(value)) return { ok: false, reason: 'A token block must be a mapping.', line: startLine };
    return { ok: true, value };
  } catch (error) {
    return { ok: false, reason: (error as Error).message, line: startLine };
  }
}

const canonicalHeading = (heading: string): string | null => {
  const want = heading.trim().toLowerCase();
  return SECTIONS.find(s => s.name.toLowerCase() === want || s.aliases.some(a => a.toLowerCase() === want))?.name ?? null;
};

/** Reads a DESIGN.md into a proposal. Refuses a file it cannot read. Applies nothing. */
export function parseDesignMd(text: string): DesignMdParseV1 {
  if (typeof text !== 'string') return refuse('DESIGN_MD_NOT_TEXT', 'A DESIGN.md is text.');
  if (text.length > MAX_BYTES) return refuse('DESIGN_MD_TOO_LARGE', 'This file is larger than the 1 MiB limit.');
  const source = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  if (lines.length > MAX_LINES) return refuse('DESIGN_MD_TOO_LARGE', `This file is longer than ${MAX_LINES} lines.`);

  const blocks: Array<{ text: string; line: number }> = [];
  let bodyStart = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end < 0) return refuse('DESIGN_MD_UNCLOSED_FRONT_MATTER', 'The front matter has no closing ---.', 1);
    blocks.push({ text: lines.slice(1, end).join('\n'), line: 2 });
    bodyStart = end + 1;
  }

  // Sections and interleaved YAML blocks. A fence hides its contents from the heading reader.
  const sections: Array<{ heading: string; canonical: string | null; start: number; rows: string[] }> = [];
  const bodyRows: string[] = [];
  let current: (typeof sections)[number] | null = null;
  let fence: { marker: string; yaml: boolean; start: number; rows: string[] } | null = null;
  for (let i = bodyStart; i < lines.length; i++) {
    const row = lines[i]!;
    if (fence) {
      if (row.trim().startsWith(fence.marker) && row.trim().replace(/`|~/g, '') === '') {
        if (fence.yaml) blocks.push({ text: fence.rows.join('\n'), line: fence.start + 1 });
        else { bodyRows.push(`${fence.marker}`, ...fence.rows, fence.marker); current?.rows.push(fence.marker, ...fence.rows, fence.marker); }
        fence = null;
      } else fence.rows.push(row);
      continue;
    }
    const open = /^(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)\s*$/.exec(row);
    if (open) { fence = { marker: open[1]!, yaml: /^ya?ml$/i.test(open[2]!), start: i + 1, rows: [] }; continue; }
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(row);
    if (heading && !row.startsWith('###')) {
      const canonical = canonicalHeading(heading[1]!);
      const clash = sections.find(s => s.heading.toLowerCase() === heading[1]!.toLowerCase() || (canonical && s.canonical === canonical));
      if (clash) return refuse('DESIGN_MD_DUPLICATE_SECTION', `The section ${heading[1]} appears twice.`, i + 1);
      current = { heading: heading[1]!, canonical, start: i + 1, rows: [] };
      sections.push(current);
      bodyRows.push(row);
      continue;
    }
    bodyRows.push(row);
    current?.rows.push(row);
  }
  if (fence) return refuse('DESIGN_MD_UNCLOSED_FENCE', 'A code fence is not closed.', fence.start);
  if (!blocks.length) return refuse('DESIGN_MD_NO_TOKENS', 'This file has no YAML tokens, so there is nothing to read as a design system. Its prose can be kept as a brand skill instead.');

  const tree: Row = Object.create(null) as Row;
  for (const block of blocks) {
    const read = readYaml(block.text, block.line);
    if (!read.ok) return refuse('DESIGN_MD_BAD_YAML', read.reason, read.line);
    for (const [key, value] of Object.entries(read.value)) {
      if (Object.hasOwn(tree, key)) return refuse('DESIGN_MD_DUPLICATE_KEY', `The key ${key} is defined more than once.`, block.line);
      tree[key] = value;
    }
  }

  const findings: DesignMdFindingV1[] = [];
  const note = (code: string, severity: DesignMdFindingV1['severity'], message: string, at?: number): void => {
    if (findings.length < 512) findings.push({ code, severity, message: message.slice(0, 300), ...(at ? { line: at } : {}) });
  };
  for (const key of Object.keys(tree)) if (!KNOWN_KEYS.has(key)) note('unknown-key', 'warning', `The key ${key} is not part of the format, so it was left out.`);

  const fileVersion = typeof tree.version === 'string' ? tree.version : null;
  if (fileVersion !== null && fileVersion !== DESIGN_MD_TARGET) note('version', 'warning', `The file says version ${fileVersion}. This reader targets ${DESIGN_MD_TARGET}.`);
  const name = typeof tree.name === 'string' && tree.name.trim() ? line(tree.name, 200) : null;
  if (!name) note('missing-name', 'warning', 'The file gives no name for the design system.');
  const description = typeof tree.description === 'string' && tree.description.trim() ? line(tree.description, 2000) : null;

  const omitted: string[] = [];
  if (Array.isArray(tree.omitted)) {
    for (const entry of tree.omitted) {
      const section = typeof entry === 'string' ? entry : isRow(entry) && typeof entry.section === 'string' ? entry.section : null;
      if (section) omitted.push(line(section, 80));
      else note('omitted', 'warning', 'An omitted entry is neither a name nor a section record.');
    }
  } else if (tree.omitted !== undefined && tree.omitted !== null) note('omitted', 'warning', 'The omitted key is not a list.');

  let count = 0;
  const overBudget = (): boolean => ++count > MAX_TOKENS;
  const mapOf = (key: string): Row => {
    const value = tree[key];
    if (value === undefined || value === null) return Object.create(null) as Row;
    if (isRow(value)) return value;
    note('bad-group', 'error', `The ${key} key is not a mapping, so it was left out.`);
    return Object.create(null) as Row;
  };

  // Colours. A reference becomes an alias, an unreadable value is reported and left out.
  const colorsIn = mapOf('colors');
  const pathOfColor = (raw: string): string => {
    const slot = NAME_TO_SLOT[raw];
    return slot ? `color.semantic.${slot}` : `color.brand.${tokenName(raw)}`;
  };
  const semantic: Row = {};
  const brand: Row = {};
  const colourValue = (raw: string, value: unknown): string | null => {
    if (typeof value !== 'string') { note('bad-colour', 'error', `The colour ${raw} is not text, so it was left out.`); return null; }
    const v = value.trim();
    if (REFERENCE.test(v)) {
      const target = v.slice(1, -1).split('.');
      if (target[0] !== 'colors' || target.length !== 2 || !Object.hasOwn(colorsIn, target[1]!)) { note('broken-ref', 'error', `The colour ${raw} refers to ${v}, which this file does not define.`); return null; }
      return `{${pathOfColor(target[1]!)}}`;
    }
    if (!parseColor(v)) { note('bad-colour', 'error', `The colour ${raw} (${v.slice(0, 60)}) could not be read, so it was left out.`); return null; }
    return v;
  };
  for (const [raw, value] of Object.entries(colorsIn)) {
    if (overBudget()) return refuse('DESIGN_MD_TOO_MANY_TOKENS', `This file defines more than ${MAX_TOKENS} tokens.`);
    if (!tokenName(raw)) { note('bad-name', 'error', `The colour name ${raw.slice(0, 40)} could not be used.`); continue; }
    const v = colourValue(raw, value);
    if (v === null) continue;
    const slot = NAME_TO_SLOT[raw];
    if (slot) semantic[slot] = { $value: v };
    else brand[tokenName(raw)] = { $value: v };
  }
  if (!Object.hasOwn(colorsIn, 'primary')) note('missing-primary', 'warning', 'The file defines no primary colour.');

  // Typography. The font slots take their families from the labels the format suggests, such as headline and body.
  const typeIn = mapOf('typography');
  const typography: Row = {};
  const familyFor = (test: RegExp): string | null => {
    for (const [raw, value] of Object.entries(typeIn)) {
      if (test.test(raw) && isRow(value) && typeof value.fontFamily === 'string' && value.fontFamily.trim()) return firstFamily(value.fontFamily);
    }
    return null;
  };
  for (const [raw, value] of Object.entries(typeIn)) {
    if (overBudget()) return refuse('DESIGN_MD_TOO_MANY_TOKENS', `This file defines more than ${MAX_TOKENS} tokens.`);
    const key = tokenName(raw);
    if (!key || !isRow(value)) { note('bad-type', 'error', `The typography entry ${raw.slice(0, 40)} is not a mapping, so it was left out.`); continue; }
    const out: Row = {};
    for (const [field, fieldValue] of Object.entries(value)) {
      if (!TYPOGRAPHY_FIELDS.has(field)) { note('unknown-field', 'warning', `The typography field ${field} on ${key} is not part of the format.`); continue; }
      if (field === 'fontSize' || field === 'letterSpacing') {
        const dim = dimensionOf(fieldValue);
        if (dim) out[field] = dim; else note('bad-dimension', 'error', `The ${field} of ${key} is not a px, em or rem value, so it was left out.`);
      } else if (field === 'fontWeight') {
        const n = Number(fieldValue);
        if (Number.isFinite(n) && n > 0 && n <= 1000) out[field] = n; else note('bad-weight', 'error', `The font weight of ${key} could not be read.`);
      } else if (field === 'lineHeight') {
        const dim = dimensionOf(fieldValue);
        if (dim) out[field] = dim;
        else if (typeof fieldValue === 'number' && Number.isFinite(fieldValue)) out[field] = fieldValue;
        else note('bad-dimension', 'error', `The line height of ${key} could not be read.`);
      } else if (typeof fieldValue === 'string') out[field] = fieldValue.slice(0, 200);
    }
    if (Object.keys(out).length) typography[key] = { $value: out };
  }
  const display = familyFor(/^(display|headline|title|h[1-3])/i) ?? familyFor(/./);
  const textFace = familyFor(/^(body|text|paragraph)/i) ?? display;
  const mono = familyFor(/(mono|code)/i);
  const font: Row = { $type: 'fontFamily' };
  if (textFace) font.brand = { $value: textFace };
  if (display) font.display = { $value: display };
  if (mono) font.mono = { $value: mono };

  const dimensions = (key: string): Row => {
    const out: Row = { $type: 'dimension' };
    for (const [raw, value] of Object.entries(mapOf(key))) {
      if (overBudget()) break;
      const name2 = tokenName(raw);
      const dim = dimensionOf(value);
      if (name2 && dim) out[name2] = { $value: dim };
      else if (key === 'spacing' && name2 && typeof value === 'number' && Number.isFinite(value)) { out[name2] = { $type: 'number', $value: value }; }
      else note('bad-dimension', 'error', `The ${key} value ${raw.slice(0, 40)} is not a px, em or rem value, so it was left out.`);
    }
    return out;
  };
  const radius = dimensions('rounded');
  const spacing = dimensions('spacing');

  const components: Record<string, Record<string, string>> = {};
  for (const [raw, value] of Object.entries(mapOf('components'))) {
    if (overBudget() || !isRow(value)) continue;
    const row: Record<string, string> = {};
    for (const [field, fieldValue] of Object.entries(value)) if (typeof fieldValue === 'string' || typeof fieldValue === 'number') row[field] = String(fieldValue).slice(0, 200);
    const key = tokenName(raw);
    if (key) components[key] = row;
  }
  if (Object.keys(components).length) note('components', 'info', 'Lolly has no component tokens, so the component entries were kept beside the proposal.');

  // Order and scope, as the format's linter and Lolly's skill reader would report them.
  let lastOrder = -1;
  for (const s of sections) {
    const order = SECTIONS.findIndex(x => x.name === s.canonical);
    if (order < 0) continue;
    if (order < lastOrder) note('section-order', 'warning', `The section ${s.heading} is out of the format's order.`, s.start);
    lastOrder = Math.max(lastOrder, order);
  }
  const prose = bodyRows.join('\n').trim();
  for (const hint of brandSkillScopeHints(prose)) note(hint.code, 'warning', `${hint.message} The prose is data, so read the file before keeping the text.`);

  const tokens: Row = {
    ...(description ? { $description: description } : {}),
    color: { $type: 'color', ...(Object.keys(semantic).length ? { semantic } : {}), ...(Object.keys(brand).length ? { brand } : {}) },
    ...(Object.keys(font).length > 1 ? { font } : {}),
    ...(Object.keys(typography).length ? { typography: { $type: 'typography', ...typography } } : {}),
    ...(Object.keys(radius).length > 1 ? { radius } : {}),
    ...(Object.keys(spacing).length > 1 ? { spacing } : {}),
    $extensions: { [TOKEN_EXT]: { reference: { method: 'design-md', ...(name ? { label: name } : {}) } } },
  };
  return {
    ok: true,
    proposal: {
      format: 'lolly-design-md-proposal', version: 1, target: DESIGN_MD_TARGET,
      fileVersion, name, description, tokens,
      sections: sections.map(s => ({ heading: s.heading, canonical: s.canonical, text: s.rows.join('\n').trim() })),
      prose, omitted, components, findings,
    },
  };
}
