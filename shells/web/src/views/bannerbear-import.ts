// SPDX-License-Identifier: MPL-2.0
/**
 * A Bannerbear V5 image template in Design Import, read on this device. The mapping is
 * the engine's. Pictures stay where they are and are listed, because this path fetches
 * nothing. Built from public documentation, and never run against a live account.
 */
import { isBannerbearTemplate, mapBannerbearTemplate, type BannerbearFrame } from '../../../../engine/src/design-map-bannerbear.ts';
import type { DesignMapOptions } from '../../../../engine/src/design-map.ts';

const MAX_NOTES_SHOWN = 12;
const OPEN_BRACE = 0x7b;
const WHITESPACE = new Set([0x20, 0x09, 0x0a, 0x0d, 0xef, 0xbb, 0xbf]);

/** Reads a file that might be a template. Null for anything else, so other importers run. */
export function readBannerbearTemplate(buf: Uint8Array): unknown {
  let at = 0;
  while (at < buf.length && WHITESPACE.has(buf[at]!)) at++;
  if (buf[at] !== OPEN_BRACE) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(buf));
    return isBannerbearTemplate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function importBannerbear(template: unknown, options: { warn: (message: string) => void; map?: DesignMapOptions }): { frame: BannerbearFrame } {
  const result = mapBannerbearTemplate(template, options.map ? { map: options.map } : {});
  for (const note of result.report.slice(0, MAX_NOTES_SHOWN)) options.warn(note.text);
  if (result.report.length > MAX_NOTES_SHOWN) options.warn(`${result.report.length - MAX_NOTES_SHOWN} more notes were left out.`);
  return { frame: result.frames[0]! };
}
