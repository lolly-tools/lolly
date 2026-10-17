// SPDX-License-Identifier: MPL-2.0
/**
 * The readable label of a design-system theme option. A leaf module, so the theme
 * control (lib/document-theme.ts) and the context strip
 * (components/token-context-strip.ts) share one rule without importing each other.
 */
import { t } from '../i18n.ts';

/** Light and dark, the themes every shipped pack declares, read in the person's
 *  language; any other theme keeps the design system's own label. */
export function themeOptionLabel(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === 'light') return t('Light');
  if (key === 'dark') return t('Dark');
  return name;
}
