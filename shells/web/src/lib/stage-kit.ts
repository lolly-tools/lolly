// SPDX-License-Identifier: MPL-2.0
/**
 * The stage kit: one layer the shell owns on the tool stage, holding a tool's own
 * controls at screen size, beside the picture, in Lolly's look (plan 368, W1a).
 *
 * Why it exists. A tool that draws its controls in its template draws them inside the
 * scaled artboard: on a phone a 44 px button is drawn at a quarter of that, and a stage
 * zoom carries it off the screen. The kit is a child of the stage, a sibling of
 * `#tool-canvas-outer` and never inside `#tool-canvas`, so neither the fit nor the stage
 * zoom scales it and no export reads it (`data-export-hide`, `data-live-hide`).
 *
 * The contract:
 *  - `setBar(groups)` draws groups of actions and pills. A second call updates the
 *    buttons it already has, in place, so keyboard focus stays on the same action.
 *  - `setStatus(text)` shows one sentence in a polite live region next to the bar.
 *    Empty text takes no space.
 *  - The bar asks the fit for a band of the stage: the top on a wide screen, the foot
 *    above the Export pill on a phone (`--stage-reserve-top` / `-bottom`, written inline
 *    on the stage as the deck editor and the Design top bar do). When that band appears,
 *    changes height or goes, the canvas gets `canvas-resize` and the fit runs again.
 *  - Presses on the kit belong to the kit (`data-stage-gestures="own"`): the stage
 *    neither pans nor pinches under them, and a finger can scroll a phone bar sideways.
 *  - `layer()` hands out one element over the whole stage, under the bar, made on first
 *    request: a tool draws handles on its picture there, at screen size, from points it
 *    measures itself. The layer takes no press; the handles in it do, and the stage
 *    leaves their presses alone too.
 *
 * Nothing here knows a particular tool. 3D Studio builds its groups in
 * lib/studio3d/toolbar.ts; controls a manifest declares will be drawn the same way.
 * The look lives in styles/parts/stage-kit.css, which the tool view loads.
 */
import { mountBodyPopover, type BodyPopoverHandle } from '../components/body-popover.ts';
import { iconNode } from './icon-node.ts';
import type { IconName } from './icons.ts';
import { isPhoneLayout, onLayoutChange } from './layout-posture.ts';
import { STAGE_GESTURES_ATTR } from './stage-gestures.ts';

/** A press that runs something, opens a menu, or opens a small panel. */
export interface StageKitAction {
  kind?: 'action';
  /** Stable within the kit: the key that keeps a button, and its focus, across setBar. */
  id: string;
  /** The accessible name, and the visible label where the bar has room for one. */
  label: string;
  /** The label on a phone, under eight characters. Absent: the phone shows the icon only. */
  shortLabel?: string;
  icon: IconName;
  /** A mode or a toggle: written as aria-pressed. Leave undefined for a plain action. */
  pressed?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  /** Help shown in the shell tooltip. Without it, an icon-only button shows its label. */
  title?: string;
  /** Extra `data-*` attributes, named without the prefix: `{ 'studio-fit': '' }`. */
  data?: Readonly<Record<string, string>>;
  onPress?: (button: HTMLButtonElement) => void;
  /** A list of choices, opened under (or over) the button. Read on each open. */
  menu?: () => StageKitMenuItem[];
  /** A small panel of text or controls, opened like the menu. */
  panel?: { label: string; render: (el: HTMLElement) => void };
}

/** A short piece of text in the bar: the selected object, the current item. */
export interface StageKitPill {
  kind: 'pill';
  id: string;
  text: string;
  hidden?: boolean;
  data?: Readonly<Record<string, string>>;
}

export type StageKitItem = StageKitAction | StageKitPill;

export interface StageKitGroup {
  id: string;
  /** The group's accessible name. */
  label: string;
  items: readonly StageKitItem[];
  /** Mode buttons that read as one segmented control. */
  segmented?: boolean;
  /** On a phone the group shows icons only, whatever its short labels say. */
  phoneIcons?: boolean;
  /**
   * When the bar is too wide for its labels, groups give theirs up in this order, lowest
   * first. Unset: from the last group forward, segmented modes last.
   */
  collapse?: number;
  hidden?: boolean;
  /**
   * The group stands by the thing it acts on, not in the bar: a small bar of icons the
   * tool places with `placeFloat`. On a phone there is no room by the picture, so the
   * group stays in the bar there.
   */
  float?: boolean;
}

export interface StageKitMenuItem {
  id: string;
  label: string;
  /** Marks the current choice (role="menuitemradio"). */
  checked?: boolean;
  onPress(): void;
}

/** What a tool's code may call. The tool view owns the rest of the kit. */
export interface StageKitPort {
  setBar(groups: readonly StageKitGroup[]): void;
  setStatus(text: string): void;
  /**
   * The handle layer: the whole stage, under the bar and the zoom control, out of every
   * capture. Optional so a port that draws no picture (a test's) can leave it out.
   */
  layer?(): HTMLElement;
  /**
   * Put a floating group (`StageKitGroup.float`) with its top centre at a point on the
   * stage, in the handle layer's pixels, or hide the group with null.
   */
  placeFloat?(id: string, at: { x: number; y: number } | null): void;
}

export interface StageKit extends StageKitPort {
  readonly element: HTMLElement;
  layer(): HTMLElement;
  placeFloat(id: string, at: { x: number; y: number } | null): void;
  /** Measure again: placement, label density and the reserved band. */
  layout(): void;
  dispose(): void;
}

export interface StageKitOptions {
  /** The canvas whose fit the band changes. It receives `canvas-resize`. */
  canvas?: HTMLElement | null;
  /** The phone layout test. Defaults to the shell's own (lib/layout-posture.ts). */
  phone?: () => boolean;
  /** The toolbar's accessible name. */
  label?: string;
}

const RESERVE_TOP = '--stage-reserve-top';
const RESERVE_BOTTOM = '--stage-reserve-bottom';
/** Space between the bar and a stage edge it shares with the floating zoom control. */
const HUD_GAP = 12;

const isPill = (item: StageKitItem): item is StageKitPill => item.kind === 'pill';

function setData(el: HTMLElement, data: Readonly<Record<string, string>> | undefined): void {
  for (const [key, value] of Object.entries(data ?? {})) {
    if (/^[a-z][a-z0-9-]*$/.test(key)) el.setAttribute(`data-${key}`, value);
  }
}

function setHidden(el: HTMLElement, hidden: boolean): void {
  if (el.hidden !== hidden) el.hidden = hidden;
}

export function mountStageKit(stage: HTMLElement, opts: StageKitOptions = {}): StageKit {
  const doc = stage.ownerDocument;
  const phone = opts.phone ?? isPhoneLayout;
  const styleOf = (el: Element): CSSStyleDeclaration => doc.defaultView!.getComputedStyle(el);
  const root = doc.createElement('div');
  root.className = 'stage-kit';
  root.hidden = true;
  // Out of every capture, out of every live take, and out of the canvas key verbs.
  root.setAttribute('data-export-hide', '');
  root.setAttribute('data-live-hide', '');
  root.setAttribute('data-canvas-keys', 'off');
  root.setAttribute(STAGE_GESTURES_ATTR, 'own');
  const bar = doc.createElement('div');
  bar.className = 'stage-kit-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', opts.label ?? 'Canvas controls');
  const status = doc.createElement('p');
  status.className = 'stage-kit-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('data-stage-status', '');
  status.hidden = true;
  root.append(bar, status);
  stage.appendChild(root);

  /** The handle layer, made on the first call to layer(). */
  let handleLayer: HTMLElement | null = null;
  function layer(): HTMLElement {
    if (handleLayer) return handleLayer;
    const el = doc.createElement('div');
    el.className = 'stage-kit-layer';
    el.setAttribute('data-export-hide', '');
    el.setAttribute('data-live-hide', '');
    el.setAttribute('data-canvas-keys', 'off');
    el.setAttribute(STAGE_GESTURES_ATTR, 'own');
    // The handles repeat what the bar and the keys already offer, so a screen reader is
    // not walked through them.
    el.setAttribute('aria-hidden', 'true');
    // A kit that has gone hands back a layer that is never shown.
    if (disposed) return el;
    // Before the bar's layer, so the bar draws over a handle that runs under the band.
    stage.insertBefore(el, root);
    handleLayer = el;
    return el;
  }

  /**
   * The hosts of floating groups, one for each group, direct children of the stage. They
   * are not in the handle layer, which is hidden from assistive technology: these hold
   * real buttons.
   */
  const floatHosts = new Map<string, HTMLElement>();
  function floatHost(id: string): HTMLElement {
    let host = floatHosts.get(id);
    if (!host) {
      host = doc.createElement('div');
      host.className = 'stage-kit-float';
      host.dataset.kitFloat = id;
      host.setAttribute('data-export-hide', '');
      host.setAttribute('data-live-hide', '');
      host.setAttribute(STAGE_GESTURES_ATTR, 'own');
      host.hidden = true;
      stage.insertBefore(host, root);
      floatHosts.set(id, host);
    }
    return host;
  }
  function placeFloat(id: string, at: { x: number; y: number } | null): void {
    const host = floatHosts.get(id);
    if (!host || disposed) return;
    const group = groupEls.get(id);
    const show = !!at && !!group && group.parentElement === host && !group.hidden;
    if (host.hidden === show) host.hidden = !show;
    if (!show || !at) return;
    // Kept on the stage: the group's centre never comes closer to an edge than half its width.
    const half = host.offsetWidth / 2;
    const x = Math.max(half + 8, Math.min(stage.clientWidth - half - 8, at.x));
    const value = `translate(${Math.round(x - half)}px, ${Math.round(at.y)}px)`;
    if (host.style.transform !== value) host.style.transform = value;
  }

  const groupEls = new Map<string, HTMLElement>();
  const buttons = new Map<string, HTMLButtonElement>();
  const pills = new Map<string, HTMLElement>();
  const actions = new Map<string, StageKitAction>();
  /** The action id that holds the toolbar's one tab stop. */
  let current: string | null = null;
  let popover: { id: string; handle: BodyPopoverHandle } | null = null;
  let disposed = false;
  // What the stage carried before the kit asked for room, so dispose puts it back.
  const prior = {
    top: stage.style.getPropertyValue(RESERVE_TOP),
    bottom: stage.style.getPropertyValue(RESERVE_BOTTOM),
  };
  let lastReserve = { top: prior.top, bottom: prior.bottom };

  const visibleActions = (): HTMLButtonElement[] =>
    [...bar.querySelectorAll<HTMLButtonElement>('button.stage-kit-btn')].filter(
      (b) => !b.hidden && !b.disabled && !(b.closest('.stage-kit-group') as HTMLElement | null)?.hidden
    );

  /** One tab stop for the whole bar; the arrow keys walk it (the toolbar pattern). */
  function syncTabStops(): void {
    const live = visibleActions();
    const stop = live.find((b) => b.dataset.kitAction === current) ?? live[0];
    for (const b of bar.querySelectorAll<HTMLButtonElement>('button.stage-kit-btn')) {
      b.tabIndex = b === stop ? 0 : -1;
    }
  }

  /**
   * A button that loses focus to nothing (it was disabled while its action reloads the
   * tool, or the node moved) takes focus back when it is usable again, so a keyboard
   * person stays on the action they pressed. Focus moved anywhere else is left there.
   */
  let refocus: { id: string; at: number } | null = null;
  bar.addEventListener('focusout', (e) => {
    const id = (e.target as HTMLElement | null)?.dataset?.kitAction;
    refocus = id && !e.relatedTarget ? { id, at: Date.now() } : null;
  });
  function restoreFocus(): void {
    if (!refocus) return;
    const active = doc.activeElement;
    if (Date.now() - refocus.at > 2000 || (active && active !== doc.body && !bar.contains(active))) {
      refocus = null;
      return;
    }
    const b = buttons.get(refocus.id);
    if (!b || b.disabled || b.hidden || bar.contains(active)) return;
    refocus = null;
    b.focus({ preventScroll: true });
  }

  bar.addEventListener('focusin', (e) => {
    const b = (e.target as Element | null)?.closest?.<HTMLButtonElement>('button.stage-kit-btn');
    if (!b) return;
    current = b.dataset.kitAction ?? null;
    syncTabStops();
  });
  bar.addEventListener('keydown', (e) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    const live = visibleActions();
    if (!live.length) return;
    const at = live.indexOf(doc.activeElement as HTMLButtonElement);
    const rtl = styleOf(bar).direction === 'rtl';
    const forward = e.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
    const next =
      e.key === 'Home' ? 0
      : e.key === 'End' ? live.length - 1
      : (at + (forward ? 1 : -1) + live.length) % live.length;
    e.preventDefault();
    e.stopPropagation();
    live[next]!.focus();
    live[next]!.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  });

  function openPopover(action: StageKitAction, button: HTMLButtonElement): void {
    if (popover?.id === action.id && popover.handle.isOpen()) {
      popover.handle.close(true);
      return;
    }
    popover?.handle.close();
    // The button's tooltip would sit beside the panel and take the first Escape, so it
    // goes, and stays off while the panel is open (lib/tooltips.ts).
    button.setAttribute('data-tooltip', 'off');
    doc.dispatchEvent(new Event('lolly:tooltip-toast'));
    const tipBack = (): void => button.removeAttribute('data-tooltip');
    const handle = mountBodyPopover(
      button,
      (el, pop) => {
        if (action.panel) {
          action.panel.render(el);
          return null;
        }
        let first: HTMLElement | null = null;
        for (const item of action.menu?.() ?? []) {
          const row = doc.createElement('button');
          row.type = 'button';
          row.className = 'profile-menu-item stage-kit-menu-item';
          row.setAttribute('role', 'menuitemradio');
          row.setAttribute('aria-checked', String(!!item.checked));
          row.dataset.kitMenuItem = item.id;
          const text = doc.createElement('span');
          text.textContent = item.label;
          row.append(text);
          if (item.checked) {
            const mark = iconNode('check', doc);
            if (mark) row.append(mark);
          }
          row.addEventListener('click', () => {
            pop.close(true);
            item.onPress();
          });
          el.append(row);
          if (!first || item.checked) first = row;
        }
        return first;
      },
      action.panel
        ? { className: 'profile-menu stage-kit-panel', role: 'dialog', ariaLabel: action.panel.label, trackSize: true, onClose: tipBack }
        : { className: 'profile-menu stage-kit-menu', role: 'menu', ariaLabel: action.label, menuNavigation: true, onClose: tipBack },
    );
    popover = { id: action.id, handle };
    handle.open();
  }

  function makeButton(action: StageKitAction): HTMLButtonElement {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'stage-kit-btn';
    b.dataset.kitAction = action.id;
    const label = doc.createElement('span');
    label.className = 'stage-kit-label';
    const short = doc.createElement('span');
    short.className = 'stage-kit-short';
    b.append(label, short);
    b.addEventListener('click', () => {
      const live = actions.get(b.dataset.kitAction ?? '');
      if (!live || b.disabled || b.hidden) return;
      if (live.menu || live.panel) openPopover(live, b);
      else live.onPress?.(b);
    });
    return b;
  }

  function updateButton(b: HTMLButtonElement, action: StageKitAction): void {
    actions.set(action.id, action);
    if (b.dataset.kitIcon !== action.icon) {
      b.querySelector(':scope > svg')?.remove();
      const glyph = iconNode(action.icon, doc);
      if (glyph) b.prepend(glyph);
      b.dataset.kitIcon = action.icon;
    }
    const [label, short] = [b.querySelector<HTMLElement>('.stage-kit-label')!, b.querySelector<HTMLElement>('.stage-kit-short')!];
    if (label.textContent !== action.label) label.textContent = action.label;
    const shortText = action.shortLabel ?? '';
    if (short.textContent !== shortText) short.textContent = shortText;
    b.toggleAttribute('data-kit-short', !!shortText);
    if (b.getAttribute('aria-label') !== action.label) b.setAttribute('aria-label', action.label);
    if (action.pressed === undefined) b.removeAttribute('aria-pressed');
    else b.setAttribute('aria-pressed', String(action.pressed));
    if (action.menu) b.setAttribute('aria-haspopup', 'menu');
    else if (action.panel) b.setAttribute('aria-haspopup', 'dialog');
    else b.removeAttribute('aria-haspopup');
    if (action.title) b.dataset.kitTitle = action.title;
    else delete b.dataset.kitTitle;
    b.disabled = !!action.disabled;
    setHidden(b, !!action.hidden);
    setData(b, action.data);
  }

  function updatePill(el: HTMLElement, pill: StageKitPill): void {
    if (el.textContent !== pill.text) el.textContent = pill.text;
    setHidden(el, !!pill.hidden || !pill.text);
    setData(el, pill.data);
  }

  /** Put `child` at position `index` of `parent` without moving a node that is already there. */
  function place(parent: HTMLElement, child: HTMLElement, index: number): void {
    if (parent.children[index] === child) return;
    const focused = child.contains(doc.activeElement) ? (doc.activeElement as HTMLElement) : null;
    parent.insertBefore(child, parent.children[index] ?? null);
    focused?.focus({ preventScroll: true });
  }

  function setBar(next: readonly StageKitGroup[]): void {
    if (disposed) return;
    const seenGroups = new Set<string>();
    const seenItems = new Set<string>();
    let slot = 0;
    for (const group of next) {
      seenGroups.add(group.id);
      let el = groupEls.get(group.id);
      if (!el) {
        el = doc.createElement('div');
        el.className = 'stage-kit-group';
        el.setAttribute('role', 'group');
        el.dataset.kitGroup = group.id;
        // The items sit in their own row so a segmented group's track is drawn round the
        // buttons only, and the rule between groups stays outside the track.
        const row = doc.createElement('div');
        row.className = 'stage-kit-items';
        el.append(row);
        groupEls.set(group.id, el);
      }
      if (el.getAttribute('aria-label') !== group.label) el.setAttribute('aria-label', group.label);
      el.toggleAttribute('data-segmented', !!group.segmented);
      el.toggleAttribute('data-phone-icons', !!group.phoneIcons);
      if (group.collapse === undefined) delete el.dataset.kitCollapse;
      else el.dataset.kitCollapse = String(group.collapse);
      // A floating group stands by the selection where there is room for one; on a
      // phone the group is one more group of the bar.
      const floats = !!group.float && root.dataset.placement !== 'foot';
      el.toggleAttribute('data-float', floats);
      if (floats) {
        const host = floatHost(group.id);
        if (el.parentElement !== host) host.append(el);
      } else place(bar, el, slot++);
      const row = el.firstElementChild as HTMLElement;
      let index = 0;
      for (const item of group.items) {
        seenItems.add(item.id);
        if (isPill(item)) {
          let pill = pills.get(item.id);
          if (!pill) {
            pill = doc.createElement('span');
            pill.className = 'stage-kit-pill';
            pill.dataset.kitItem = item.id;
            pills.set(item.id, pill);
          }
          updatePill(pill, item);
          place(row, pill, index++);
        } else {
          let b = buttons.get(item.id);
          if (!b) {
            b = makeButton(item);
            buttons.set(item.id, b);
          }
          updateButton(b, item);
          place(row, b, index++);
        }
      }
      while (row.children.length > index) row.lastElementChild!.remove();
      // The bar has one tab stop and walks its buttons with the arrow keys, so a button
      // that came from the bar may hold tabindex -1. By the selection each one is a stop.
      if (floats) for (const b of row.querySelectorAll<HTMLButtonElement>('button.stage-kit-btn')) b.tabIndex = 0;
      const empty = group.items.every((item) => item.hidden || (isPill(item) && !item.text));
      setHidden(el, !!group.hidden || empty);
    }
    while (bar.children.length > slot) bar.lastElementChild!.remove();
    for (const [id, el] of groupEls) if (!seenGroups.has(id)) { el.remove(); groupEls.delete(id); }
    // A host whose group left (the group went, or went back into the bar) goes too.
    for (const [id, host] of floatHosts) if (!host.firstElementChild) { host.remove(); floatHosts.delete(id); }
    for (const [id, b] of buttons) if (!seenItems.has(id)) { b.remove(); buttons.delete(id); actions.delete(id); }
    for (const [id, el] of pills) if (!seenItems.has(id)) { el.remove(); pills.delete(id); }
    if (popover && !actions.has(popover.id)) popover.handle.close();
    // The rule between groups is drawn before every visible group but the first.
    const lead = [...groupEls.values()].find((el) => !el.hidden && el.parentElement === bar);
    for (const el of groupEls.values()) el.toggleAttribute('data-kit-lead', el === lead);
    const barShown = [...groupEls.values()].some((el) => !el.hidden);
    const statusEmpty = !status.textContent;
    status.toggleAttribute('data-empty', statusEmpty);
    setHidden(status, statusEmpty && !barShown);
    setHidden(root, !barShown && statusEmpty);
    syncTabStops();
    restoreFocus();
    layout();
  }

  function setStatus(text: string): void {
    if (disposed) return;
    const value = text.trim();
    if (status.textContent !== value) status.textContent = value;
    // With a bar on show the line keeps its row whether it has words or not, so the band
    // the kit reserves has one height and the picture stays still when a mode changes.
    // The stylesheet hides an empty line from view; with no bar an empty line is removed.
    const barShown = [...groupEls.values()].some((el) => !el.hidden);
    status.toggleAttribute('data-empty', !value);
    setHidden(status, !value && !barShown);
    setHidden(root, !barShown && !value);
    reserve();
  }

  /** Is the button's text on screen? The same rules stage-kit.css draws with. */
  function labelShown(b: HTMLButtonElement): boolean {
    const group = b.closest<HTMLElement>('.stage-kit-group');
    if (root.dataset.placement === 'foot') return b.hasAttribute('data-kit-short') && !group?.hasAttribute('data-phone-icons');
    return !group?.hasAttribute('data-compact');
  }

  /** Tooltips: a labelled button needs none unless it has help; an icon-only one shows its name. */
  function syncTips(): void {
    for (const b of buttons.values()) {
      const tip = b.dataset.kitTitle ?? (labelShown(b) ? '' : b.getAttribute('aria-label') ?? '');
      if (tip) b.dataset.tip = tip;
      else delete b.dataset.tip;
    }
  }

  /**
   * Labels where they fit. On a wide screen every group starts with labels, and when the
   * bar would overflow the groups give theirs up one at a time, from the last group
   * forward, the segmented modes last of all. A phone shows short labels and scrolls.
   */
  function fitLabels(): void {
    // A floating group is always icons: there is no room for words by the selection.
    for (const el of groupEls.values()) el.toggleAttribute('data-compact', el.hasAttribute('data-float'));
    if (root.dataset.placement === 'foot' || root.hidden) return;
    const shown = ([...bar.children] as HTMLElement[]).filter((el) => !el.hidden).reverse();
    const rank = (el: HTMLElement): number =>
      el.dataset.kitCollapse !== undefined ? Number(el.dataset.kitCollapse) : el.hasAttribute('data-segmented') ? 1000 : 500;
    // A stable sort keeps the last-group-first order among equal ranks.
    const order = shown.map((el, i) => ({ el, i })).sort((a, b) => rank(a.el) - rank(b.el) || a.i - b.i).map(({ el }) => el);
    for (const el of order) {
      if (bar.scrollWidth <= bar.clientWidth + 1) break;
      el.setAttribute('data-compact', '');
    }
  }

  /**
   * Keep the centred bar off the floating zoom control at the top of a wide stage: the
   * side padding is the control's width plus a gap, on both sides, so the bar stays
   * centred over the picture.
   */
  function clearHud(): void {
    let side = 0;
    if (root.dataset.placement === 'top') {
      const hud = stage.querySelector<HTMLElement>(':scope > .stage-nav:not([data-docked])');
      const sr = stage.getBoundingClientRect();
      const hr = hud?.getBoundingClientRect();
      // Only a control in the top band, the one the bar shares; a dragged one elsewhere is left be.
      if (hr && hr.width > 0 && hr.top < sr.top + 96) {
        const onRight = hr.left + hr.right > sr.left + sr.right;
        side = (onRight ? sr.right - hr.left : hr.right - sr.left) + HUD_GAP;
      }
    }
    const value = side ? `${Math.round(side)}px` : '';
    if (root.style.getPropertyValue('--stage-kit-side') !== value) {
      if (value) root.style.setProperty('--stage-kit-side', value);
      else root.style.removeProperty('--stage-kit-side');
    }
  }

  /** Ask the fit for the band the kit covers, and tell the canvas when the band changes. */
  function reserve(): void {
    if (disposed) return;
    let top = prior.top, bottom = prior.bottom;
    const box = root.hidden ? null : root.getBoundingClientRect();
    if (box && box.height > 0) {
      const sr = stage.getBoundingClientRect();
      if (root.dataset.placement === 'foot') bottom = `${Math.max(0, Math.round(sr.bottom - box.top))}px`;
      else top = `${Math.max(0, Math.round(box.bottom - sr.top))}px`;
    }
    if (top === lastReserve.top && bottom === lastReserve.bottom) return;
    lastReserve = { top, bottom };
    for (const [name, value] of [[RESERVE_TOP, top], [RESERVE_BOTTOM, bottom]] as const) {
      if (value) stage.style.setProperty(name, value);
      else stage.style.removeProperty(name);
    }
    opts.canvas?.dispatchEvent(new Event('canvas-resize'));
  }

  /** Flag the ends of a row that scrolls, so the stylesheet can fade an edge that has more past the edge. */
  function syncScrollEdges(): void {
    const max = bar.scrollWidth - bar.clientWidth;
    const start = Math.abs(bar.scrollLeft);
    bar.toggleAttribute('data-more-start', max > 1 && start > 1);
    bar.toggleAttribute('data-more-end', max > 1 && start < max - 1);
  }
  bar.addEventListener('scroll', syncScrollEdges, { passive: true });

  function layout(): void {
    if (disposed) return;
    const placement = phone() ? 'foot' : 'top';
    if (root.dataset.placement !== placement) root.dataset.placement = placement;
    clearHud();
    fitLabels();
    syncTips();
    syncScrollEdges();
    reserve();
  }

  const RO = doc.defaultView?.ResizeObserver;
  let frame = 0;
  const schedule = (): void => {
    if (frame || disposed) return;
    const raf = doc.defaultView?.requestAnimationFrame;
    if (!raf) { layout(); return; }
    frame = raf(() => { frame = 0; layout(); });
  };
  const stageRo = RO ? new RO(schedule) : null;
  stageRo?.observe(stage);
  const rootRo = RO ? new RO(() => reserve()) : null;
  rootRo?.observe(root);
  const offLayout = onLayoutChange(schedule);

  function dispose(): void {
    if (disposed) return;
    popover?.handle.close();
    popover = null;
    stageRo?.disconnect();
    rootRo?.disconnect();
    offLayout();
    if (frame) doc.defaultView?.cancelAnimationFrame(frame);
    root.remove();
    handleLayer?.remove();
    handleLayer = null;
    for (const host of floatHosts.values()) host.remove();
    floatHosts.clear();
    disposed = true;
    const changed = lastReserve.top !== prior.top || lastReserve.bottom !== prior.bottom;
    for (const [name, value] of [[RESERVE_TOP, prior.top], [RESERVE_BOTTOM, prior.bottom]] as const) {
      if (value) stage.style.setProperty(name, value);
      else stage.style.removeProperty(name);
    }
    if (changed) opts.canvas?.dispatchEvent(new Event('canvas-resize'));
  }

  layout();
  return { element: root, setBar, setStatus, layer, placeFloat, layout, dispose };
}
