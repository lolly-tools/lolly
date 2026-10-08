// SPDX-License-Identifier: MPL-2.0
/**
 * The web shell's `t()` for the shell modules the editor frame bundles
 * (lib/context-menu.ts). The frame has no catalog of translations: it says the
 * English source, with `{name}` placeholders filled, as the shell does for a
 * string it has no translation of.
 */
export function t(source: string, params?: Record<string, string | number>): string {
  if (!params) return source;
  return source.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}
