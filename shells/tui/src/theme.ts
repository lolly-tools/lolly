// SPDX-License-Identifier: MPL-2.0
// TUI palette. Ink accepts named colours or hex strings for color/backgroundColor.
export type TerminalAppearance = 'terminal' | 'light' | 'dark';
type Palette = Record<'accentName' | 'fg' | 'dim' | 'border' | 'warn' | 'danger' | 'selectedFg', string | undefined>;
export function terminalPalette(appearance: TerminalAppearance, monochrome = process.env.NO_COLOR !== undefined): Palette {
  if (monochrome) return { accentName: undefined, fg: undefined, dim: undefined, border: undefined, warn: undefined, danger: undefined, selectedFg: undefined };
  return { accentName: appearance === 'light' ? 'blue' : 'green', fg: appearance === 'terminal' ? undefined : appearance === 'light' ? 'black' : 'white', dim: 'gray', border: 'gray', warn: appearance === 'light' ? 'magenta' : 'yellow', danger: 'red', selectedFg: appearance === 'dark' ? 'black' : undefined };
}
export let theme = terminalPalette('terminal');
export function setTerminalAppearance(appearance: TerminalAppearance): void { theme = terminalPalette(appearance); }
