// SPDX-License-Identifier: MPL-2.0
/**
 * The candidate tray's SURFACE (plan 97 section 8, M2) - the panel over `tray.ts`.
 *
 * `tray.ts` is the model: what a source scan found, persisted, deduped, and
 * never committed to anything. This module is the one place a person can see
 * that list and act on it. The split is the point - the model is testable under
 * bare node and outlives any view, the surface is DOM-bound and disposable.
 *
 * ONE DOM, TWO LAYOUTS. From 641px up it is a dock: a small fixed panel parked
 * on the inline-end edge, opened from the studio rail and closed when you are
 * done with it. At 640px and below the same element is a bottom sheet with the
 * palette sheet's peek/half/full grip (lib/mobile-sheet.ts). CSS decides which,
 * so nothing re-renders across the breakpoint; JS only attaches the sheet driver
 * while the media query actually matches. Sheet and grip are DIRECT children of
 * `.start` - the same specificity contract mountPaletteSheet documents, and the
 * reason styles/parts/tray.css writes its fixed-position rules at `.start > …`.
 *
 * NOTHING HERE COMMITS ANYTHING BY ITSELF. Every add is a press, one candidate
 * at a time, through the room that owns that material: a colour goes through the
 * Colours room's own add path (`ctx.addColors`, one call per candidate, so one
 * add is one token), a family through the Type room's installer, a name through
 * the head document. A candidate type with no handler renders with Dismiss and
 * NO Add button rather than a dead control or a promise about a later milestone
 * - plan 97 section 9, never show something that cannot be used.
 *
 * The tray closes itself when its last pending candidate leaves (added or
 * dismissed): an empty tray is an empty concept, and advertising one is exactly
 * what section 9 rules out. `open()` refuses for the same reason - a rescan that finds
 * nothing new must not raise an empty panel.
 *
 * KEYBOARD. Every action here destroys the control that ran it: the list is one
 * innerHTML write off the model's subscription, so the button under the cursor
 * is a different node a tick later. `render()` therefore remembers what had
 * focus and puts it back - on the same control when it survives, on the row that
 * took its place when it does not. The panel is a disclosure of the rail's tray
 * toggle: it carries an id the toggle points `aria-controls` at, opening from
 * that press moves focus inside, and closing hands focus back to where it came
 * from. DOM order cannot carry that relationship (the panel is a fixed dock
 * appended last, after the whole studio), which is exactly why the programmatic
 * pair and the focus moves are not optional here.
 */

import '../../styles/parts/tray.css'; // .ds-tray* rules - rides this module's lazy chunk

import { escape } from '../../utils.ts';
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { icon } from '../icons.ts';
import type { IconName } from '../icons.ts';
import { nameColor } from '../color-namer.ts';
import { setupMobileSheet } from '../mobile-sheet.ts';
import type { MobileSheetHandle } from '../mobile-sheet.ts';
import { POPULAR_FAMILIES } from '../google-fonts.ts';
import type { ColorEntry } from './add-color.ts';
import type { Candidate, CandidateType, Tray } from './tray.ts';

// ── Contract ─────────────────────────────────────────────────────────────────

export interface TrayUiCtx {
  /** The persistent candidate model (lib/design-system/tray.ts). */
  tray: Tray;
  /** One token per colour, through the Colours room's own addSwatch path.
   *  Returns how many swatches were actually added. */
  addColors: (entries: ColorEntry[]) => number;
  /** Present only where a Google face can actually be fetched. Absent → font
   *  candidates render without an Add. */
  installFont?: (family: string) => Promise<void>;
  /** A name candidate's Add - reinstalls the head document under that label. */
  setName?: (name: string) => Promise<void>;
  /** Fires on every open/close. The view uses it for the phone bottom edge's
   *  single-owner rule: two fixed bottom sheets must never coexist. */
  onOpenChange?: (open: boolean) => void;
  /** The control that opens the tray (the rail's toggle). Given one, the panel
   *  becomes a proper disclosure: the toggle gets `aria-controls`, and a close
   *  with focus still inside the panel hands it back here rather than dropping
   *  it on `<body>`. Optional so a test can mount without a view around it. */
  toggle?: HTMLElement;
}

export interface TrayUi {
  /** Show the panel - unless there is nothing pending, in which case this is a
   *  no-op (see the module note). `focus` moves focus into the panel and is for
   *  a deliberate press on the toggle; a scan that lands candidates while some
   *  other dialog is open must NOT steal focus, so it omits the flag. */
  open(opts?: { focus?: boolean }): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  /** Fold an expanded phone sheet back to peek, or close an open dock; true
   *  when the Escape was consumed here.
   *
   *  The dock closing is deliberate and is where this goes past "fold the
   *  sheet": on a desktop width there is no peek state to fall back to, and the
   *  house rule is that anything opened over the page closes on Escape. The
   *  return value is what the view's Escape stack reads either way, so a caller
   *  only ever asks "did the tray take that key?". */
  collapse(): boolean;
  /** Pending candidates - what the rail's toggle badges, and what decides
   *  whether the tray is worth advertising at all. */
  count(): number;
  /** The panel's element id, so the view can point its toggle's `aria-controls`
   *  at it even when the toggle was not handed over at mount. */
  readonly panelId: string;
  /** Re-read the model and repaint. Idempotent; the subscription calls it. */
  render(): void;
  teardown(): void;
}

/** What `trayHtml` may render an Add for. Both default to FALSE: a handler that
 *  was not passed is a handler that does not exist, and the button must not. */
export interface TrayHtmlOpts {
  /** `ctx.installFont` is present. */
  canInstallFont?: boolean;
  /** `ctx.setName` is present. */
  canSetName?: boolean;
}

// ── Pure render ──────────────────────────────────────────────────────────────

/** Group order, fixed. Not "most recent first": the tray is read as an
 *  inventory, and an inventory whose sections move is one nobody learns. */
const GROUP_ORDER: readonly CandidateType[] = ['color', 'font', 'logo', 'asset', 'name'];

const GROUP_LABEL: Record<CandidateType, () => string> = {
  color: () => t('Colours'),
  font: () => t('Type'),
  logo: () => t('Logos'),
  asset: () => t('Files'),
  name: () => t('Name'),
};

/** A colour renders as its own swatch, so only the other four need a glyph. */
const TYPE_ICON: Record<Exclude<CandidateType, 'color'>, IconName> = {
  font: 'font',
  logo: 'image',
  asset: 'package',
  name: 'tag',
};

/** Families we hold a fetchable source for. Lowercased once - a census reports a
 *  family as the source spelled it, and case is not identity here. */
const FETCHABLE = new Set(POPULAR_FAMILIES.map((f) => f.trim().toLowerCase()));

/** True when a Google face for this family can actually be fetched. Says
 *  nothing about whether the family exists elsewhere - see the copy on the
 *  unavailable line, which claims no more than this. */
export function isFetchableFamily(family: string): boolean {
  return FETCHABLE.has(String(family ?? '').trim().toLowerCase());
}

/** The Add button's label for a candidate, or null when it has no add path. */
function addLabel(c: Candidate, opts: TrayHtmlOpts): string | null {
  if (c.type === 'color') return t('Add');
  if (c.type === 'font') return opts.canInstallFont && isFetchableFamily(c.value) ? t('Install from Google') : null;
  if (c.type === 'name') return opts.canSetName ? t('Use this name') : null;
  return null; // logo / asset - no producer yet, so no control
}

/** The muted line under a candidate that cannot be added, or '' when it can.
 *  It reports what WE can reach, never what the world holds: a family we have no
 *  source for is not a family that is missing from Google. */
function unavailableLine(c: Candidate, opts: TrayHtmlOpts): string {
  if (c.type === 'font' && !isFetchableFamily(c.value)) {
    return `<span class="ds-tray-unavail">${t('No source we can fetch yet. The Type room takes the file.')}</span>`;
  }
  if (c.type === 'font' && !opts.canInstallFont) {
    return `<span class="ds-tray-unavail">${t('Fonts install in the Type room.')}</span>`;
  }
  return '';
}

function markHtml(c: Candidate): string {
  if (c.type === 'color') {
    return `<span class="ds-tray-dot" aria-hidden="true" style="background:${escape(c.value)}"></span>`;
  }
  return `<span class="ds-tray-ic" aria-hidden="true">${icon(TYPE_ICON[c.type])}</span>`;
}

/** The provenance chip. `detail` (a paint bucket, a font's role) rides as the
 *  title rather than a second line - it is a footnote, not a fact the row is
 *  about.
 *
 *  The title is written even without a detail, because the chip is clipped to
 *  16rem with an ellipsis and a provenance label is a FILE NAME: without it a
 *  long one is unrecoverable to a pointer user. It is a pointer affordance only,
 *  which is fine - CSS truncation hides nothing from a screen reader, so the
 *  full label is already in the accessibility tree as the chip's own text. */
function chipHtml(c: Candidate): string {
  const full = c.provenance.detail
    ? tRaw('{label} ({detail})', { label: c.provenance.label, detail: c.provenance.detail })
    : c.provenance.label;
  return `<span class="ds-tray-chip" title="${escape(full)}">${t('from {source}', { source: c.provenance.label })}</span>`;
}

function rowHtml(c: Candidate, opts: TrayHtmlOpts): string {
  const add = addLabel(c, opts);
  const label = c.type === 'color' ? nameColor(c.value) : (c.label ?? '');
  return `
    <li class="ds-tray-row" data-ds-tray-row="${escape(c.id)}">
      ${markHtml(c)}
      <span class="ds-tray-txt">
        <span class="ds-tray-val">${escape(c.value)}</span>
        <span class="ds-tray-meta">
          ${label ? `<span class="ds-tray-name">${escape(label)}</span>` : ''}
          ${chipHtml(c)}
          ${unavailableLine(c, opts)}
        </span>
      </span>
      <span class="ds-tray-acts">
        ${add ? `<button type="button" class="be-btn ds-tray-add" data-ds-tray-add="${escape(c.id)}">${add}</button>` : ''}
        <button type="button" class="ds-tray-x" data-ds-tray-dismiss="${escape(c.id)}"
          aria-label="${escape(tRaw('Dismiss {value}', { value: c.value }))}">${icon('close')}</button>
      </span>
    </li>`;
}

/**
 * The tray's candidate list as markup - pure, so the grouping, the escaping and
 * every "is there an Add here" decision are testable without a DOM (the
 * `overviewHtml` precedent).
 *
 * Renders the GROUPS only; the head, the count and the standing sub-line are the
 * mount's scaffold, because they do not change with the list. An empty list
 * renders '' - the mount closes the tray rather than showing an empty panel.
 */
export function trayHtml(pending: Candidate[], opts: TrayHtmlOpts = {}): string {
  let out = '';
  for (const type of GROUP_ORDER) {
    const rows = pending.filter((c) => c.type === type);
    if (rows.length === 0) continue; // empty groups are omitted, never rendered as "0"
    const addable = rows.filter((c) => addLabel(c, opts) !== null).length;
    const all = addable > 1
      ? `<button type="button" class="be-btn ds-tray-all" data-ds-tray-all="${escape(type)}">${t('Add all')}</button>`
      : '';
    out += `
      <section class="ds-tray-group" data-ds-tray-group="${escape(type)}">
        <div class="ds-tray-group-head">
          <h3 class="ds-tray-group-label">${GROUP_LABEL[type]()}<span class="ds-tray-group-n">${rows.length}</span></h3>
          ${all}
        </div>
        <ul class="ds-tray-rows" role="list">${rows.map((c) => rowHtml(c, opts)).join('')}</ul>
      </section>`;
  }
  return out;
}

// ── Mount ────────────────────────────────────────────────────────────────────

const SHEET_MQ = '(max-width: 640px)';
const SHEET_STATES = ['peek', 'half', 'full'] as const;

/** The panel's id - one tray per studio, so a constant is honest and lets the
 *  rail's toggle name it in `aria-controls`. */
const TRAY_PANEL_ID = 'ds-tray-panel';

/** What the grip's keyboard step just did. The sheet's size is not visible to a
 *  screen reader any other way: it lives in a CSS custom property and a data
 *  attribute on `.start`, neither of which is in the accessibility tree. */
const SHEET_STATE_SAID: Record<(typeof SHEET_STATES)[number], () => string> = {
  peek: () => t('Tray folded to a peek'),
  half: () => t('Tray half open'),
  full: () => t('Tray fully open'),
};

/**
 * Mount the tray into `shell` (the studio's `.start` element) and wire it.
 *
 * The panel starts CLOSED and hidden. Opening it is the caller's call - a press
 * on the rail's tray toggle, or a scan that just landed candidates in it.
 */
export function mountTrayUi(shell: HTMLElement, ctx: TrayUiCtx): TrayUi {
  const opts: TrayHtmlOpts = { canInstallFont: !!ctx.installFont, canSetName: !!ctx.setName };

  const trayEl = shell.ownerDocument.createElement('aside');
  trayEl.className = 'ds-tray';
  trayEl.id = TRAY_PANEL_ID;
  trayEl.setAttribute('role', 'region');
  trayEl.setAttribute('aria-label', t('Tray'));
  trayEl.hidden = true;
  // Sink 1 of 2: the scaffold. Every interpolation is a t() literal or an icon()
  // constant; the candidate list goes to the second sink through trayHtml().
  trayEl.innerHTML = `
    <div class="ds-tray-head">
      <span class="ds-tray-title">${t('Tray')}</span>
      <span class="ds-tray-count" data-ds-tray-count></span>
      <button type="button" class="ds-tray-x ds-tray-close" data-ds-tray-close
        aria-label="${escape(t('Close the tray'))}">${icon('close')}</button>
    </div>
    <div class="ds-tray-body">
      <p class="ds-tray-sub">${t('Found in the sources scanned here. Nothing joins the design system until you add it.')}</p>
      <div class="ds-tray-groups" data-ds-tray-groups></div>
    </div>`;

  const gripEl = shell.ownerDocument.createElement('button');
  gripEl.type = 'button';
  gripEl.className = 'ds-tray-grip';
  // Names the JOB, not the gesture: the same control is dragged by a finger and
  // stepped by Enter, and a label that only described the pointer left the
  // keyboard behaviour undescribed. The size it lands on is announced instead of
  // being promised in the name, because the step bounces at the ends.
  gripEl.setAttribute('aria-label', t('Resize the tray'));
  gripEl.hidden = true;

  shell.append(trayEl, gripEl);
  // The disclosure pair. DOM adjacency is impossible here (the dock is appended
  // last, on purpose), so the relationship has to be programmatic.
  ctx.toggle?.setAttribute('aria-controls', TRAY_PANEL_ID);

  const countEl = trayEl.querySelector<HTMLElement>('[data-ds-tray-count]');
  const groupsEl = trayEl.querySelector<HTMLElement>('[data-ds-tray-groups]');

  // The same query the sheet driver gates its own drags on, read here so the
  // driver is only ATTACHED where it can do anything (mountPaletteSheet's
  // precedent, and the reason a desktop dock carries no pointer handlers).
  const mql = window.matchMedia(SHEET_MQ);
  let handle: MobileSheetHandle | null = null;
  let open = false;
  let alive = true;

  const pending = (): Candidate[] => ctx.tray.list().filter((c) => c.state === 'pending');
  const byId = (id: string): Candidate | null => pending().find((c) => c.id === id) ?? null;

  // ── Sheet driver (phones only) ─────────────────────────────────────────────
  // Attached while the tray is open AND the query matches, so a desktop dock
  // never carries drag handlers and a resize into the phone width picks them up.
  function syncSheet(): void {
    const want = open && mql.matches;
    if (want && !handle) {
      handle = setupMobileSheet(shell, trayEl, gripEl, {
        anchor: 'bottom',
        initial: 'half',
        mq: SHEET_MQ,
        names: {
          heightVar: '--ds-tray-h',
          stateAttr: 'data-ds-tray-sheet',
          peekVar: '--ds-tray-peek-h',
          draggingClass: 'is-ds-tray-dragging',
          headerSel: '.ds-tray-head',
        },
      });
    } else if (!want && handle) {
      handle.teardown();
      handle = null;
    }
  }

  // ── Focus, across a repaint that destroys the button you pressed ───────────

  /** Which control had focus in the list, as something that survives the DOM
   *  it was read from: what KIND of action, which candidate, and where its row
   *  sat - so a row that has left the tray can hand focus to its successor
   *  instead of to `<body>`. */
  interface FocusMemo { attr: string; id: string; row: number }

  const ACT_ATTR = ['data-ds-tray-add', 'data-ds-tray-dismiss', 'data-ds-tray-all'] as const;
  const actId = (el: HTMLElement): string =>
    el.dataset.dsTrayAdd ?? el.dataset.dsTrayDismiss ?? el.dataset.dsTrayAll ?? '';

  function focusMemo(): FocusMemo | null {
    const el = trayEl.ownerDocument.activeElement as HTMLElement | null;
    if (!el || !groupsEl?.contains(el)) return null;
    const btn = el.closest<HTMLElement>(ACT_ATTR.map(a => `[${a}]`).join(','));
    if (!btn) return null;
    const attr = ACT_ATTR.find(a => btn.hasAttribute(a));
    if (!attr) return null;
    const rows = [...groupsEl.querySelectorAll<HTMLElement>('.ds-tray-row')];
    return { attr, id: actId(btn), row: rows.indexOf(btn.closest<HTMLElement>('.ds-tray-row')!) };
  }

  function restoreFocus(memo: FocusMemo): void {
    if (!groupsEl) return;
    const same = [...groupsEl.querySelectorAll<HTMLElement>(`[${memo.attr}]`)].find(el => actId(el) === memo.id);
    if (same) { same.focus(); return; }
    // Its row is gone (added or dismissed): the row that took its place, or the
    // last one left. Dismiss is the fallback control because every row has one.
    const rows = [...groupsEl.querySelectorAll<HTMLElement>('.ds-tray-row')];
    const row = rows[Math.min(Math.max(memo.row, 0), rows.length - 1)];
    const next = row?.querySelector<HTMLElement>(`[${memo.attr}]`)
      ?? row?.querySelector<HTMLElement>('[data-ds-tray-dismiss]')
      ?? trayEl.querySelector<HTMLElement>('[data-ds-tray-close]');
    next?.focus();
  }

  /** Usable as a focus target: still in the document and not inside anything
   *  hidden (the rail's toggle hides itself the moment the tray empties). */
  const focusable = (el: HTMLElement | null | undefined): HTMLElement | null =>
    el && el.isConnected && !el.closest('[hidden]') ? el : null;

  /** Where focus goes back to when the panel closes. Set only by an open that
   *  TOOK focus, so a scan-driven open never moves it on the way out either. */
  let returnFocus: HTMLElement | null = null;

  function focusIn(): void {
    // Duck-typed, not `instanceof HTMLElement`: the constructor is a property of
    // the document's own window, and this module is mounted under jsdom too.
    // `<body>` is not a return target - it is where focus goes when there isn't
    // one, so remembering it would just re-drop focus on close.
    const active = trayEl.ownerDocument.activeElement as HTMLElement | null;
    returnFocus = active && active !== trayEl.ownerDocument.body && typeof active.focus === 'function' ? active : null;
    const first = trayEl.querySelector<HTMLElement>('[data-ds-tray-add]')
      ?? trayEl.querySelector<HTMLElement>('[data-ds-tray-dismiss]')
      ?? trayEl.querySelector<HTMLElement>('[data-ds-tray-close]');
    first?.focus();
  }

  function focusOut(): void {
    const doc = trayEl.ownerDocument;
    const active = doc.activeElement as HTMLElement | null;
    // Only a panel that HAS focus hands it back. Someone who opened the tray,
    // clicked into the studio and then pressed Escape is working somewhere else
    // - pulling them to the toggle would be the tray taking focus, not
    // returning it. `<body>` counts as inside: that is where the repaint just
    // dropped it when the last row left.
    const wasInside = !active || active === doc.body || trayEl.contains(active) || gripEl.contains(active);
    const back = wasInside ? (focusable(returnFocus) ?? focusable(ctx.toggle)) : null;
    returnFocus = null;
    back?.focus();
  }

  function render(): void {
    if (!alive) return;
    const list = pending();
    if (countEl) countEl.textContent = tRaw('{n} kept', { n: list.length });
    const memo = focusMemo();
    // Sink 2 of 2: the candidate list, from the pure trayHtml().
    if (groupsEl) groupsEl.innerHTML = trayHtml(list, opts);
    if (open && list.length === 0) { setOpen(false); return; }
    if (memo) restoreFocus(memo);
    handle?.refresh(); // the head's height can change with the count - re-measure
  }

  function setOpen(next: boolean): void {
    if (next === open) return;
    open = next;
    trayEl.hidden = !open;
    gripEl.hidden = !open;
    syncSheet();
    // The view resyncs its toggle here, so a focus return that lands on it must
    // happen AFTER - an empty tray hides that toggle, and focusing an element
    // one line before it is hidden is the same as focusing nothing.
    ctx.onOpenChange?.(open);
    if (!open) focusOut();
  }

  // ── Adds ───────────────────────────────────────────────────────────────────

  /** Commit one candidate through the room that owns its material. Returns
   *  false when there is no path for it, or the path failed - a failure leaves
   *  the candidate PENDING, so nothing is silently lost. */
  async function addOne(c: Candidate | null): Promise<boolean> {
    if (!c) return false;
    // A refusal is as loud as a failure. A press that reports nothing added is
    // the same experience as a dead button, and the button is still there
    // afterwards (the candidate stays pending) - so say so, once, here, rather
    // than leaving the caller to guess which of its own paths went quiet.
    const failed = (): false => {
      announce(tRaw('{value} could not be added.', { value: c.value }));
      return false;
    };
    try {
      if (c.type === 'color') {
        // One entry per call: one add is one token, and the Colours room's own
        // path is what decides what that token is called and where it lands.
        if (ctx.addColors([{ value: c.value, hex: c.value }]) < 1) return failed();
      } else if (c.type === 'font') {
        if (!ctx.installFont || !isFetchableFamily(c.value)) return failed();
        await ctx.installFont(c.value);
      } else if (c.type === 'name') {
        if (!ctx.setName) return failed();
        await ctx.setName(c.value);
      } else {
        return false; // logo / asset - no producer, and no Add button to press
      }
    } catch {
      return failed();
    }
    await ctx.tray.markAdded(c.id);
    return true;
  }

  /** "Add all" is n separate adds, not a batch: the per-candidate invariant has
   *  to hold for every one of them, and a failure part-way must not roll the
   *  successful ones back out of the design system. */
  async function addAll(type: CandidateType): Promise<void> {
    const list = pending().filter((c) => c.type === type);
    let n = 0;
    for (const c of list) if (await addOne(c)) n++;
    if (n > 0) announce(tRaw('{n} added to the design system', { n }));
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  const onClick = (e: Event): void => {
    const target = e.target as HTMLElement;

    if (target.closest('[data-ds-tray-close]')) { setOpen(false); return; }

    const dismiss = target.closest<HTMLElement>('[data-ds-tray-dismiss]')?.dataset.dsTrayDismiss;
    if (dismiss) { void ctx.tray.dismiss(dismiss); return; }

    const add = target.closest<HTMLElement>('[data-ds-tray-add]')?.dataset.dsTrayAdd;
    if (add) {
      const c = byId(add);
      void addOne(c).then((ok) => {
        if (ok && c) announce(tRaw('{value} added to the design system', { value: c.value }));
      });
      return;
    }

    const all = target.closest<HTMLElement>('[data-ds-tray-all]')?.dataset.dsTrayAll;
    if (all) void addAll(all as CandidateType);
  };

  // The sheet driver's grip handling is pointer-only, so keyboard activation
  // (Enter/Space - a click with detail 0 and no pointer sequence) would do
  // nothing on a focusable button. Step through the stops with the same bounce
  // as a tap; real pointer taps (detail ≥ 1) already went through pointerup.
  let keyDir: 1 | -1 = 1;
  const onGripClick = (e: MouseEvent): void => {
    if (e.detail !== 0 || !handle) return;
    const idx = Math.max(0, SHEET_STATES.indexOf(handle.state()));
    if (idx === 0) keyDir = 1;
    else if (idx === SHEET_STATES.length - 1) keyDir = -1;
    const next = SHEET_STATES[idx + keyDir]!;
    handle.setState(next);
    // Which way the bounce went is only knowable from the result, so report the
    // result. The name promises a resize; this says which one landed.
    announce(SHEET_STATE_SAID[next]());
  };

  const onMqChange = (): void => { syncSheet(); handle?.refresh(); };

  trayEl.addEventListener('click', onClick);
  gripEl.addEventListener('click', onGripClick);
  mql.addEventListener('change', onMqChange);
  const unsubscribe = ctx.tray.subscribe(render);

  render();

  function openPanel(o: { focus?: boolean } = {}): void {
    render();
    // render()'s own self-close guard only fires on an ALREADY-open tray, so
    // the empty case has to be refused here too: a rescan whose candidates were
    // all added before returns 0 new ones, and raising a panel reading "0 kept"
    // - whose toggle the view hides in the same tick - is exactly the empty
    // concept section 9 rules out.
    if (pending().length === 0) return;
    setOpen(true);
    if (o.focus) focusIn();
  }

  return {
    open: openPanel,
    close: () => setOpen(false),
    toggle: () => { if (open) setOpen(false); else openPanel({ focus: true }); },
    isOpen: () => open,
    panelId: TRAY_PANEL_ID,
    collapse: () => {
      if (!open) return false;
      if (mql.matches && handle) {
        if (handle.state() === 'peek') return false; // already as small as it goes
        handle.setState('peek');
        return true;
      }
      setOpen(false);
      return true;
    },
    count: () => pending().length,
    render,
    teardown: () => {
      alive = false;
      returnFocus = null;
      ctx.toggle?.removeAttribute('aria-controls'); // the panel it names is going
      unsubscribe();
      trayEl.removeEventListener('click', onClick);
      gripEl.removeEventListener('click', onGripClick);
      mql.removeEventListener('change', onMqChange);
      handle?.teardown();
      handle = null;
      trayEl.remove();
      gripEl.remove();
    },
  };
}

/** Spelling alias - the studio's other mounts are `mountX`, and both spellings
 *  of this one appear in plan 97. Same function, no second implementation. */
export const mountTrayUI = mountTrayUi;
