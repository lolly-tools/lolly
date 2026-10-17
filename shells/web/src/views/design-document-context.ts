// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system rows of Design's Document controls: the context strip that says
 * which design system, version and theme choices the document draws with (plan 286
 * section 5.1), and one segmented Theme row per group (plan 291 W4).
 *
 * Both read the inspector's theme port (lib/document-theme.ts). The theme choice is
 * the DOCUMENT's: it is saved with the session and never written to the design
 * system, and the inspector the strip opens is read-only.
 */
import type { DocumentThemePort } from '../lib/document-theme.ts';
import { tokenContextModel, tokenContextStripHtml } from '../components/token-context-strip.ts';
import { helpTip } from '../components/help-tip.ts';
import { segHtml } from './free-canvas-fields.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';

/**
 * The theme rows' segment names: one per group, named by the group's index so a
 * design system's own ids never reach markup. The inspector routes a press on one
 * to `chooseDocumentTheme`, since a theme is not a box field.
 */
export const THEME_SEG = 'lolly-doc-theme-';

/** The context strip, then one segmented row per theme group. Empty without a port. */
export function documentThemeRows(port: DocumentThemePort | undefined): string {
  if (!port) return '';
  const context = port.context?.();
  const strip = context
    ? tokenContextStripHtml(tokenContextModel(context.snapshot, {
      selection: context.selection,
      scope: context.selection ? 'document' : 'system',
      choices: 'document',
      compact: true,
    }), { inspect: !!port.inspect, follow: !!port.follow })
    : '';
  return strip + port.groups().map((g, gi) => {
    const tip = helpTip(t('Colours linked to the design system follow this choice.'));
    return `<div class="fc-row help-tip-host"><span class="fc-row-help-label"><span>${esc(g.label)}</span>${tip.button}</span>`
      + segHtml(`${THEME_SEG}${gi}`, String(g.options.findIndex((o) => o.id === g.active)), g.options.map((o, oi) => [String(oi), o.label]), g.label)
      + `${tip.pop}</div>`;
  }).join('');
}

/** What the inspector memoises its repaint on for these rows. */
export function documentThemeSignature(port: DocumentThemePort | undefined): unknown {
  if (!port) return null;
  const context = port.context?.();
  const system = context?.snapshot.system;
  return [port.groups(), context ? [system?.id, system?.label, system?.source, system?.locked, context.snapshot.version, context.selection ?? null] : null];
}

/**
 * Apply a theme segment press: index back to ids, then the port does the rest. A
 * refused change calls `refused`, which repaints the segment onto the theme in force.
 */
export function chooseDocumentTheme(port: DocumentThemePort | undefined, field: string, value: string | undefined, refused: () => void): void {
  const group = port?.groups()[Number(field.slice(THEME_SEG.length))];
  const option = group?.options[Number(value)];
  if (!port || !group || !option || option.id === group.active) return;
  void port.choose(group.id, option.id).catch((error: unknown) => {
    console.warn('[design] the theme could not be changed:', error);
    refused();
  });
}

/** Wire the strip's actions after a repaint. Both act on the document only. */
export function wireDocumentContext(root: HTMLElement, port: DocumentThemePort | undefined, refused: () => void): void {
  if (!port) return;
  const inspect = root.querySelector<HTMLButtonElement>('[data-token-context-inspect]');
  inspect?.addEventListener('click', () => {
    void port.inspect?.().catch((error: unknown) => {
      console.warn('[design] the token inspector could not open:', error);
      inspect.textContent = t('Tokens could not be read.');
    });
  });
  root.querySelector<HTMLButtonElement>('[data-token-context-follow]')?.addEventListener('click', () => {
    void port.follow?.().catch((error: unknown) => {
      console.warn('[design] the theme could not be changed:', error);
      refused();
    });
  });
}
