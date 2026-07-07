#!/usr/bin/env node
/**
 * Brand design-tokens generator.
 *
 * Run as: node scripts/build-brand-tokens.ts
 *
 * Emits the canonical SUSE brand colour tokens as a W3C Design Tokens (DTCG)
 * document at catalog/assets/suse/tokens/brand.json — the format Penpot and
 * Tokens Studio import/export. The source of truth for the *values* is the web
 * shell's swatch list (shells/web/src/palette.js); this script reshapes those
 * swatches into the standard token structure so the catalog (and, through it,
 * the colour picker) is driven by tokens rather than a hard-coded array.
 *
 * Mapping:
 *   - "Jungle 4", "Fog 8", …  → color.ramp.<family>.<n>   (tint/shade ramps)
 *   - group: 'spectrum'        → color.spectrum.<slug>      (infographics palette)
 *   - everything else          → color.brand.<slug>         (named brand colours)
 * Each token carries its label in `$description`; CMYK print anchors ride in
 * `$extensions["com.suse.lolly"].cmyk` (DTCG reserves $extensions for vendors,
 * and Penpot round-trips it untouched). First definition of a path wins, so the
 * duplicate Black/White ramp endpoints collapse into the brand colours.
 *
 * After running, `npm run build:catalog` checksums the new file and
 * `npm run validate:catalog` verifies it.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE, type PaletteEntry } from '../shells/web/src/palette.ts';

type Token = {
  $value: string;
  $description: string;
  $extensions?: Record<string, { cmyk: readonly [number, number, number, number] }>;
};
// A DTCG group node: nested groups and/or tokens, plus optional meta keys ($type).
type TokenNode = Record<string, unknown>;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'catalog/assets/suse/tokens/brand.json');
const TOKEN_EXT = 'com.suse.lolly';

const slug = (s: unknown): string => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Nest a token at a dotted path inside `root`, creating groups as needed.
function place(root: TokenNode, path: string, token: Token): boolean {
  const segs = path.split('.');
  let node: TokenNode = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    node[seg] ??= {};
    node = node[seg] as TokenNode;
  }
  const leaf = segs[segs.length - 1]!;
  if (leaf in node) return false; // first definition of a path wins
  node[leaf] = token;
  return true;
}

function tokenFor(entry: PaletteEntry): Token {
  const token: Token = { $value: String(entry.hex).toLowerCase(), $description: entry.label };
  if (Array.isArray(entry.cmyk)) token.$extensions = { [TOKEN_EXT]: { cmyk: entry.cmyk } };
  return token;
}

function pathFor(entry: PaletteEntry): string {
  const ramp = /^(.+?)\s+(\d+)$/.exec(entry.label);
  if (ramp) return `ramp.${slug(ramp[1]!)}.${ramp[2]!}`;
  if (entry.group === 'spectrum') return `spectrum.${slug(entry.label)}`;
  return `brand.${slug(entry.label)}`;
}

const color: TokenNode = { $type: 'color' };
for (const entry of PALETTE) {
  place(color, pathFor(entry), tokenFor(entry));
}

const doc = {
  $description: 'SUSE brand colour tokens — generated from shells/web/src/palette.js by scripts/build-brand-tokens.ts. Edit the palette and re-run; do not hand-edit.',
  color,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');

const count = (node: TokenNode): number => Object.values(node).reduce<number>(
  (n, v) => (v && typeof v === 'object' ? ('$value' in v ? n + 1 : n + count(v as TokenNode)) : n), 0,
);
console.log(`✓ Wrote catalog/assets/suse/tokens/brand.json — ${count(color)} colour tokens`);
