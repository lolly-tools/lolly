// SPDX-License-Identifier: MPL-2.0
/**
 * The one segmented-control primitive (component audit rec 1) - a `role="group"`
 * of equal-width `.view-seg-btn`s, `aria-pressed` marking the active option.
 * `.view-seg`/`.view-seg-btn` themselves live in styles/parts/gallery.css (an
 * always-eager sheet, so the primitive is available before any lazy view chunk),
 * this module is just the shared markup function - moved out of brand-editor.ts
 * (its original home) so views that aren't the brand studio can render the same
 * markup without importing the whole editor module.
 *
 * Every segmented control in the app should be built from this - a mutually
 * exclusive choice among a handful of named options, `aria-pressed` the ONE
 * active-state convention. Tab bars (`.dash-tabs`, `.start-tabs`,
 * `.color-mode-tabs`) are a deliberately different widget (they switch panels,
 * not just a value) and use `aria-selected` + the roving-tabindex helper in
 * lib/tabs.ts instead - see that module's doc comment for the distinction.
 */
import { escape } from '../utils.ts';

export interface SegOptions {
  /** Value-hook attribute stamped on each button INSTEAD of `data-val`. Callers
   *  whose click delegate keys off their own name (`data-view`, `data-favview`,
   *  `data-fview`, `data-theme-seg`, `data-kind`, `data-store-fmt`) used to fork
   *  the whole markup string for this one attribute - six near-copies of the
   *  same six lines. `data-val` is always emitted as well, so a caller can move
   *  to the canonical hook later without touching its markup again. */
  attr?: string;
  /** Extra class(es) on the group - a caller's own layout/scoping hook. */
  extraClass?: string;
  /** Name of a valueless marker attribute on the group, e.g. the brand studio's
   *  `data-be-schemekind`. Name only - a value would need its own escaping pass
   *  and no caller has wanted one; keeping it valueless is what lets this be
   *  escaped as a plain identifier below. */
  groupAttr?: string;
  /** Use `aria-labelledby` instead of `aria-label` - for a group whose name is
   *  already on screen as a heading, where a duplicate aria-label would have AT
   *  read the label twice. When set, `label` is ignored. */
  labelledBy?: string;
}

/** Render a `.view-seg` group. `name` seeds the `data-be-seg` hook the brand
 *  studio's generic click delegate keys off; other callers can ignore it and
 *  wire their own listener against `.view-seg-btn[data-val]` inside the
 *  returned markup - the attribute is always present. */
export const segHtml = (
  name: string,
  opts: ReadonlyArray<{ id: string; label: string }>,
  active: string,
  label: string,
  o: SegOptions = {},
): string => {
  const naming = o.labelledBy ? `aria-labelledby="${escape(o.labelledBy)}"` : `aria-label="${escape(label)}"`;
  const cls = `view-seg be-seg${o.extraClass ? ` ${o.extraClass}` : ''}`;
  const groupAttr = o.groupAttr ? ` ${escape(o.groupAttr)}` : '';
  return `
  <div class="${cls}" role="group" ${naming} data-be-seg="${escape(name)}"${groupAttr}>
    ${opts.map(x => {
      const hook = o.attr ? ` ${o.attr}="${escape(x.id)}"` : '';
      return `<button type="button" class="view-seg-btn" data-val="${escape(x.id)}"${hook} aria-pressed="${x.id === active}">${escape(x.label)}</button>`;
    }).join('')}
  </div>`;
};
