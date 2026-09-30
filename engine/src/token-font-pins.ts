// SPDX-License-Identifier: MPL-2.0
/** Release font identity, byte validation and render projections. */
import type { PinnedAsset } from './design-version.ts';
import { sha256Hex } from './bytes.ts';

/** A release alias addresses exact face bytes while keeping the authored family intact. */
export async function pinnedFontAliases(pins: readonly PinnedAsset[]): Promise<Map<string, string>> {
  const groups = new Map<string, PinnedAsset[]>();
  for (const pin of pins) if (pin.font) {
    const key = pin.font.family.toLowerCase(), list = groups.get(key) ?? [];
    list.push(pin); groups.set(key, list);
  }
  if (groups.size > 64 || pins.length > 512) throw new Error('The font manifest exceeds the release limit.');
  const aliases = new Map<string, string>();
  for (const [family, faces] of groups) {
    const identity = faces.map(p => [p.sha256, p.font]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
    aliases.set(family, `Lolly Release ${await sha256Hex(new TextEncoder().encode(JSON.stringify(identity)))}`);
  }
  return aliases;
}

/** Render projection only. Source token documents and published checksums stay intact. */
export async function applyPinnedFontFamilies(source: unknown, pins: readonly PinnedAsset[]): Promise<unknown> {
  const aliases = await pinnedFontAliases(pins);
  return mapFontFamilies(source, aliases);
}

/** Portable snapshots keep authored families while workers use the render projection. */
export async function restorePinnedFontFamilies(source: unknown, pins: readonly PinnedAsset[]): Promise<unknown> {
  const aliases = await pinnedFontAliases(pins);
  const originals = new Map<string, string>();
  for (const pin of pins) if (pin.font) originals.set(aliases.get(pin.font.family.toLowerCase())!.toLowerCase(), pin.font.family);
  return mapFontFamilies(source, originals);
}

function mapFontFamilies(source: unknown, aliases: Map<string, string>): unknown {
  if (!aliases.size) return source;
  const doc = structuredClone(source);
  let nodes = 0;
  const family = (v: unknown): unknown => typeof v === 'string' ? aliases.get(v.toLowerCase()) ?? v : Array.isArray(v) ? v.map(family) : v;
  function walk(v: unknown, inherited: unknown, depth: number): void {
    if (++nodes > 20000 || depth > 48) throw new Error('The font projection exceeded its scan limit.');
    if (!v || typeof v !== 'object' || Array.isArray(v)) return;
    const obj = v as Record<string, unknown>, type = obj.$type ?? inherited;
    if ('$value' in obj) {
      if (type === 'fontFamily') obj.$value = family(obj.$value);
      if (type === 'typography' && obj.$value && typeof obj.$value === 'object') {
        const value = obj.$value as Record<string, unknown>;
        value.fontFamily = family(value.fontFamily);
      }
      return;
    }
    for (const [key, child] of Object.entries(obj)) if (!key.startsWith('$')) walk(child, type, depth + 1);
  }
  walk(doc, null, 0);
  return doc;
}

/** Strict release reads reject absent or substituted bytes. Legacy pins remain record-only. */
export async function verifyPinnedFontBytes(pin: PinnedAsset, bytes: Uint8Array | null): Promise<Uint8Array> {
  if (!bytes || await sha256Hex(bytes) !== pin.sha256) throw new Error(`Pinned font ${pin.font?.family ?? pin.id} is missing or its bytes changed.`);
  return bytes;
}
