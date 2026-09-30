// SPDX-License-Identifier: MPL-2.0
/** Capture the same resolved semantic tokens and font faces as the Verify view. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { readFontEmbedding } from '../lib/font-utils.ts';

export interface ReportTheme {
  family: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  paper: string;
  surface: string;
  regular?: Uint8Array;
  bold?: Uint8Array;
}

export async function captureReportTheme(host: HostV1, element: HTMLElement): Promise<ReportTheme> {
  const style = getComputedStyle(element);
  const probe = document.createElement('span');
  element.append(probe);
  const color = (token: string, fallback: string): string => {
    probe.style.color = `var(${token}, ${fallback})`;
    return getComputedStyle(probe).color;
  };
  const theme: ReportTheme = {
    family: style.getPropertyValue('--ui-type-ui-family').trim() || style.fontFamily,
    ink: color('--ui-color-text-default', '#102e29'),
    muted: color('--ui-color-text-muted', '#52615e'),
    line: color('--ui-color-border-default', '#d1dbd6'),
    accent: color('--ui-color-action-primary', '#0a6e52'),
    paper: color('--ui-color-surface-canvas', '#ffffff'),
    surface: color('--ui-color-surface-muted', '#f7faf9'),
  };
  probe.remove();
  await document.fonts.ready;
  const family = theme.family.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '');
  await Promise.all(([['regular', 400], ['bold', 700]] as const).map(async ([key, weight]) => {
    const face = await host.text?.fontUrl?.(family, { weight });
    if (!face || face.variations?.length) return;
    const response = await fetch(face.url);
    if (!response.ok) throw new Error('The report font could not be loaded. Try again.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const rights = readFontEmbedding(bytes.slice().buffer);
    if (rights.permission === 'restricted' || rights.permission === 'unknown' || rights.bitmapOnly || rights.noSubsetting) return;
    theme[key] = bytes;
  }));
  return theme;
}
