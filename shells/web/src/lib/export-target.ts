// SPDX-License-Identifier: MPL-2.0
// Export-target opt-in (plan: sandbox render). A tool whose exported output is
// NOT its whole canvas - e.g. a code sandbox whose rendered preview is transplanted
// into a same-origin mirror node - marks that node with `data-export-root`; the
// walker then rasterises the mirror instead of the IDE chrome. Inert by construction
// for every other tool: no marker → querySelector null → the canvas itself is used.
export const exportTargetNode = (c: HTMLElement | null): HTMLElement | null =>
  c?.querySelector<HTMLElement>('[data-export-root]') ?? c;

