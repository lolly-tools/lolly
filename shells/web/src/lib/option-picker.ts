// SPDX-License-Identifier: MPL-2.0
/**
 * The `display: "picker"` select (engine 1.348.0): one button in the sidebar that
 * shows the current choice, and a panel of option tiles under their `group`
 * headings, which is a bottom sheet on a phone. A long list a person should
 * recognise (Chart's 35 types) becomes a set to look at instead of a list of
 * words to read.
 *
 * views/tool-inputs.ts draws the trigger with optionPickerHtml() from the option
 * list it has already narrowed (an option whose own showIf fails is dropped unless
 * it is the current value, which stays and is marked not applicable; a policy
 * `choice` narrows further), and wires it from the badged radiogroup's own loop
 * with that loop's commit, so undo, the address, a showIf re-render and policy
 * behave as for any select. This module only draws and drives the panel.
 *
 * The panel is mounted on document.body by mountBodyPopover (in the open dialog,
 * when the trigger sits in one), which already owns the lifecycle every body
 * popover shares: an outside press, Escape, a window resize, a route change,
 * system Back on a touch device and the focus restore. The view's teardown calls
 * closeOptionPicker(), and an open panel closes when a rebuild drops its trigger,
 * so no node outlives the sidebar or the input it chooses for.
 *
 * On a desktop the panel opens under the trigger when the whole set fits there and
 * beside the trigger when it does not (panelPlace), in 4, 5 or 6 columns chosen
 * from the set (pickerColumns), so a long set is seen whole.
 *
 * Markup safety: every label and heading goes through escapeHtml(), and a glyph is
 * drawn only after it passes the schema's own pattern again (path commands and
 * numbers, at most 900 characters), so a manifest that skipped validation still
 * cannot write markup through one.
 */
import { closeButtonHtml } from './close-button.ts';
import { mountBodyPopover, type BodyPopoverHandle, type PopoverAnchor } from '../components/body-popover.ts';
import { t } from '../i18n.ts';
import { hasIcon, icon } from './icons.ts';
import { isPhoneLayout, onLayoutChange } from './layout-posture.ts';
import { escapeHtml } from './util/escape.ts';
import './option-picker.css';

/** The schema's bound on `options[].glyph` (schemas/tool.schema.json), tested again
 *  here. The same character class: the schema writes the closing hyphen as `\-`,
 *  which a literal here does not need, and a unit test holds the two to the same
 *  answer for every character. */
export const GLYPH_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9 ,.-]+$/;
export const GLYPH_MAX_LENGTH = 900;

/** One option, after the sidebar has narrowed the list. */
export interface PickerChoice {
  value: string;
  label: string;
  icon?: string;
  na?: boolean;
}

/** The slice of an input model item the trigger reads. */
export interface PickerInput {
  id: string;
  label?: string;
  value?: unknown;
  options?: ReadonlyArray<{ value: unknown; glyph?: unknown; group?: unknown }>;
}

/** What the trigger carries for the panel: the choices plus each one's glyph and group. */
export interface PickerOption extends PickerChoice {
  glyph?: string;
  group?: string;
}
export interface PickerSpec {
  id: string;
  label: string;
  value: string;
  options: PickerOption[];
}

/**
 * True for a select the sidebar draws as buttons rather than a native <select>:
 * a badged list (any option has a `badge`, unless the manifest asks for a plain
 * select), `display: "segmented"` and `display: "picker"`. The row around such a
 * control is a group, not a <label>, so a press on the row's dead space neither
 * chooses an option nor opens the panel.
 */
export function drawsAsButtons(input: { control?: string; display?: string; options?: ReadonlyArray<{ badge?: unknown }> }): boolean {
  if (input.control !== 'select') return false;
  if (input.display === 'segmented' || input.display === 'picker') return true;
  return input.display !== 'select' && (input.options ?? []).some((o) => Boolean(o.badge));
}

/** The glyph when it passes the pattern, else null. */
export function safeGlyph(glyph: unknown): string | null {
  return typeof glyph === 'string' && glyph.length <= GLYPH_MAX_LENGTH && GLYPH_PATTERN.test(glyph) ? glyph : null;
}

/** The option's picture: its own glyph, else its registry icon, else nothing. */
function markHtml(opt: PickerOption): string {
  const glyph = safeGlyph(opt.glyph);
  if (glyph) {
    return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.75"'
      + ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${escapeHtml(glyph)}"/></svg>`;
  }
  return opt.icon && hasIcon(opt.icon) ? icon(opt.icon) : '';
}

const pictured = (spec: PickerSpec): boolean => spec.options.some((o) => markHtml(o) !== '');
const listboxId = (id: string): string => `opick-${id}`;

/** Join the narrowed choices with the manifest's glyph and group for each. */
export function pickerSpec(input: PickerInput, choices: readonly PickerChoice[]): PickerSpec {
  const raw = new Map((input.options ?? []).map((o) => [String(o.value), o]));
  return {
    id: input.id,
    label: input.label ?? input.id,
    value: String(input.value ?? ''),
    options: choices.map((c) => {
      const o = raw.get(c.value);
      const glyph = safeGlyph(o?.glyph);
      const group = typeof o?.group === 'string' && o.group ? o.group : undefined;
      return { value: c.value, label: c.label, ...(c.icon ? { icon: c.icon } : {}), ...(c.na ? { na: true } : {}), ...(glyph ? { glyph } : {}), ...(group ? { group } : {}) };
    }),
  };
}

/**
 * The trigger: a button in the select's own box (`.field-select`, so the height,
 * corner, surface, bevel and chevron are the native select's), showing the current
 * option's glyph and label. It carries `data-badge-select` so the radiogroup loop
 * in tool-inputs.ts wires the button, and `data-input-id` so the sidebar's by-id
 * focus restore finds the button after a rebuild. Its name is the row caption plus the
 * current choice (`irow-label-<id>` is the caption id a composite row gets).
 */
export function optionPickerHtml(input: PickerInput, choices: readonly PickerChoice[]): string {
  const spec = pickerSpec(input, choices);
  const id = escapeHtml(spec.id);
  const cur = spec.options.find((o) => o.value === spec.value);
  const mark = pictured(spec) ? `<span class="option-picker-glyph" aria-hidden="true">${cur ? markHtml(cur) : ''}</span>` : '';
  const na = cur?.na ? `<span class="option-picker-na"> (${escapeHtml(t('not applicable'))})</span>` : '';
  return `<button type="button" class="field-select option-picker-trigger${cur?.na ? ' is-na' : ''}" data-option-picker`
    + ` data-badge-select="${id}" data-input-id="${id}" value="${escapeHtml(spec.value)}" aria-haspopup="listbox" aria-expanded="false"`
    + ` aria-controls="${listboxId(id)}" aria-labelledby="irow-label-${id} opick-cur-${id}"`
    + `${cur?.na ? ` title="${escapeHtml(t('Not applicable in this mode'))}"` : ''} data-picker="${escapeHtml(JSON.stringify(spec))}">`
    + `${mark}<span class="option-picker-current" id="opick-cur-${id}">${escapeHtml(cur?.label ?? spec.value)}${na}</span></button>`;
}

/** Options in their groups: the unlabelled run first, then each heading in order of first appearance. */
export function groupOptions(options: readonly PickerOption[]): Array<{ heading: string | null; options: PickerOption[] }> {
  const loose: PickerOption[] = [];
  const named = new Map<string, PickerOption[]>();
  for (const o of options) {
    if (!o.group) loose.push(o);
    else named.set(o.group, [...(named.get(o.group) ?? []), o]);
  }
  return [...(loose.length ? [{ heading: null, options: loose }] : []), ...[...named].map(([heading, opts]) => ({ heading, options: opts }))];
}

/** The panel's content. `sheet` adds the phone's dimmed area and its header row. */
export function pickerPanelHtml(spec: PickerSpec, sheet: boolean): string {
  const list = listboxId(escapeHtml(spec.id));
  const marks = pictured(spec);
  const hasCurrent = spec.options.some((o) => o.value === spec.value);
  let n = 0;
  const tile = (o: PickerOption): string => {
    const on = o.value === spec.value;
    const stop = on || (!hasCurrent && n === 0);
    const html = `<div class="option-picker-tile${on ? ' is-on' : ''}${o.na ? ' is-na' : ''}" role="option" id="${list}-${n}"`
      + ` tabindex="${stop ? '0' : '-1'}" aria-selected="${on ? 'true' : 'false'}" data-value="${escapeHtml(o.value)}"`
      + `${o.na ? ` title="${escapeHtml(t('Not applicable in this mode'))}"` : ''}>`
      + `${marks ? `<span class="option-picker-tile-glyph" aria-hidden="true">${markHtml(o)}</span>` : ''}`
      + `<span class="option-picker-tile-label">${escapeHtml(o.label)}</span>`
      + `${o.na ? `<span class="visually-hidden"> (${escapeHtml(t('not applicable'))})</span>` : ''}</div>`;
    n += 1;
    return html;
  };
  const groups = groupOptions(spec.options).map((g, gi) => {
    const tiles = `<div class="option-picker-grid" role="none">${g.options.map(tile).join('')}</div>`;
    if (g.heading === null) return `<div class="option-picker-group" role="none">${tiles}</div>`;
    const head = `${list}-g${gi}`;
    return `<div class="option-picker-group" role="group" aria-labelledby="${head}">`
      + `<div class="option-picker-heading" id="${head}" role="none">${escapeHtml(g.heading)}</div>${tiles}</div>`;
  }).join('');
  const header = sheet
    ? `<div class="option-picker-head"><span class="option-picker-title">${escapeHtml(spec.label)}</span>`
      + `${closeButtonHtml({ className: 'option-picker-close', attrs: { 'data-picker-close': true } })}</div>`
    : '';
  return `${sheet ? '<div class="option-picker-scrim" data-picker-scrim aria-hidden="true"></div>' : ''}`
    + `<div class="option-picker-surface">${header}`
    + `<div class="option-picker-list${marks ? '' : ' option-picker-list--text'}" role="listbox" id="${list}" aria-label="${escapeHtml(spec.label)}">${groups}</div></div>`;
}

/**
 * How many columns the floating panel draws: 4, 5 or 6, whichever leaves the fewest
 * empty cells at the ends of the groups' last rows, and the fewest columns among
 * equals. Chart's types (10, 6, 9, 5 and 5 in their groups) sit in five columns
 * with five cells empty, where four columns leave thirteen and a row of two.
 */
export function pickerColumns(groups: ReadonlyArray<{ options: readonly unknown[] }>): number {
  let best = 4;
  let fewest = Number.POSITIVE_INFINITY;
  for (const cols of [4, 5, 6]) {
    const empty = groups.reduce((sum, g) => sum + ((cols - (g.options.length % cols)) % cols), 0);
    if (empty < fewest) {
      fewest = empty;
      best = cols;
    }
  }
  return best;
}

/** Where the floating panel goes. `maxHeight` is set only when the panel has to scroll. */
export interface PanelPlace {
  left: number;
  top: number;
  maxHeight: number | null;
}

/**
 * Under the trigger with left edges aligned, when the whole panel fits there. A
 * panel too tall for that opens beside the trigger with top edges aligned, moved up
 * as far as the viewport needs, so a long set is seen whole and the trigger stays in
 * view; the far side first, the near side when the far side has no room. With no
 * room on either side the panel goes over or under the trigger, whichever is
 * larger, and scrolls; where neither holds a usable list the panel takes the
 * viewport's height and covers the trigger. Every case stays inside the viewport.
 * In a right-to-left layout (`rtl`) the edges that align are the right ones and
 * the far side is the left.
 */
export function panelPlace(
  anchor: { left: number; right: number; top: number; bottom: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  rtl = false,
): PanelPlace {
  const M = 12; // kept clear of the viewport's edge
  const GAP = 4; // between the trigger and a panel under or over it
  const SIDE = 8; // between the trigger and a panel beside it
  const USABLE = 120; // the least height a scrolling list is worth opening at
  const tall = Math.max(0, viewport.height - 2 * M);
  // The top edge of a panel under the trigger and the room it has there. A trigger
  // scrolled out above the viewport still gets a panel inside the viewport.
  const under = Math.max(M, anchor.bottom + GAP);
  const below = viewport.height - M - under;
  // A trigger nearer the viewport's edge than the margin keeps its panel on its
  // own edge, as a select's list hangs from the select.
  const inset = (gap: number): number => Math.max(0, Math.min(M, gap));
  const aligned = rtl
    ? Math.max(M, Math.min(anchor.right, viewport.width - inset(viewport.width - anchor.right)) - panel.width)
    : Math.max(inset(anchor.left), Math.min(anchor.left, viewport.width - panel.width - M));
  if (panel.height <= below) return { left: aligned, top: under, maxHeight: null };

  const after = anchor.right + SIDE;
  const before = anchor.left - SIDE - panel.width;
  const afterFits = after + panel.width + M <= viewport.width;
  const beforeFits = before >= M;
  const side = rtl ? (beforeFits ? before : afterFits ? after : null) : (afterFits ? after : beforeFits ? before : null);
  if (side !== null) {
    const height = Math.min(panel.height, tall);
    const top = Math.max(M, Math.min(anchor.top, viewport.height - M - height));
    return { left: side, top, maxHeight: panel.height > tall ? tall : null };
  }

  // The bottom edge of a panel over the trigger, and the room it has there.
  const ceiling = Math.min(anchor.top - GAP, viewport.height - M);
  const above = ceiling - M;
  const room = Math.max(below, above);
  if (room < USABLE) return { left: aligned, top: M, maxHeight: panel.height > tall ? tall : null };
  const height = Math.min(panel.height, room);
  const over = panel.height <= above || above > below;
  return { left: aligned, top: over ? ceiling - height : under, maxHeight: panel.height > room ? room : null };
}

/** Measure the panel and put it where panelPlace() says. A sheet is placed by its
 *  stylesheet. The panel is position:fixed, on <body> or in the open dialog its
 *  trigger sits in. A dialog that is itself the containing block (one with a
 *  transform) offsets a fixed child, so the panel is measured where the browser
 *  drew it and moved by the difference. */
export function placePanel(el: HTMLElement, anchor: PopoverAnchor): void {
  const surface = el.querySelector<HTMLElement>('.option-picker-surface');
  if (el.classList.contains('is-sheet') || !surface) return;
  surface.style.maxHeight = '';
  const place = panelPlace(
    anchor.getBoundingClientRect(),
    { width: el.offsetWidth, height: el.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
    document.documentElement.dir === 'rtl',
  );
  if (place.maxHeight !== null) surface.style.maxHeight = `${Math.round(place.maxHeight)}px`;
  const left = Math.round(place.left);
  const top = Math.round(place.top);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  const actual = el.getBoundingClientRect();
  if (!actual.width && !actual.height) return;
  const dx = Math.round(left - actual.left);
  const dy = Math.round(top - actual.top);
  if (dx) el.style.left = `${left + dx}px`;
  if (dy) el.style.top = `${top + dy}px`;
}

/** The phone layout, read the way the sidebar reads it (tool-inputs.ts inSheetMode). */
const sheetLayout = (): boolean => typeof matchMedia !== 'undefined' && isPhoneLayout();

/** The tile one row up or down whose centre is nearest across. Without layout
 *  (no measured box) it falls back to reading order. */
export function verticalNeighbour(tiles: readonly HTMLElement[], from: HTMLElement, dir: 1 | -1): HTMLElement | undefined {
  const r = from.getBoundingClientRect();
  if (!r.width && !r.height) return tiles[tiles.indexOf(from) + dir];
  const cx = r.left + r.width / 2;
  const rows = tiles.flatMap((tile) => {
    if (tile === from) return [];
    const b = tile.getBoundingClientRect();
    const gap = dir > 0 ? b.top - r.bottom : r.top - b.bottom;
    return gap >= -1 ? [{ tile, gap, dx: Math.abs(b.left + b.width / 2 - cx) }] : [];
  });
  if (!rows.length) return undefined;
  const nearest = Math.min(...rows.map((c) => c.gap));
  return rows.filter((c) => c.gap <= nearest + 2).sort((a, b) => a.dx - b.dx)[0]!.tile;
}

/** The open panel, which a sidebar rebuild re-points and a teardown closes. */
interface OpenPicker {
  id: string;
  /** The trigger's `data-picker` the panel was drawn from. */
  drawn: string;
  trigger(): HTMLElement;
  repoint(el: HTMLElement): void;
  close(returnFocus?: boolean): void;
}
let openPicker: OpenPicker | null = null;

/** Close the open panel. With `root`, only when its trigger sits in that root or has
 *  left the document, so tearing down one sidebar leaves another's panel alone. */
export function closeOptionPicker(root?: Element): void {
  if (!openPicker) return;
  const trigger = openPicker.trigger();
  if (!root || !trigger.isConnected || root.contains(trigger)) openPicker.close();
}

/**
 * Wire one trigger. Returns false when `el` is not a picker trigger, so the caller's
 * loop carries on with its own radiogroup wiring. `commit` is the caller's write;
 * it runs after the panel has closed and focus is back on the trigger, and only
 * when the choice differs from the current value.
 */
export function wireOptionPicker(el: HTMLElement, commit: (value: string) => void): boolean {
  if (!el.hasAttribute('data-option-picker')) return false;
  let spec: PickerSpec;
  try {
    spec = JSON.parse(el.dataset.picker ?? '') as PickerSpec;
  } catch {
    return true;
  }
  // A rebuild while the panel is open hands the panel this new trigger, so its
  // position, aria-expanded and focus restore follow the button on screen. A
  // rebuild that changed the choices or the value leaves the panel showing a set
  // that no longer stands, so the panel closes and focus goes to the new trigger.
  if (openPicker?.id === spec.id && !openPicker.trigger().isConnected) {
    const same = openPicker.drawn === (el.dataset.picker ?? '');
    openPicker.repoint(el);
    if (same) el.setAttribute('aria-expanded', 'true');
    else openPicker.close(true);
  }
  let live = el;
  const anchor: PopoverAnchor = {
    getBoundingClientRect: () => live.getBoundingClientRect(),
    contains: (node) => live.contains(node),
    focus: () => live.focus(),
    setAttribute: (name, value) => live.setAttribute(name, value),
  };
  let popover: BodyPopoverHandle | null = null;

  const open = (): void => {
    if (openPicker?.trigger() === el) return;
    closeOptionPicker();
    const sheet = sheetLayout();
    let panel: HTMLElement | null = null;
    let tiles: HTMLElement[] = [];
    let typed = '';
    let typedAt = 0;
    let unlockScroll: (() => void) | null = null;

    const focusTile = (tile: HTMLElement | undefined): void => {
      if (!tile) return;
      for (const other of tiles) other.tabIndex = other === tile ? 0 : -1;
      tile.focus();
    };
    const choose = (tile: HTMLElement, pop: BodyPopoverHandle): void => {
      const value = tile.dataset.value ?? '';
      pop.close(true);
      if (value !== spec.value) commit(value);
    };
    const labelOf = (tile: HTMLElement): string =>
      (tile.querySelector('.option-picker-tile-label')?.textContent ?? '').toLocaleLowerCase();
    // Type-ahead: the next tile whose label starts with what was typed. A letter
    // pressed again on its own steps through the tiles that start with that letter.
    const typeAhead = (key: string, from: number): HTMLElement | undefined => {
      const now = Date.now();
      typed = now - typedAt > 800 ? key : typed + key;
      typedAt = now;
      const q = typed.toLocaleLowerCase();
      const repeat = [...q].every((c) => c === q[0]);
      const needle = repeat ? q[0]! : q;
      const start = repeat ? from + 1 : from;
      for (let k = 0; k < tiles.length; k += 1) {
        const tile = tiles[(start + k + tiles.length) % tiles.length]!;
        if (labelOf(tile).startsWith(needle)) return tile;
      }
      return undefined;
    };

    const render = (host: HTMLDivElement, pop: BodyPopoverHandle): HTMLElement | null => {
      panel = host;
      host.innerHTML = pickerPanelHtml(spec, sheet);
      // A sheet takes its columns from the phone's width; the floating panel from the set.
      if (!sheet) host.dataset.cols = String(pickerColumns(groupOptions(spec.options)));
      tiles = [...host.querySelectorAll<HTMLElement>('[role="option"]')];
      for (const tile of tiles) tile.addEventListener('click', () => choose(tile, pop));
      host.querySelector('[data-picker-scrim]')?.addEventListener('click', () => pop.close(true));
      host.querySelector('[data-picker-close]')?.addEventListener('click', () => pop.close(true));
      host.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          pop.close(true);
          return;
        }
        const tile = (e.target as Element).closest?.<HTMLElement>('[role="option"]');
        if (!tile || e.ctrlKey || e.metaKey || e.altKey) return;
        const at = tiles.indexOf(tile);
        let next: HTMLElement | undefined;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          choose(tile, pop);
          return;
        }
        // Right-to-left, the grid runs from the right, so the arrows swap.
        const step = document.documentElement.dir === 'rtl' ? -1 : 1;
        if (e.key === 'ArrowRight') next = tiles[at + step];
        else if (e.key === 'ArrowLeft') next = tiles[at - step];
        else if (e.key === 'ArrowDown') next = verticalNeighbour(tiles, tile, 1);
        else if (e.key === 'ArrowUp') next = verticalNeighbour(tiles, tile, -1);
        else if (e.key === 'Home') next = tiles[0];
        else if (e.key === 'End') next = tiles[tiles.length - 1];
        else if (e.key.length === 1 && e.key.trim()) next = typeAhead(e.key, at);
        else return;
        // Handled here, so a shortcut the view binds to the same key never fires.
        e.preventDefault();
        e.stopPropagation();
        focusTile(next);
      });
      if (sheet) {
        // The page behind holds still while the sheet is up.
        const root = document.documentElement;
        const before = root.style.overflow;
        root.style.overflow = 'hidden';
        unlockScroll = () => {
          root.style.overflow = before;
          if (root.getAttribute('style') === '') root.removeAttribute('style');
        };
      }
      return tiles.find((tile) => tile.tabIndex === 0) ?? null;
    };

    // A trigger inside an open dialog (the embedded tool editor's inputs) mounts its
    // panel in that dialog: a node on <body> sits under a modal dialog and is inert.
    const dialog = el.closest<HTMLElement>('dialog[open]');
    // Crossing between the phone and the desktop layout closes the panel rather
    // than leaving a sheet on a desktop or a popover on a phone. The layout class
    // settles a moment after the resize event, so the settled change is heard too.
    const offLayout = onLayoutChange(() => {
      if (sheetLayout() !== sheet) popover?.close();
    });
    // A sidebar rebuild that drops this input (its showIf turned false) draws no
    // new trigger to take the panel over. The observer reports once the rebuild
    // and its wiring have run, and a panel whose trigger has left the document
    // closes, so no panel is left choosing for an input that is not on screen.
    const Observer = typeof window.MutationObserver === 'function' ? window.MutationObserver : null;
    const watch = Observer ? new Observer(() => { if (!live.isConnected) popover?.close(false); }) : null;
    watch?.observe(document.body, { childList: true, subtree: true });
    popover = mountBodyPopover(anchor, render, {
      className: `option-picker-panel${sheet ? ' is-sheet' : ''}`,
      role: 'none',
      position: placePanel,
      trackScroll: !sheet,
      ...(dialog ? { container: dialog } : {}),
      onResize: (pop) => {
        if (sheetLayout() !== sheet) pop.close();
        else if (panel) placePanel(panel, anchor);
      },
      onClose: () => {
        offLayout();
        watch?.disconnect();
        unlockScroll?.();
        unlockScroll = null;
        if (openPicker === record) openPicker = null;
      },
    });
    const record: OpenPicker = {
      id: spec.id,
      drawn: el.dataset.picker ?? '',
      trigger: () => live,
      repoint: (next) => { live = next; },
      close: (returnFocus) => popover?.close(returnFocus),
    };
    openPicker = record;
    popover.open();
  };

  // A second press on the trigger closes the panel, including one a rebuild
  // re-pointed to this trigger from the button it replaced.
  el.addEventListener('click', () => {
    if (openPicker?.trigger() === el) openPicker.close(true);
    else open();
  });
  // The arrow keys open the panel from the trigger, as they open a select's list.
  el.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      open();
    }
  });
  return true;
}
