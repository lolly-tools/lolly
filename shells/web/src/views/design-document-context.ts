// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system rows of Design's Document controls: the context strip that says
 * which design system, version and theme choices the document draws with (plan 286
 * section 5.1), and one segmented row per theme group (plan 291 W4), labelled by
 * the group (Mode, Colourway) since plans/319 A4.
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
import { t, tRaw } from '../i18n.ts';
import { currentPiece, onPieceKitChange, partnerKitStatus, runPieceKitAction } from '../lib/partner-kit-state.ts';

/**
 * The theme rows' segment names: one per group, named by the group's index so a
 * design system's own ids never reach markup. The inspector routes a press on one
 * to `chooseDocumentTheme`, since a theme is not a box field.
 */
export const THEME_SEG = 'lolly-doc-theme-';

/** Whether the person left the strip's Source and fallbacks disclosure open, by column. */
const disclosureOpen = new WeakMap<HTMLElement, boolean>();

/**
 * Whether to draw the disclosure open. The column calls this while it builds the markup
 * that replaces the strip, so the strip on screen is read first. It is read from the
 * markup, not from a `toggle` listener: the toggle event is queued, and a rebuild that
 * runs before it would close a disclosure the person had just opened.
 */
function keptOpen(column: HTMLElement | undefined): boolean {
  if (!column) return false;
  const details = column.querySelector<HTMLDetailsElement>('[data-token-context-details]');
  if (details) disclosureOpen.set(column, details.open);
  return disclosureOpen.get(column) ?? false;
}

/**
 * The context strip, then one segmented row per theme group. Empty without a port.
 * `column` is the element the rows are rebuilt in. Passing it keeps the disclosure open
 * or shut across rebuilds.
 */
/**
 * The partner kit's line for Design's Document section (plans/82 M8): the same words and
 * actions the tool sidebar's Design system section shows, for the piece being edited.
 */
export function partnerKitRowHtml(): string {
  const status = partnerKitStatus(currentPiece());
  if (!status) return '';
  const inner = status.kind === 'attached'
    ? `<span class="partner-kit-line-text">${esc(tRaw('Partner kit: {company} · revision {revision}', { company: status.label, revision: status.revision }))}</span>`
      + `<button type="button" class="tool-notice-link" data-partner-kit="detach">${esc(t('Detach'))}</button>`
    : `<button type="button" class="tool-notice-link" data-partner-kit="attach">${esc(tRaw('Attach {company}’s kit', { company: status.label }))}</button>`;
  return `<div class="fc-row partner-kit-line" data-partner-kit-row>${inner}</div>`;
}

export function documentThemeRows(port: DocumentThemePort | undefined, column?: HTMLElement): string {
  if (!port) return '';
  const context = port.context?.();
  const strip = context
    ? tokenContextStripHtml(tokenContextModel(context.snapshot, {
      selection: context.selection,
      scope: context.selection ? 'document' : 'system',
      choices: 'document',
      compact: true,
    }), { inspect: !!port.inspect, follow: !!port.follow, open: keptOpen(column) })
    : '';
  return partnerKitRowHtml() + strip + port.groups().map((g, gi) => {
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
  return [port.groups(), partnerKitStatus(currentPiece()), context ? [system?.id, system?.label, system?.source, system?.locked, context.snapshot.version, context.selection ?? null] : null];
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
/** One partner kit watch per inspector column: a kit read or detached repaints the column. */
const kitWatch = new WeakMap<HTMLElement, () => void>();

export function wireDocumentContext(root: HTMLElement, port: DocumentThemePort | undefined, refused: () => void): void {
  if (!port) return;
  if (!kitWatch.has(root)) {
    const off = onPieceKitChange(() => {
      if (!root.isConnected) { off(); kitWatch.delete(root); return; }
      refused();
    });
    kitWatch.set(root, off);
  }
  // The partner kit's Attach or Detach, then a repaint with the line it leaves.
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-partner-kit-row] [data-partner-kit]')) {
    button.addEventListener('click', () => {
      const act = button.dataset.partnerKit === 'detach' ? 'detach' : 'attach';
      void runPieceKitAction(act).finally(refused);
    });
  }
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
