#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Chrome-token codegen (plans/172 P4): emits the marked block in
 * shells/web/src/styles/tokens.css from shells/web/design/chrome-tokens.json,
 * the W3C DTCG document Penpot and Tokens Studio edit.
 *
 * Run: node scripts/gen-chrome-tokens.ts          rewrite the block in place
 *      npm run gen:chrome-tokens                  same
 *
 * The JSON is the source of truth for the NON-COLOUR chrome axes; everything
 * in tokens.css outside the @generated-chrome-tokens markers stays
 * hand-authored (the five colour theme blocks in particular - see plan 172 for
 * why colour joins this file last). tests/chrome-tokens.test.ts regenerates
 * and diffs, so a hand-edit inside the markers or a JSON edit without a rerun
 * fails CI rather than shipping drift.
 *
 * Naming rule: group "edge" + token "default" -> --edge; token "faint" ->
 * --edge-faint. Where DTCG cannot express the CSS spelling (a shadow whose
 * colour is a theme variable, the --a11y-fs-multiplied type scale),
 * $extensions["tools.lolly"].css carries the exact emission; $value stays a
 * representative literal so a visual editor renders something sensible. A
 * group-level $extensions["tools.lolly"].a11yScale wraps every dimension in
 * the group as calc(<v> * var(--a11y-fs)).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TOKENS_JSON = resolve(repoRoot, 'shells/web/design/chrome-tokens.json');
/** Semantic app roles. References point at the compatibility chrome scale. */
export const UI_SEMANTICS_JSON = resolve(repoRoot, 'shells/web/design/ui-semantics.json');
export const TOKENS_CSS = resolve(repoRoot, 'shells/web/src/styles/tokens.css');
export const MARK_START = '/* @generated-chrome-tokens start */';
export const MARK_END = '/* @generated-chrome-tokens end */';
export const UI_MARK_START = '/* @generated-ui-semantics start */';
export const UI_MARK_END = '/* @generated-ui-semantics end */';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** ".12s" from "120ms" - the house duration spelling (no leading zero). */
function durCss(v: string): string {
  const ms = /^([\d.]+)\s*ms$/.exec(v);
  const s = ms ? Number(ms[1]) / 1000 : Number(/^([\d.]+)\s*s$/.exec(v)?.[1] ?? NaN);
  if (Number.isNaN(s)) throw new Error(`duration $value "${v}" is neither Nms nor Ns`);
  return `${String(s).replace(/^0\./, '.')}s`;
}

/** "cubic-bezier(.32, .72, 0, 1)" - numbers in the house no-leading-zero form. */
function bezierCss(v: unknown): string {
  if (!Array.isArray(v) || v.length !== 4 || v.some((n) => typeof n !== 'number')) {
    throw new Error(`cubicBezier $value must be four numbers, got ${JSON.stringify(v)}`);
  }
  return `cubic-bezier(${v.map((n) => String(n).replace(/^0\./, '.')).join(', ')})`;
}

/** One token's CSS value string, honouring the extension override. */
function cssValue(group: string, name: string, tok: Rec, groupExt: Rec): string {
  const ext = isRec(tok.$extensions) && isRec((tok.$extensions as Rec)['tools.lolly'])
    ? ((tok.$extensions as Rec)['tools.lolly'] as Rec) : {};
  if (typeof ext.css === 'string') return ext.css;
  const type = tok.$type, v = tok.$value;
  switch (type) {
    case 'dimension': {
      if (typeof v !== 'string') throw new Error(`${group}.${name}: dimension $value must be a string`);
      return groupExt.a11yScale === true ? `calc(${v} * var(--a11y-fs))` : v;
    }
    case 'fontFamilies': {
      if (!Array.isArray(v) || v.some((f) => typeof f !== 'string')) {
        throw new Error(`${group}.${name}: fontFamilies $value must be an array of strings`);
      }
      // Quote named families; generic/ui- keywords stay bare - matches the
      // hand-authored spelling this group replaced ('SUSE', ui-sans-serif, ...).
      return v.map((f) => /^[a-z][a-z-]*$/.test(f) ? f : `'${f}'`).join(', ');
    }
    case 'duration': return durCss(String(v));
    case 'cubicBezier': return bezierCss(v);
    case 'number': return String(v);
    case 'shadow': throw new Error(
      `${group}.${name}: a shadow token needs $extensions["tools.lolly"].css - the CSS spelling ` +
      'uses theme variables/hsl alpha that DTCG cannot carry, and guessing it here would drift');
    default: throw new Error(`${group}.${name}: unhandled $type "${String(type)}"`);
  }
}

/** The generated block body (between the markers), deterministic. */
export function emitBlock(doc: Rec): string {
  const lines: string[] = [':root {'];
  for (const [group, node] of Object.entries(doc)) {
    if (group.startsWith('$') || !isRec(node)) continue;
    const groupExt = isRec(node.$extensions) && isRec((node.$extensions as Rec)['tools.lolly'])
      ? ((node.$extensions as Rec)['tools.lolly'] as Rec) : {};
    if (typeof node.$description === 'string') lines.push(`  /* ${node.$description} */`);
    for (const [name, tok] of Object.entries(node)) {
      if (name.startsWith('$') || !isRec(tok) || !('$value' in tok)) continue;
      const varName = name === 'default' ? `--${group}` : `--${group}-${name}`;
      lines.push(`  ${varName}: ${cssValue(group, name, tok, groupExt)};`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

/** tokens.css with the marker block replaced by a fresh emission. */
export function regenerate(css: string, doc: Rec): string {
  const start = css.indexOf(MARK_START), end = css.indexOf(MARK_END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`tokens.css is missing the ${MARK_START} / ${MARK_END} markers`);
  }
  return css.slice(0, start + MARK_START.length) + '\n' + emitBlock(doc) + '\n' + css.slice(end);
}

/** `lolly.foundation.radius.sm` → the existing compatibility CSS variable. */
function foundationCssVar(path: string): string | null {
  const parts = path.split('.');
  const mapped: Record<string, string> = {
    'font': 'font',
    'edge': 'edge',
    'elevation': 'shadow',
    'bevel': 'bevel',
    'focus': 'ring-focus',
    'radius': 'radius',
    'type.size': 'fs',
    'space': 'sp',
    'motion.duration': 'dur',
    'motion.easing': 'ease',
    'layer': 'z',
  };
  if (parts[0] !== 'lolly' || parts[1] !== 'foundation' || parts.length < 4) return null;
  const groupLen = parts[2] === 'type' || parts[2] === 'motion' ? 2 : 1;
  const group = parts.slice(2, 2 + groupLen).join('.');
  const name = parts.slice(2 + groupLen).join('-');
  const prefix = mapped[group];
  // The generated foundation block intentionally shortens each group's
  // `default` leaf: edge.default → --edge, bevel.default → --bevel and
  // focus.default → --ring-focus. Semantic references must preserve that
  // public DTCG path while resolving to the compatibility spelling.
  return prefix && name ? `--${prefix}${name === 'default' ? '' : `-${name}`}` : null;
}

/** One semantic leaf's emitted CSS. Its extension is the deliberate escape hatch
 * for theme-colour aliases (`hsl(var(--foreground))`) that DTCG cannot express. */
function semanticCssValue(path: string, tok: Rec): string {
  const ext = isRec(tok.$extensions) && isRec((tok.$extensions as Rec)['tools.lolly'])
    ? ((tok.$extensions as Rec)['tools.lolly'] as Rec) : {};
  if (typeof ext.css === 'string') return ext.css;
  const v = tok.$value;
  if (typeof v === 'string') {
    const ref = /^\{([^}]+)\}$/.exec(v.trim());
    if (ref) {
      const css = foundationCssVar(ref[1]!);
      if (css) return `var(${css})`;
      throw new Error(`${path}: reference ${v} has no CSS alias`);
    }
  }
  throw new Error(`${path}: semantic token needs a {lolly.foundation.*} reference or tools.lolly.css`);
}

/** Flatten `lolly.ui` into the runtime aliases that components consume. */
export function emitSemanticBlock(doc: Rec): string {
  const root = isRec(doc.lolly) && isRec((doc.lolly as Rec).ui) ? ((doc.lolly as Rec).ui as Rec) : null;
  if (!root) throw new Error('ui-semantics.json must contain lolly.ui');
  const lines = [':root {'];
  const walk = (node: Rec, path: string[]): void => {
    for (const [name, value] of Object.entries(node)) {
      if (name.startsWith('$') || !isRec(value)) continue;
      const next = [...path, name];
      if ('$value' in value) {
        const ext = isRec(value.$extensions) && isRec((value.$extensions as Rec)['tools.lolly'])
          ? ((value.$extensions as Rec)['tools.lolly'] as Rec) : {};
        const cssName = typeof ext.cssName === 'string' ? ext.cssName : `--ui-${next.join('-')}`;
        if (!/^--ui-[a-z0-9-]+$/.test(cssName)) throw new Error(`${next.join('.')}: invalid cssName ${JSON.stringify(cssName)}`);
        lines.push(`  ${cssName}: ${semanticCssValue(`lolly.ui.${next.join('.')}`, value)};`);
      } else walk(value, next);
    }
  };
  walk(root, []);
  lines.push('}');
  return lines.join('\n');
}

/** Add the semantic alias block without changing the legacy chrome block. */
export function regenerateUiSemantics(css: string, doc: Rec): string {
  const start = css.indexOf(UI_MARK_START), end = css.indexOf(UI_MARK_END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`tokens.css is missing the ${UI_MARK_START} / ${UI_MARK_END} markers`);
  }
  return css.slice(0, start + UI_MARK_START.length) + '\n' + emitSemanticBlock(doc) + '\n' + css.slice(end);
}

/** Canonical public DTCG document. Existing chrome tokens become foundation
 * tokens; semantic aliases retain DTCG references so Penpot can preserve them. */
export function lollyUiTokens(chrome: Rec, semantics: Rec): Rec {
  const pick = (name: string): Rec => {
    const value = chrome[name];
    if (!isRec(value)) throw new Error(`chrome-tokens.json is missing ${name}`);
    return value;
  };
  const ui = isRec(semantics.lolly) && isRec((semantics.lolly as Rec).ui) ? (semantics.lolly as Rec).ui : null;
  if (!ui) throw new Error('ui-semantics.json must contain lolly.ui');
  return {
    $description: 'Lolly application UI tokens. Generated from chrome-tokens.json and ui-semantics.json; do not edit this file directly.',
    lolly: {
      foundation: {
        font: pick('font'), edge: pick('edge'), elevation: pick('shadow'), bevel: pick('bevel'),
        focus: pick('ring-focus'), radius: pick('radius'), type: { size: pick('fs') },
        space: pick('sp'), motion: { duration: pick('dur'), easing: pick('ease') }, layer: pick('z'),
      },
      ui,
    },
  };
}

// CLI entry - guarded like scripts/translate.ts, so tests can import the pure parts.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const doc = JSON.parse(readFileSync(TOKENS_JSON, 'utf8')) as Rec;
  const semantics = JSON.parse(readFileSync(UI_SEMANTICS_JSON, 'utf8')) as Rec;
  const before = readFileSync(TOKENS_CSS, 'utf8');
  const after = regenerateUiSemantics(regenerate(before, doc), semantics);
  if (after === before) { console.log('tokens.css: chrome block already current'); }
  else { writeFileSync(TOKENS_CSS, after); console.log('tokens.css: chrome block regenerated'); }
}
