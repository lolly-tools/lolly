// SPDX-License-Identifier: MPL-2.0
/**
 * Portable links on scalar block properties, with explicit local overrides.
 *
 * A link lives in the row's metadata field (Design calls it `tokenLinks`) as canonical
 * JSON, `{field: {ref, value, status?, custom?, reason?}}`. The field itself always holds
 * the literal cached value, so every renderer, exporter and older engine paints it; the
 * link says which token the literal came from, so a theme switch can refresh the literal.
 *
 * Plan 291 W4 adds three things on the same storage (no wire or schema change):
 *
 *   - `normaliseDesignColourRefs` turns a reference written straight into a colour field
 *     (a bare `{path}` alias, or the web colour field's `var(--brand-token-<hex>, cached)`)
 *     into the literal plus a link. A ref that does not resolve keeps the previous literal
 *     and says `status: 'unresolved'`; the raw alias is never stored, because a renderer
 *     reads it as no colour at all.
 *   - Rich-text run colours. A run's colour stays a literal hex in `text`
 *     (`{#008657 w500|risk}`), so the renderer grammar is unchanged; its reference is kept
 *     in `tokenLinks.__runs`, keyed by that lowercase hex. The reconciler skips the key;
 *     a re-resolve rewrites the hex in the text. The authoring form `{@<path> attrs|text}`
 *     is lowered to the literal run plus its entry.
 *   - A tint link on a gradient: `tokenLinks.grad = {ref, value, mode: 'tint'}` recolours
 *     every stop of a linear spec to the token's colour and keeps each stop's own alpha,
 *     so one scrim row is white in a light theme and pine in a dark one. Its cached value
 *     is the whole spec, so an edit to the gradient detaches it like any other link.
 *
 * Older engines read `__runs` and `mode` as nothing: they keep the literals they find,
 * which is the whole point of storing literals.
 */
import type { BlockFieldSpec, InputValue } from './inputs.ts';
import type { TokenSet } from './bridge/host-v1.ts';
import { aliasPath, isAlias, isTokenValue } from './tokens.ts';
import { resolveTokenBinding } from './token-binding.ts';
import { canonicalJson } from './canonical-json.ts';
import { parseGradientSpec } from './gradient-spec.ts';

export interface BlockTokenBinding {
  ref: string;
  value: string | number;
  custom?: boolean;
  status?: 'linked' | 'unresolved' | 'incompatible';
  reason?: string;
  /** `tint` (on a gradient field): the token recolours each stop and keeps its alpha. */
  mode?: 'tint';
}
type Row = { [key: string]: InputValue | undefined };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const scalar = (value: unknown): value is string | number => typeof value === 'string' || typeof value === 'number' && Number.isFinite(value);
const sameScalar = (value: unknown, cached: string | number): boolean => value === cached
  || typeof cached === 'number' && typeof value === 'string' && value.trim() !== '' && Number(value) === cached;
const safeField = (field: string): boolean => field.length > 0 && field.length <= 256 && !['__proto__', 'constructor', 'prototype'].includes(field);

/** The metadata key that holds rich-text run links; never a field id. */
export const RUN_LINKS_KEY = '__runs';
const DESIGN_LINKS_FIELD = 'tokenLinks';
const STATUSES = ['linked', 'unresolved', 'incompatible'];
const HEX6 = /^[0-9a-f]{6}$/;

function readLink(value: unknown): BlockTokenBinding | null {
  if (!record(value) || !isAlias(value.ref) || value.ref.length > 1024 || !scalar(value.value)) return null;
  return {
    ref: value.ref, value: value.value,
    ...(value.custom === true ? { custom: true } : {}),
    ...(STATUSES.includes(String(value.status)) ? { status: value.status as BlockTokenBinding['status'] } : {}),
    ...(typeof value.reason === 'string' ? { reason: value.reason.slice(0, 1000) } : {}),
    ...(value.mode === 'tint' ? { mode: 'tint' as const } : {}),
  };
}

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || !raw || raw.length > 32768) return null;
  let source: unknown;
  try { source = JSON.parse(raw); } catch { return null; }
  return record(source) && Object.keys(source).length <= 64 ? source : null;
}

/** The run links of one metadata value, by lowercase hex6 (no `#`). */
export function readBlockRunBindings(raw: unknown): Record<string, BlockTokenBinding> {
  const source = parseMetadata(raw);
  const runs = source?.[RUN_LINKS_KEY];
  if (!record(runs) || Object.keys(runs).length > 64) return {};
  const result: Record<string, BlockTokenBinding> = {};
  for (const [hex, value] of Object.entries(runs)) {
    const link = HEX6.test(hex) ? readLink(value) : null;
    if (link) result[hex] = link;
  }
  return result;
}

function encodeBindings(links: Record<string, BlockTokenBinding>, runs: Record<string, BlockTokenBinding> = {}): string {
  const all: Record<string, unknown> = { ...links };
  delete all[RUN_LINKS_KEY];
  if (Object.keys(runs).length) all[RUN_LINKS_KEY] = runs;
  const encoded = canonicalJson(all);
  if (Object.keys(all).length > 64 || Object.keys(runs).length > 64 || encoded.length > 32768) throw new Error('This layer has too much token-link data.');
  return encoded;
}

/** The metadata occupies one appended text field in the compact block wire format. */
export function readBlockTokenBindings(raw: unknown): Record<string, BlockTokenBinding> {
  const source = parseMetadata(raw);
  if (!source) return {};
  const result: Record<string, BlockTokenBinding> = {};
  for (const [field, value] of Object.entries(source)) {
    if (!safeField(field) || field === RUN_LINKS_KEY) continue;
    const link = readLink(value);
    if (link) result[field] = link;
  }
  return result;
}

/** Changing a scalar keeps the old link available without letting it overwrite the edit. */
export function reconcileBlockTokenBindings(rows: InputValue[], metadataField: string): InputValue[] {
  return rows.map(row => {
    if (!record(row)) return row;
    const links = readBlockTokenBindings(row[metadataField]);
    let changed = false;
    for (const [field, link] of Object.entries(links)) if (!link.custom && !sameScalar(row[field], link.value)) {
      links[field] = { ref: link.ref, value: link.value, custom: true, ...(link.mode ? { mode: link.mode } : {}) }; changed = true;
    }
    return changed ? { ...row, [metadataField]: encodeBindings(links, readBlockRunBindings(row[metadataField])) } as InputValue : row;
  });
}

// ─── references written into colour fields (plan 291 W4) ─────────────────────

/** Something the normaliser could not do, at the JSON pointer of the value. */
export interface DesignColourRefIssue { pointer: string; code: 'colour.ref.unresolved' | 'colour.run.ambiguous'; message: string }
export interface DesignColourRefOptions {
  /** Called once per problem (an unresolved reference, two run refs on one hex). */
  onIssue?: (issue: DesignColourRefIssue) => void;
  /** JSON pointer of the rows array, prefixed to each issue's pointer (default ''). */
  pointer?: string;
  /**
   * Re-resolve the run and gradient tint links already in a row (default true). A write
   * path passes false: it lowers what was just written and leaves refreshing to the
   * runtime's resolve, so a keystroke never rewrites links it did not touch.
   */
  refresh?: boolean;
  /** The blocks input's metadata field (default `tokenLinks`, Design's). */
  metadataField?: string;
}

const VAR_RE = /^\s*var\(\s*--brand-token-([0-9a-f]+)\s*(?:,\s*([\s\S]*?))?\s*\)\s*$/i;
const RUN_RE = /\{([^|{}]+)\|/g;
const seg = (key: string | number): string => String(key).replace(/~/g, '~0').replace(/\//g, '~1');

/** The token path a `var(--brand-token-<hex>, …)` names (the inverse of `tokenColorVar`), and its fallback. */
function decodeTokenVar(value: string): { path: string; fallback: string } | null {
  const m = VAR_RE.exec(value);
  if (!m || m[1]!.length % 2) return null;
  const bytes = new Uint8Array(m[1]!.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(m[1]!.slice(i * 2, i * 2 + 2), 16);
  let path: string;
  try { path = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
  if (!path || !isAlias(`{${path}}`)) return null;
  return { path, fallback: (m[2] ?? '').trim() };
}

/** A reference written straight into a colour field, as `{path}` and its fallback literal. */
function fieldRef(value: unknown): { ref: string; fallback?: string } | null {
  if (typeof value !== 'string') return null;
  if (isAlias(value)) return { ref: `{${aliasPath(value)!.trim()}}` };
  const decoded = value.includes('--brand-token-') ? decodeTokenVar(value) : null;
  return decoded ? { ref: `{${decoded.path}}`, fallback: decoded.fallback } : null;
}

/** A colour token as `#rrggbb` (sRGB), or the reason it cannot be one. */
function tokenHex(set: TokenSet | undefined, ref: string): { hex: string } | { status: 'unresolved' | 'incompatible'; reason: string } {
  const result = resolveTokenBinding(set?.get(aliasPath(ref) ?? ''), { type: 'color', colorTarget: 'srgb' });
  if (result.status !== 'linked') return { status: result.status, reason: result.reason ?? 'The token did not resolve.' };
  const value = String(result.value).toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return { hex: value };
  if (/^#[0-9a-f]{8}$/.test(value)) return { hex: value.slice(0, 7) };
  return { status: 'incompatible', reason: 'This place takes a plain sRGB colour, and the token resolves to another form.' };
}

/** The alpha a gradient stop colour carries, as two hex digits, or '' when it is opaque. */
function stopAlpha(colour: string): string | null {
  const c = colour.replace(/^#/, '').toLowerCase();
  if (c === 'transparent') return '00';
  if (/^[0-9a-f]{8}$/.test(c)) return c.slice(6);
  if (/^[0-9a-f]{4}$/.test(c)) return c[3]! + c[3]!;
  if (/^[0-9a-f]{6}$/.test(c) || /^[0-9a-f]{3}$/.test(c) || /^[a-z]+$/.test(c)) return '';
  return null;
}

/**
 * A linear gradient spec with every stop recoloured to `hex` (`#rrggbb`), each stop
 * keeping its own alpha and position. Null when the spec is not a readable linear one.
 */
export function tintGradientSpec(spec: string, hex: string): string | null {
  const parsed = parseGradientSpec(spec);
  if (parsed?.kind !== 'linear' || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const rgb = hex.slice(1).toLowerCase();
  const parts = spec.trim().split('_');
  let firstStop = 1;
  if (parts.length > 1 && /^[+-]?\d+(?:\.\d+)?$/.test(parts[1]!)) firstStop = 2;
  const out = parts.slice(0, firstStop);
  for (const tok of parts.slice(firstStop)) {
    if (!tok) { out.push(tok); continue; }
    const at = Math.max(tok.lastIndexOf('-'), tok.lastIndexOf('@'));
    const hasPos = at > 0 && /^\d+(?:\.\d+)?$/.test(tok.slice(at + 1));
    const colour = hasPos ? tok.slice(0, at) : tok;
    const alpha = stopAlpha(colour);
    if (alpha === null) return null;
    out.push(`${colour.startsWith('#') ? '#' : ''}${rgb}${alpha}${hasPos ? tok.slice(at) : ''}`);
  }
  return out.join('_');
}

/** The lowercase hex6 of every literal `#rrggbb` run colour in a text. */
function runHexes(text: string): Set<string> {
  const found = new Set<string>();
  for (const m of text.matchAll(RUN_RE)) for (const tok of m[1]!.trim().split(/\s+/)) if (/^#[0-9a-f]{6}$/i.test(tok)) found.add(tok.slice(1).toLowerCase());
  return found;
}

/** Rewrites run attribute tokens: `@path` by `refs`, and `#hex6` by `remap`. */
function rewriteRuns(text: string, refs: Map<string, string>, remap: Map<string, string>): string {
  return text.replace(RUN_RE, (whole, attrs: string) => {
    let touched = false;
    const toks = attrs.trim().split(/\s+/).map((tok) => {
      if (tok.startsWith('@') && refs.has(tok.slice(1))) { touched = true; return `#${refs.get(tok.slice(1))}`; }
      if (/^#[0-9a-f]{6}$/i.test(tok) && remap.has(tok.slice(1).toLowerCase())) { touched = true; return `#${remap.get(tok.slice(1).toLowerCase())}`; }
      return tok;
    });
    return touched ? `{${toks.join(' ')}|` : whole;
  });
}

const NEEDS_VAR = '--brand-token-';
/** Cheap test: may this row hold a reference or a derived link the normaliser handles? */
function mayNeedNormalising(row: Record<string, unknown>, fields: readonly string[], metadataField: string, refresh = true): boolean {
  for (const f of fields) {
    const v = row[f];
    if (typeof v === 'string' && (v.trimStart().startsWith('{') || v.includes(NEEDS_VAR))) return true;
  }
  if (typeof row.text === 'string' && row.text.includes('{@')) return true;
  if (!refresh) return false;
  const meta = row[metadataField];
  return typeof meta === 'string' && (meta.includes(`"${RUN_LINKS_KEY}"`) || meta.includes('"tint"'));
}

function normaliseRow(
  row: Record<string, unknown>, index: number, metadataField: string, fields: readonly string[], set: TokenSet | undefined,
  colorTarget: 'srgb' | 'rec2020', opts: DesignColourRefOptions,
): Record<string, unknown> {
  const refresh = opts.refresh !== false;
  if (!mayNeedNormalising(row, fields, metadataField, refresh)) return row;
  const at = (key: string): string => `${opts.pointer ?? ''}/${index}/${seg(key)}`;
  const issue = (pointer: string, code: DesignColourRefIssue['code'], message: string): void => opts.onIssue?.({ pointer, code, message });
  const links = readBlockTokenBindings(row[metadataField]);
  let runs = readBlockRunBindings(row[metadataField]);
  const next: Record<string, unknown> = { ...row };
  let changed = false;

  // 1. A reference written straight into a colour field.
  for (const field of fields) {
    if (field === metadataField || !safeField(field)) continue;
    const found = fieldRef(row[field]);
    if (!found) continue;
    const result = resolveTokenBinding(set?.get(aliasPath(found.ref)!), { type: 'color', colorTarget });
    if (result.status === 'linked' && scalar(result.value)) {
      next[field] = result.value;
      links[field] = { ref: found.ref, value: result.value, status: 'linked' };
    } else {
      const previous = found.fallback ?? (links[field] && scalar(links[field]!.value) ? links[field]!.value : '');
      next[field] = previous;
      links[field] = { ref: found.ref, value: previous, status: result.status, ...(result.reason ? { reason: result.reason } : {}) };
      issue(at(field), 'colour.ref.unresolved', `${found.ref} ${result.status === 'unresolved' ? 'does not resolve in the brand tokens' : 'is not a colour this field can take'}; the ${previous === '' ? 'field was left empty' : `previous colour ${previous} was kept`}.`);
    }
    changed = true;
  }

  // 2. A tint link on a gradient: recolour every stop of the linear spec.
  if (refresh) for (const [field, link] of Object.entries(links)) {
    if (link.mode !== 'tint' || link.custom || typeof next[field] !== 'string') continue;
    const colour = tokenHex(set, link.ref);
    if ('hex' in colour) {
      const tinted = tintGradientSpec(String(next[field]), colour.hex);
      if (tinted !== null) {
        if (tinted !== next[field] || link.status !== 'linked') changed = true;
        next[field] = tinted;
        links[field] = { ref: link.ref, value: tinted, status: 'linked', mode: 'tint' };
        continue;
      }
      links[field] = { ref: link.ref, value: link.value, status: 'incompatible', reason: 'A tint link recolours a readable linear gradient only.', mode: 'tint' };
    } else links[field] = { ref: link.ref, value: link.value, status: colour.status, reason: colour.reason, mode: 'tint' };
    changed = true;
  }

  // 3. Rich-text runs: lower `{@path …|`, then re-resolve the run links already there.
  if (typeof row.text === 'string' && (row.text.includes('{@') || refresh && Object.keys(runs).length)) {
    let text = row.text;
    const refHex = new Map<string, string>(); // path -> hex6
    const newRuns: Record<string, BlockTokenBinding> = {};
    if (text.includes('{@')) {
      for (const m of text.matchAll(RUN_RE)) {
        for (const tok of m[1]!.trim().split(/\s+/)) {
          if (!tok.startsWith('@') || refHex.has(tok.slice(1))) continue;
          const path = tok.slice(1);
          const ref = `{${path}}`;
          if (!isAlias(ref)) continue;
          const colour = tokenHex(set, ref);
          if (!('hex' in colour)) {
            issue(at('text'), 'colour.ref.unresolved', `The run colour ${ref} ${colour.status === 'unresolved' ? 'does not resolve in the brand tokens' : 'is not a plain colour'}; the run was left as written.`);
            continue;
          }
          refHex.set(path, colour.hex.slice(1));
        }
      }
      // Two references, or a reference and a literal run, on one hex cannot be told apart later.
      const literal = runHexes(text);
      const byHex = new Map<string, string>();
      for (const [path, hex] of refHex) {
        const other = byHex.get(hex);
        const existing = runs[hex];
        if ((other !== undefined && other !== path) || literal.has(hex) && existing?.ref !== `{${path}}` || existing && existing.ref !== `{${path}}`) {
          issue(at('text'), 'colour.run.ambiguous', `The run colour {${path}} resolves to #${hex}, which ${other !== undefined && other !== path ? `{${other}} also resolves to` : 'another run in this text already uses'}; one row cannot tell the two apart when the theme changes. Use one reference for both, or split the text.`);
          refHex.delete(path);
          continue;
        }
        byHex.set(hex, path);
        newRuns[hex] = { ref: `{${path}}`, value: `#${hex}`, status: 'linked' };
      }
    }
    // Existing run links: re-resolve, and rewrite their hex in the text when it moves.
    // Every link that stays where it is claims its hex first (a literal run, a lowered
    // one, a custom or unresolved link, one whose colour did not change), so a link that
    // moves can never land on, and silently merge with, another run's colour.
    const remap = new Map<string, string>();
    const present = runHexes(text);
    const lowered = new Set(Object.keys(newRuns));
    const claimed = new Set<string>([...present].filter((hex) => !runs[hex] && !lowered.has(hex)));
    for (const hex of lowered) claimed.add(hex);
    const movers: { hex: string; link: BlockTokenBinding; target: string }[] = [];
    for (const hex of Object.keys(runs).sort()) {
      const link = runs[hex]!;
      if (lowered.has(hex)) continue;
      claimed.add(hex);
      if (!refresh || link.custom) { newRuns[hex] = link; continue; }
      if (!present.has(hex)) { newRuns[hex] = { ref: link.ref, value: link.value, custom: true }; continue; }
      const colour = tokenHex(set, link.ref);
      if (!('hex' in colour)) { newRuns[hex] = { ref: link.ref, value: link.value, status: colour.status, reason: colour.reason }; continue; }
      const target = colour.hex.slice(1);
      if (target === hex || lowered.has(target) && newRuns[target]?.ref === link.ref) {
        // Unchanged, or joining a run just written with the same reference.
        if (target !== hex) { remap.set(hex, target); claimed.delete(hex); }
        newRuns[target] = { ref: link.ref, value: `#${target}`, status: 'linked' };
        continue;
      }
      claimed.delete(hex);
      movers.push({ hex, link, target });
    }
    // A mover is blocked when its target is claimed or another mover took it first; a
    // blocked mover keeps its own hex, which may block another, so go round until stable.
    const blocked = new Set<string>();
    for (let again = true; again;) {
      again = false;
      const targets = new Set<string>();
      for (const { hex, target } of movers) {
        if (blocked.has(hex)) continue;
        if (claimed.has(target) || targets.has(target)) { blocked.add(hex); claimed.add(hex); again = true; break; }
        targets.add(target);
      }
    }
    for (const { hex, link, target } of movers) {
      if (blocked.has(hex)) {
        newRuns[hex] = { ref: link.ref, value: `#${hex}`, status: 'incompatible', reason: `Another run colour in this text already resolves to #${target}, so this run kept #${hex}.` };
        continue;
      }
      remap.set(hex, target);
      newRuns[target] = { ref: link.ref, value: `#${target}`, status: 'linked' };
    }
    if (refHex.size || remap.size) text = rewriteRuns(text, new Map([...refHex]), remap);
    if (text !== row.text) { next.text = text; changed = true; }
    if (canonicalJson(newRuns) !== canonicalJson(runs)) { runs = newRuns; changed = true; }
  }

  if (!changed) return row;
  next[metadataField] = encodeBindings(links, runs);
  return next;
}

function normaliseRows(rows: InputValue[], metadataField: string, fields: readonly string[], set: TokenSet | undefined, colorTarget: 'srgb' | 'rec2020', opts: DesignColourRefOptions): InputValue[] {
  let changed = false;
  const out = rows.map((row, index) => {
    if (!record(row)) return row;
    const next = normaliseRow(row, index, metadataField, fields, set, colorTarget, opts);
    if (next !== row) changed = true;
    return next as InputValue;
  });
  return changed ? out : rows;
}

/**
 * Design colour references to literals plus links (plan 291 W4, decision E16).
 *
 * In each row, a bare `{path}` alias or a `var(--brand-token-<hex>, cached)` in one of
 * `fields` becomes the token's literal colour under `set` plus a `tokenLinks` entry; a
 * `{@path attrs|text}` run becomes the literal run plus a `tokenLinks.__runs` entry; and
 * the run and gradient tint links already there are re-resolved. A reference that does
 * not resolve keeps the previous literal with `status: 'unresolved'`.
 *
 * Pure. A row with no reference is returned as the same object, and the array itself
 * when no row changed, so a document with none is untouched byte for byte.
 */
export function normaliseDesignColourRefs(rows: InputValue[], fields: readonly string[], set: TokenSet | undefined, colorTarget: 'srgb' | 'rec2020' = 'srgb', opts: DesignColourRefOptions = {}): InputValue[] {
  return normaliseRows(rows, opts.metadataField ?? DESIGN_LINKS_FIELD, fields, set, colorTarget, opts);
}

/** True when some row holds a colour reference or a derived link the normaliser would act on. */
export function hasDesignColourRefs(rows: readonly InputValue[], fields: readonly string[], metadataField = DESIGN_LINKS_FIELD, refresh = true): boolean {
  return rows.some((row) => record(row) && mayNeedNormalising(row, fields, metadataField, refresh));
}

/** The colour field ids of a blocks input: the ones a reference may be written into. */
export function blockColourFields(fields: readonly BlockFieldSpec[]): string[] {
  return fields.filter((field) => field.type === 'color').map((field) => field.id);
}

/** Resolves supported declared fields while keeping ordinary scalar geometry and styles. */
export function resolveBlockTokenBindings(rows: InputValue[], metadataField: string, fields: readonly BlockFieldSpec[], set: TokenSet | undefined, colorTarget: 'srgb' | 'rec2020' = 'srgb'): InputValue[] {
  const byId = new Map(fields.map(field => [field.id, field]));
  const normalised = normaliseRows(reconcileBlockTokenBindings(rows, metadataField), metadataField, blockColourFields(fields), set, colorTarget, {});
  const out = normalised.map(row => {
    if (!record(row)) return row;
    const links = readBlockTokenBindings(row[metadataField]);
    if (!Object.keys(links).length) return row;
    const next = { ...row };
    let moved = false;
    for (const [id, link] of Object.entries(links)) {
      if (link.custom || link.mode === 'tint') continue;
      const field = byId.get(id);
      if (!field || id === metadataField) continue;
      const result = resolveTokenBinding(set?.get(aliasPath(link.ref)!), { ...field, type: field.type ?? 'text', colorTarget });
      if (result.status === 'linked' && scalar(result.value)) {
        if (next[id] !== result.value) moved = true;
        next[id] = result.value; links[id] = { ref: link.ref, value: result.value, status: 'linked' };
      } else links[id] = { ...link, status: result.status, reason: result.reason };
    }
    next[metadataField] = encodeBindings(links, readBlockRunBindings(row[metadataField]));
    // A row already resolved in this theme comes back as the same object (plan 291 W4:
    // the runtime runs this on every write, and an unchanged row must stay unchanged).
    if (!moved && next[metadataField] === row[metadataField]) return row;
    return next as InputValue;
  });
  return out.some((row, index) => row !== rows[index]) ? out : rows;
}

/** One explicit link/custom action, suitable for one transaction across a selection. */
export function withBlockTokenBinding(row: Row, metadataField: string, field: string, value: InputValue): Row {
  if (!safeField(field) || field === metadataField || field === RUN_LINKS_KEY) throw new Error('This property cannot hold a token link.');
  const links = readBlockTokenBindings(row[metadataField]);
  const runs = readBlockRunBindings(row[metadataField]);
  if (isTokenValue(value) && scalar(value.value)) {
    const ref = `{${aliasPath(value.ref) ?? value.ref}}`;
    if (!isAlias(ref) || ref.length > 1024) throw new Error('This token reference is invalid or too long.');
    links[field] = { ref, value: value.value, status: 'linked' };
    return { ...row, [field]: value.value, [metadataField]: encodeBindings(links, runs) };
  }
  if (!scalar(value)) throw new Error('A linked block property needs a scalar value.');
  if (links[field]) links[field] = { ref: links[field]!.ref, value: links[field]!.value, custom: true, ...(links[field]!.mode ? { mode: links[field]!.mode } : {}) };
  return { ...row, [field]: value, [metadataField]: encodeBindings(links, runs) };
}
