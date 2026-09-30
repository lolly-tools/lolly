// SPDX-License-Identifier: MPL-2.0
import type { TextAPI, TextToPathOpts } from '@lolly-tools/core/host-v1';
import type { PinnedAsset } from '../../../engine/src/design-version.ts';
import { pinnedFontAliases, verifyPinnedFontBytes } from '../../../engine/src/token-font-pins.ts';

/** Exact release face resolver, including variable weights and subset fallback bytes. */
export async function releaseTextAPI(base: TextAPI, pins: readonly PinnedAsset[], read: (id: string) => Promise<Uint8Array | null>): Promise<TextAPI> {
  const aliases = await pinnedFontAliases(pins);
  const bytes = new Map<string, string>();
  const chains = new Map<string, NonNullable<TextToPathOpts['fallbackFonts']>>();
  for (const pin of pins) if (pin.font) {
    let raw = await verifyPinnedFontBytes(pin, await read(pin.frozenId ?? pin.id));
    if (raw.byteLength > 32 * 1024 * 1024) throw new Error('A pinned font exceeds the 32 MB limit.');
    if (String.fromCharCode(...raw.slice(0, 4)) === 'wOF2') raw = new Uint8Array(await (await import('woff2-encoder/decompress')).default(raw));
    bytes.set(pin.id, `data:font/ttf;base64,${Buffer.from(raw).toString('base64')}`);
  }
  return { ...base,
    fontUrl: async (family, opts) => {
      const original = [...aliases].find(([, alias]) => alias.toLowerCase() === family.toLowerCase())?.[0];
      if (!original) return base.fontUrl?.(family, opts) ?? null;
      const weight = Math.min(900, Math.max(100, opts?.weight ?? 400)), italic = !!opts?.italic;
      const faces = pins.filter(p => p.font?.family.toLowerCase() === original && /italic|oblique/.test(p.font.style) === italic);
      if (!faces.length) throw new Error(`The release has no requested slant for ${original}.`);
      const distance = (pin: PinnedAsset): number => {
        const range = pin.font!.weight.split(/\s+/).map(Number);
        return range.length > 1 && weight >= range[0]! && weight <= range[1]! ? 0 : Math.abs((range[0] || 400) - weight);
      };
      faces.sort((a, b) => distance(a) - distance(b));
      const chain = faces.map(p => ({ fontUrl: bytes.get(p.id)!, ...(p.font!.weight.includes(' ') ? { variations: [`wght=${weight}`] } : {}) }));
      const primary = chain[0]!; chains.set(JSON.stringify([primary.fontUrl, primary.variations]), chain.slice(1));
      return { url: primary.fontUrl, variations: primary.variations };
    },
    toPath: opts => base.toPath({ ...opts, fallbackFonts: opts.fallbackFonts ?? chains.get(JSON.stringify([opts.fontUrl, opts.variations])) }),
  };
}
