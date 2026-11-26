// SPDX-License-Identifier: MPL-2.0
/**
 * Which product a recorded name refers to, from the registry beside this file.
 *
 * A match identifies a product. It says nothing about whether the claim that
 * named the product is true, so every place that draws a vendor also states how
 * strong the evidence is. Pure: no DOM, and the patterns are this repository's
 * own data, compiled once.
 */
import registry from './registry.json' with { type: 'json' };

export type VendorKind = 'software' | 'device' | 'ai' | 'signer' | 'scheme';

export interface Vendor {
  id: string;
  /** The product's own name, as its maker writes the name. */
  name: string;
  kind: VendorKind;
  /** A key into marks.json. Absent when no mark is held: the chip then draws a monogram. */
  mark?: string;
}

const KINDS: ReadonlySet<string> = new Set(['software', 'device', 'ai', 'signer', 'scheme']);
const entries: Array<{ vendor: Vendor; test: RegExp }> = registry.flatMap((row) => {
  if (!KINDS.has(row.kind)) return [];
  const vendor: Vendor = { id: row.id, name: row.name, kind: row.kind as VendorKind, ...('mark' in row && row.mark ? { mark: row.mark } : {}) };
  return [{ vendor, test: new RegExp(row.patterns.join('|'), 'i') }];
});

/** Every vendor the registry holds, in match order. */
export const vendorRegistry = (): Vendor[] => entries.map((e) => e.vendor);

/** The first registry entry a recorded name matches, or null. Names are read bounded. */
export function identifyVendor(name: unknown): Vendor | null {
  if (typeof name !== 'string' || !name) return null;
  const text = name.slice(0, 512);
  return entries.find((e) => e.test.test(text))?.vendor ?? null;
}

/** One or two letters that stand for a product with no mark: the initials of its first two words. */
export function vendorMonogram(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : words[0]!.slice(0, 2);
  return letters[0]!.toUpperCase() + (letters[1] ?? '');
}
