// SPDX-License-Identifier: MPL-2.0
/**
 * The one segmented-control primitive (component audit rec 1) - a `role="group"`
 * of equal-width buttons, `aria-pressed` marking the active option. Two looks,
 * one markup function:
 *
 *   - `variant: 'app'` (the default): `.view-seg`/`.view-seg-btn`, styled in
 *     styles/parts/gallery.css (an always-eager sheet, so the primitive is
 *     available before a lazy view chunk loads). The brand studio, the gallery, the
 *     theme toggle and the other app-level pickers use it.
 *   - `variant: 'panel'`: `.lp-seg`, the segmented control of the plan 273 panel
 *     primitive (styles/parts/panel.css), for a control that lives inside an
 *     `.lp` column or beside one (Rebrand's decision column and stage). Same
 *     attributes, same hooks; only the classes differ, so a caller moves between
 *     the two by changing one option.
 *
 * Moved out of brand-editor.ts (its original home) so views that aren't the
 * brand studio can render the same markup without importing the whole editor.
 *
 * Every segmented control in the app should be built from this - a mutually
 * exclusive choice among a handful of named options, `aria-pressed` the ONE
 * active-state convention. A tab bar is a different widget: it switches PANELS,
 * not just a value, and uses `aria-selected` with a roving tabindex. The app's
 * tab bars (`.dash-tabs`, `.start-tabs`, `.color-mode-tabs`) keep their own
 * markup; the panel variant also has a tab form (`tabs: true`) that looks like
 * the segmented control and is wired with lib/tabs.ts `wireTabs`, because in a
 * panel the two sit side by side and must read as one idiom.
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
  /** Which look: the app's `.view-seg` (default) or the panel primitive's
   *  `.lp-seg`. See the module comment. */
  variant?: 'app' | 'panel';
  /** Panel variant only: write the tab form, `role="tablist"` of `role="tab"`
   *  buttons with `aria-selected` and one tab stop (the selected tab), for a
   *  control that switches what is shown below it. Wire the keys with
   *  lib/tabs.ts `wireTabs`, keyed on `attr`. Ignored by the app variant, whose
   *  stylesheet only draws `aria-pressed`. */
  tabs?: boolean;
  /** A command started from this control is still running: `aria-busy` on the
   *  group. The panel variant dims its halves and shows the progress cursor. */
  busy?: boolean;
}

/** One option. `count` is shown after the label at the count weight (panel
 *  variant) and is part of the button's name, so "To review 5" is what is read
 *  and what voice control matches. `controls` is the id of the region a tab
 *  shows, for `aria-controls`. */
export interface SegOption {
  id: string;
  label: string;
  count?: number;
  controls?: string;
}

/** Render a segmented control. `name` seeds the `data-be-seg` hook the brand
 *  studio's generic click delegate keys off; other callers can ignore it and
 *  wire their own listener against `[data-val]` inside the returned markup -
 *  the attribute is always present. */
export const segHtml = (
  name: string,
  opts: ReadonlyArray<SegOption>,
  active: string,
  label: string,
  o: SegOptions = {},
): string => {
  const panel = o.variant === 'panel';
  const tabs = panel && o.tabs === true;
  const naming = o.labelledBy ? `aria-labelledby="${escape(o.labelledBy)}"` : `aria-label="${escape(label)}"`;
  const extra = o.extraClass ? ` ${o.extraClass}` : '';
  const cls = panel ? `lp-seg${extra}` : `view-seg be-seg${extra}`;
  const btnCls = panel ? '' : ' class="view-seg-btn"';
  const role = tabs ? 'tablist' : 'group';
  const groupAttr = o.groupAttr ? ` ${escape(o.groupAttr)}` : '';
  const busy = o.busy ? ' aria-busy="true"' : '';
  return `
  <div class="${cls}" role="${role}" ${naming} data-be-seg="${escape(name)}"${groupAttr}${busy}>
    ${opts.map(x => {
      const on = x.id === active;
      const hook = o.attr ? ` ${o.attr}="${escape(x.id)}"` : '';
      const state = tabs
        ? ` role="tab" aria-selected="${on}" tabindex="${on ? 0 : -1}"${x.controls ? ` aria-controls="${escape(x.controls)}"` : ''}`
        : ` aria-pressed="${on}"`;
      const count = x.count === undefined ? '' : panel
        ? ` <b class="lp-seg-count">${escape(x.count)}</b>`
        : ` ${escape(x.count)}`;
      return `<button type="button"${btnCls} data-val="${escape(x.id)}"${hook}${state}>${escape(x.label)}${count}</button>`;
    }).join('')}
  </div>`;
};
