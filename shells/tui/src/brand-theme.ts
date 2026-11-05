// SPDX-License-Identifier: MPL-2.0
/** Brand colours for terminal chrome, resolved through the same token API as a document. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { colorToHex } from '../../../engine/src/tokens.ts';
import { contrastRatio, hexToOklch, oklchToHex } from '../../../engine/src/brand-derive.ts';
import { resolveTokenSelection } from '../../../engine/src/token-selection.ts';
import { stripVTControlCharacters } from 'node:util';

export interface TerminalBrand {
  label: string;
  choices: string[];
  primary: string;
  swatches: Array<{ label: string; value: string }>;
}

/** Keep the authored hue; adjust lightness only when text contrast needs help. */
export function readableBrandAccent(value: string, background: string): string | undefined {
  const color = hexToOklch(value);
  if (!color) return undefined;
  if (contrastRatio(value, background) >= 4.5) return value;
  const end = contrastRatio('#ffffff', background) > contrastRatio('#000000', background) ? 1 : 0;
  for (let step = 1; step <= 100; step++) {
    const candidate = oklchToHex({ ...color, l: color.l + ((end - color.l) * step) / 100 });
    if (contrastRatio(candidate, background) >= 4.5) return candidate;
  }
  return end ? '#ffffff' : '#000000';
}

export async function readTerminalBrand(
  host: { tokens?: Pick<NonNullable<HostV1['tokens']>, 'get' | 'snapshot'> },
  selection?: Record<string, string>
): Promise<TerminalBrand | null> {
  if (!host.tokens) return null;
  const set = await host.tokens.get(selection ? { selection } : {});
  const colors = set.colors().filter((color) => colorToHex(color.value));
  if (!colors.length) return null;
  const swatches: TerminalBrand['swatches'] = [];
  const add = (label: string, value: unknown): void => {
    const hex = colorToHex(value);
    if (hex && !swatches.some((swatch) => swatch.value === hex))
      swatches.push({ label, value: hex });
  };
  add('Primary', set.resolve('{color.semantic.primary}'));
  add('Secondary', set.resolve('{color.semantic.secondary}'));
  for (const color of colors) add(color.name ?? color.path, color.value);
  const snapshot = await host.tokens.snapshot?.();
  const resolved = snapshot
    ? resolveTokenSelection(snapshot.document, selection ? { selection } : {})
    : null;
  const choices = set
    .themes()
    .filter((choice) => {
      const selected = resolved?.choices[choice.group ?? ''];
      return selected === (choice.id ?? choice.name);
    })
    .map((choice) => choice.name);
  return {
    label: stripVTControlCharacters(snapshot?.system?.label ?? 'Design system'),
    choices,
    primary: swatches[0]!.value,
    swatches: swatches.slice(0, 6),
  };
}
