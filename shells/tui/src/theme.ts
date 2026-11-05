// SPDX-License-Identifier: MPL-2.0
// TUI palette. Ink accepts named colours or hex strings for color/backgroundColor.
export type TerminalAppearance = 'terminal' | 'light' | 'dark';
import { readableBrandAccent } from './brand-theme.ts';
type Palette = Record<'accentName' | 'fg' | 'dim' | 'border' | 'warn' | 'danger' | 'selectedFg', string | undefined>;
export function terminalPalette(appearance: TerminalAppearance, monochrome = process.env.NO_COLOR !== undefined): Palette {
  if (monochrome) return { accentName: undefined, fg: undefined, dim: undefined, border: undefined, warn: undefined, danger: undefined, selectedFg: undefined };
  return { accentName: appearance === 'light' ? 'blue' : 'green', fg: appearance === 'terminal' ? undefined : appearance === 'light' ? 'black' : 'white', dim: 'gray', border: 'gray', warn: appearance === 'light' ? 'magenta' : 'yellow', danger: 'red', selectedFg: appearance === 'dark' ? 'black' : undefined };
}
export let theme = terminalPalette('terminal');
let appearance: TerminalAppearance = 'terminal';
let brandPrimary: string | undefined;
let brandAccents = true;
function repaint(): void {
  theme = terminalPalette(appearance);
  if (!brandAccents || !brandPrimary || process.env.NO_COLOR !== undefined) return;
  const inferredLight = ['7', '15'].includes(process.env.COLORFGBG?.split(';').at(-1) ?? '');
  const light = appearance === 'light' || (appearance === 'terminal' && inferredLight);
  theme.accentName = readableBrandAccent(brandPrimary, light ? '#ffffff' : '#181818') ?? theme.accentName;
}
export function setTerminalAppearance(next: TerminalAppearance): void { appearance = next; repaint(); }
export function setTerminalBrand(primary?: string): void { brandPrimary = primary; repaint(); }
export function setBrandAccents(enabled: boolean): void { brandAccents = enabled; repaint(); }
export function brandAccentsEnabled(): boolean { return brandAccents; }
