// SPDX-License-Identifier: MPL-2.0
/** Document emoji styles for full tool views and embedded source editors. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { EmojiSetInfoV1, EmojiStyleV1 } from '@lolly-tools/core/emoji-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { brandEmojiStyle } from '../../../../engine/src/emoji-default.ts';
import { emojiParams, parseEmojiParams } from '../../../../engine/src/emoji-style.ts';
import type { EmojiPaletteEntry } from '../../../../engine/src/emoji-style.ts';
import { currentEmojiPreference, emojiSeedParams } from './emoji-prefs.ts';
import type { EmojiParamPair } from './emoji-prefs.ts';

/** The style the two params name, pinned against the host's listing and the brand's colours. */
export function emojiStyleFrom(
  pair: EmojiParamPair | null,
  sets: readonly { pin: EmojiSetInfoV1['pin'] }[],
  palette: readonly EmojiPaletteEntry[],
): EmojiStyleV1 | null {
  if (!pair || (!pair.emoji && !pair.emojistyle)) return null;
  const parsed = parseEmojiParams(pair, sets, palette);
  if (!parsed.pin) return null;
  return parsed.style ?? {
    schemaVersion: 1,
    primary: parsed.pin,
    fallbacks: [],
    metricsPolicy: 'inline-em-v1',
    treatment: parsed.treatment ?? { mode: 'original', strengthBps: 0 },
  };
}

/**
 * The style a mount opens with: the link, then the saved session's stamp (or, with
 * none, the brand's own set), then the personal preference. `undefined` when none of
 * them picks a set, and the runtime then keeps its default style.
 *
 * The tool view passes this to createRuntime and the Emoji section resolves the same
 * way, so when the section applies the style the runtime already has it and no second
 * text composition runs (on a 19-page Design document that second run was 6.8 s).
 */
export async function mountEmojiStyle(
  host: HostV1,
  sources: { url: EmojiParamPair | null; session?: EmojiParamPair | null },
): Promise<EmojiStyleV1 | null | undefined> {
  const [sets, swatches, preference, brand] = await Promise.all([
    host.emoji?.sets().catch(() => []) ?? [], host.tokens?.colors().catch(() => []) ?? [], currentEmojiPreference(host),
    brandEmojiStyle(host).catch(() => null),
  ]);
  const seed = emojiSeedParams({ url: sources.url, session: sources.session ?? (brand ? emojiParams(brand) : null), preference });
  return seed ? emojiStyleFrom(seed, sets, swatches.map(swatch => ({ id: swatch.ref, hex: swatch.value }))) : undefined;
}

/** An embedded source has its own style, independent of the containing document. */
export async function seedEmojiRuntime(runtime: Runtime, host: HostV1, url: EmojiParamPair | null): Promise<void> {
  const style = await mountEmojiStyle(host, { url });
  if (style !== undefined) await runtime.setEmojiStyle(style);
}

/** Keep the pinned set in the lossless source URL used for previews and re-apply. */
export function queryWithEmoji(query: string, style: EmojiStyleV1 | null): string {
  const params = new URLSearchParams(query);
  params.delete('emoji'); params.delete('emojifx'); params.delete('emojistyle');
  if (style) for (const [key, value] of Object.entries(emojiParams(style))) params.set(key, value);
  return params.toString();
}
