// SPDX-License-Identifier: MPL-2.0
import { frameFilterApplies, selectFramePage } from '@lolly/engine';
// Export-target opt-in (plan: sandbox render). A tool whose exported output is
// NOT its whole canvas - e.g. a code sandbox whose rendered preview is transplanted
// into a same-origin mirror node - marks that node with `data-export-root`; the
// walker then rasterises the mirror instead of the IDE chrome. Inert by construction
// for every other tool: no marker → querySelector null → the canvas itself is used.
export const exportTargetNode = (c: HTMLElement | null): HTMLElement | null =>
  c?.querySelector<HTMLElement>('[data-export-root]') ?? c;


/**
 * The one artboard a deep link's `s=` names, for a still export (plan 112 section 10).
 * The export panel's fan-out already honours `s`; a link that exports on load called
 * the runtime with the whole target instead, so `?s=9&format=png&export` (and the CLI's
 * `--s=9`, the same path under another transport) wrote the first slide. Resolution is
 * the engine's, against the ids the rendered pages carry, so both paths pick the same
 * page from the same string. Null when nothing applies: no address, a multi-page or
 * motion format, a document without artboards, or an address that matches no page.
 */
export function addressedFramePage(
  root: Pick<ParentNode, 'querySelectorAll'> | null,
  fmt: string,
  address: string | null | undefined,
): HTMLElement | null {
  if (!root || !address || !frameFilterApplies(fmt)) return null;
  const pages = [...root.querySelectorAll<HTMLElement>('[data-pdf-page]')];
  const pick = selectFramePage(pages.map((p) => p.getAttribute('data-frame-id')), address);
  return pick.kind === 'page' ? pages[pick.index] ?? null : null;
}
