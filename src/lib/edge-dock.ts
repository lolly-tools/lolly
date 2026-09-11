// SPDX-License-Identifier: MPL-2.0
/**
 * Edge docking - a right-edge (inline-end) full-height column the export settings
 * panel and the Neurospicy player can be dragged into, so they stay put and out of
 * the content while you work instead of floating over the preview and inputs.
 *
 * The content is NUDGED, never overlapped: this module owns one custom property,
 * `--dock-w` on <html>, and the shell's `#view` + the fixed chrome reserve that much
 * inline-end space (styles/parts/*.css thread `var(--dock-w, 0px)`). The tool stage
 * re-fits on its own - it is inside #view and watched by a ResizeObserver
 * (views/tool.ts) - so shrinking #view reflows everything with no poke from here.
 *
 * DESKTOP ONLY. Below the shell's 640px mobile breakpoint the whole feature is inert:
 * no column, no `--dock-w`, no listeners doing work, so mobile (web and the Tauri
 * mobile shell, which is the same code under 640px) cannot be touched by a feature
 * that does not run there. Crossing below the breakpoint with panels docked undocks
 * them back to their float boxes.
 *
 * Additive when idle: with nothing docked there is no column element, no attribute
 * and no custom property, so the app is byte-identical to today (`var(--dock-w, 0px)`
 * resolves to 0px when the property is unset). This module only ever moves chrome
 * panels; it never reads or writes their persisted float boxes, and never reaches
 * inside the tool canvas or the export stages.
 *
 * Geometry (column width, the two-panel split, collapsed, the active tab) persists here
 * under `lolly:edge-dock`; WHICH panels are docked is owned by each panel, which
 * re-requests docking from its own restore path.
 *
 * ONE RIGHT SIDEBAR. Every full-height panel the app can dock lives in THIS column -
 * the Neurospicy player, the Design inspector, the export sheet, the transcript - so a
 * view never grows a second right-hand column beside it. Unrelated pairs can share a
 * vertical split, but Inspector + Export are tabs even by themselves: they are competing
 * full-workflow surfaces, and half-height makes both harder to use. Three or more panels
 * also use a TAB STRIP. The compact zoom bar is not a full panel: it is a fixed-height
 * bar that always sits at the top, above the strip.
 *
 * `onDockChange` reports every occupancy change, so chrome outside this module (the
 * Design top bar, the stage zoom HUD) can follow what is docked without polling.
 */
import { t } from '../i18n.ts';
import './edge-dock.css';
import { clamp } from '@lolly/engine';

const STORE_KEY = 'lolly:edge-dock';
const MOBILE_MQ = '(max-width: 640px)';   // the shell's canonical breakpoint (mobile-sheet.ts etc.)

// px. RAIL = collapsed rail width; MIN/MAX bound the resizable column; MIN_SLOT keeps
// each stacked panel usable; BAND = the inline-end drop-zone depth a drag must reach.
const RAIL_W = 48;
const MIN_W = 280;
const DEFAULT_W = 340;
const COMPACT_ONLY_W = 230;   // width when the column holds only the compact zoom bar (fits the bar + the card inset)
// A stacked full panel keeps at least this much, so the lower panel's working area (the
// words list of the Edit-script panel, an inspector's first section) stays readable under
// the divider (Andy, 2026-09-03). The divider clamps the drag to this on both sides.
const MIN_SLOT_H = 200;
const DROP_BAND = 52;
// Drag the width grip inside this and the column snaps shut to the rail; dragging back
// out past it re-opens at MIN_W. Below MIN_W a panel column is unusable anyway, so the
// space between the two is where the gesture reads as "put it away", not "make it tiny".
const COLLAPSE_AT = 200;
const WIDTH_STEP = 24;        // px per arrow key on the width grip

// Column order is fixed, top-to-bottom: the zoom HUD (a COMPACT bar), then the player,
// the Design inspector, the export panel, the transcript. Everything but the zoom bar is
// a full panel: one or two of them share the resizable split, three or more become tabs.
// The zoom bar is fixed-height and sits above all of it, out of the split and the strip.
type PanelId = 'zoom' | 'neuro' | 'inspector' | 'history' | 'export' | 'transcript';
const ORDER: readonly PanelId[] = ['zoom', 'neuro', 'inspector', 'history', 'export', 'transcript'];

/**
 * Why a panel left the column. `user` is a gesture that means "put this away" - the drag
 * out of the column, a panel's own close button, its dock toggle. `host` is the app taking
 * a panel back for reasons of its own: a view teardown on a route change, or the window
 * dropping below the mobile breakpoint where the whole column is inert. An occupant that
 * persists an open/closed preference must only write it for `user`, or leaving the view
 * records a decision the user never made.
 */
export type DockReleaseReason = 'user' | 'host';

interface Occupant {
  el: HTMLElement;
  /** Where the element came from, so releaseDock puts it back. Null when it was DETACHED
   *  at dock time (the Design inspector is built that way): then undocking takes it out
   *  of the column and leaves it detached, for its owner to place again. */
  home: { parent: Node; next: Node | null } | null;
  onRelease?: (reason: DockReleaseReason) => void;
  onCollapse?: (collapsed: boolean) => void;
  /** Trusted SVG markup (icon()) + label for the collapsed rail's per-panel button. */
  icon?: string;
  label?: string;
  /** A compact occupant (the zoom HUD) is a fixed-height bar: it does not stretch to
   *  fill, and it sits outside the two-panel resize split. */
  compact?: boolean;
}

export interface DockHooks {
  onRelease?: (reason: DockReleaseReason) => void;
  onCollapse?: (collapsed: boolean) => void;
  /** Dock as a fixed-height compact bar rather than a full-height panel. */
  compact?: boolean;
  icon?: string;
  label?: string;
}

interface DockGeom { width?: number; split?: number; collapsed?: boolean; tab?: PanelId }

/** Fired on every occupancy change with the docked ids, in column order. */
export type DockChangeListener = (docked: readonly PanelId[]) => void;

const occupants = new Map<PanelId, Occupant>();
let geom: DockGeom = load();
let col: HTMLElement | null = null;
let body: HTMLElement | null = null;
let preview: HTMLElement | null = null;
// Docked panels scroll and clip their contents, so the ordinary `data-tip`
// pseudo-element cannot promise to stay visible there. One body-level bubble
// is deliberately owned by the dock and positioned against the hovered/focused
// control. It is visual-only (the triggering control keeps its own accessible
// name), never intercepts a pointer, and is removed with the column.
let dockTooltip: HTMLElement | null = null;
let dockTooltipTarget: HTMLElement | null = null;
let resizeBound = false;
const dockListeners = new Set<DockChangeListener>();
let notifying = false;
let notifyAgain = false;

function load(): DockGeom {
  try { return { ...(JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as DockGeom) }; }
  catch { return {}; }
}
function save(): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(geom)); } catch { /* best-effort */ }
}

/** Desktop resolution? Docking never exists below the mobile breakpoint. */
export function edgeDockAvailable(): boolean {
  return typeof matchMedia === 'function' && !matchMedia(MOBILE_MQ).matches;
}

function isRTL(): boolean {
  if (document.documentElement.dir === 'rtl' || document.dir === 'rtl') return true;
  // Fallback for direction set via CSS rather than the attribute (browser only).
  return typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
    && window.getComputedStyle(document.documentElement).direction === 'rtl';
}


function hideDockTooltip(): void {
  if (dockTooltipTarget) delete dockTooltipTarget.dataset.dockTipManaged;
  dockTooltipTarget = null;
  if (dockTooltip) dockTooltip.hidden = true;
}

function onDockTooltipResize(): void { hideDockTooltip(); }

/** Place the dock tooltip inside the viewport, preferring above the trigger and
 * falling below only when the dock's top edge would clip it. */
function showDockTooltip(target: HTMLElement): void {
  const label = target.getAttribute('data-tip')?.trim();
  if (!label || !col?.contains(target)) { hideDockTooltip(); return; }
  if (!dockTooltip) {
    dockTooltip = document.createElement('div');
    dockTooltip.className = 'edge-dock-tooltip';
    dockTooltip.setAttribute('role', 'tooltip');
    dockTooltip.hidden = true;
    document.body.appendChild(dockTooltip);
  }
  if (dockTooltipTarget && dockTooltipTarget !== target) delete dockTooltipTarget.dataset.dockTipManaged;
  dockTooltipTarget = target;
  target.dataset.dockTipManaged = '';
  dockTooltip.textContent = label;
  dockTooltip.hidden = false;
  // Measure offscreen first: it avoids a visible 0,0 frame and lets a long
  // label be clamped against either viewport edge rather than its scroll slot.
  dockTooltip.style.left = '-9999px';
  dockTooltip.style.top = '-9999px';
  const anchor = target.getBoundingClientRect();
  const bubble = dockTooltip.getBoundingClientRect();
  const margin = 8;
  const left = Math.max(margin, Math.min(anchor.left + anchor.width / 2 - bubble.width / 2, window.innerWidth - bubble.width - margin));
  const above = anchor.top - bubble.height - margin;
  const top = above >= margin ? above : Math.min(window.innerHeight - bubble.height - margin, anchor.bottom + margin);
  dockTooltip.style.left = `${Math.round(left)}px`;
  dockTooltip.style.top = `${Math.round(Math.max(margin, top))}px`;
}

function wireDockTooltips(root: HTMLElement): void {
  const trigger = (node: EventTarget | null): HTMLElement | null =>
    node && typeof (node as { closest?: unknown }).closest === 'function'
      ? (node as HTMLElement).closest<HTMLElement>('[data-tip]') : null;
  root.addEventListener('pointerover', (event) => {
    const target = trigger(event.target);
    if (target) showDockTooltip(target);
  });
  root.addEventListener('pointerout', (event) => {
    const target = trigger(event.target);
    if (target && target === dockTooltipTarget && !target.contains(event.relatedTarget as Node | null)) hideDockTooltip();
  });
  root.addEventListener('focusin', (event) => {
    const target = trigger(event.target);
    if (target) showDockTooltip(target);
  });
  root.addEventListener('focusout', () => {
    queueMicrotask(() => {
      if (!dockTooltipTarget || !dockTooltipTarget.matches(':focus')) hideDockTooltip();
    });
  });
  // A scrolled trigger no longer has the geometry the bubble was placed from;
  // hiding it is honest, and the next hover/focus repositions it precisely.
  root.addEventListener('scroll', hideDockTooltip, true);
  window.addEventListener('resize', onDockTooltipResize, { passive: true });
}

function ensureColumn(): void {
  if (col) return;
  col = document.createElement('aside');
  col.className = 'edge-dock';
  col.setAttribute('aria-label', t('Docked panels'));
  // The canvas-keyboard opt-out, the same statement the Design top bar makes. The canvas
  // editor binds its bare-key verbs on `window`, so every button in here (collapse, the
  // rail icons, a docked panel's own controls) was a live canvas surface: Delete on the
  // export panel removed the canvas selection. free-canvas reads this one attribute on
  // any chrome root that holds focusable controls over the canvas.
  col.setAttribute('data-canvas-keys', 'off');
  wireDockTooltips(col);

  const grip = document.createElement('div');
  grip.className = 'edge-dock-grip resize-grip';
  grip.setAttribute('role', 'separator');
  grip.setAttribute('aria-orientation', 'vertical');
  grip.setAttribute('aria-label', t('Resize docked panels'));
  // Keyboard reachable, like the inputs sidebar's own handle: the pointer drag is not
  // the only way to size or put away a sidebar.
  grip.tabIndex = 0;
  grip.setAttribute('aria-valuemin', String(RAIL_W));
  wireWidthGrip(grip);

  const collapse = document.createElement('button');
  collapse.type = 'button';
  collapse.className = 'edge-dock-collapse';
  collapse.addEventListener('click', () => toggleCollapse());

  // The collapsed rail: one icon per docked panel (shown only when collapsed), so the
  // rail reads as "the player + export are here", not a bare bar. Any icon expands.
  const rail = document.createElement('div');
  rail.className = 'edge-dock-rail';

  body = document.createElement('div');
  body.className = 'edge-dock-body';

  col.append(grip, collapse, rail, body);
  document.body.appendChild(col);
  document.documentElement.setAttribute('data-edge-dock', '');
  bindResize();
}

function teardownColumn(): void {
  if (!col) return;
  hideDockTooltip();
  window.removeEventListener('resize', onDockTooltipResize);
  dockTooltip?.remove();
  dockTooltip = null;
  col.remove();
  col = null; body = null;
  document.documentElement.removeAttribute('data-edge-dock');
  document.documentElement.style.removeProperty('--dock-w');
}

/** The full-height panels docked now, in column order (everything but the compact bar). */
function fullPanels(): PanelId[] {
  return ORDER.filter(id => occupants.has(id) && !occupants.get(id)!.compact);
}

/** The tab the strip shows: the remembered one while it is still docked, else the last. */
function activeTab(fulls: PanelId[]): PanelId | undefined {
  const want = geom.tab;
  return want && fulls.includes(want) ? want : fulls[fulls.length - 1];
}

/**
 * This module's ONE raw-markup sink. Every caller passes a trusted `icon()` string from
 * lib/icons.ts (a panel hands its glyph in through DockHooks), exactly as the export
 * panel's own tool buttons do; nothing interpolated reaches it.
 */
function setGlyph(el: HTMLElement, markup: string): void { el.innerHTML = markup; }

/** Rebuild the body's slots + divider from the current occupants and apply geometry. */
function relayout(): void {
  if (!col || !body) return;
  const present = ORDER.filter(id => occupants.has(id));
  if (!present.length) { teardownColumn(); return; }

  const fulls = fullPanels();
  // Design's Inspector and the export sheet are alternate right-side workflows, not a
  // useful vertical pairing: the inspector needs room for property sections and export
  // needs room for its format/options form. Keep the established split for other pairs
  // (for example the player and transcript), but name this pair with the same tabs a
  // crowded dock already uses.
  const tabbed = fulls.length > 2 || (fulls.includes('history') && fulls.length > 1) || (fulls.includes('inspector') && fulls.includes('export'));

  body.textContent = '';
  const slots = new Map<PanelId, HTMLElement>();
  const mountSlot = (id: PanelId): HTMLElement => {
    const occ = occupants.get(id)!;
    const slot = document.createElement('div');
    slot.className = 'edge-dock-slot';
    if (occ.compact) slot.classList.add('edge-dock-slot--compact');
    slot.dataset.slot = id;
    slot.id = `edge-dock-slot-${id}`;
    slot.appendChild(occ.el);
    body!.appendChild(slot);
    slots.set(id, slot);
    return slot;
  };

  // The compact bar (the zoom HUD) is always the top slot: it is fixed-height, sits
  // outside the split, and stays visible above a tab strip.
  for (const id of present) if (occupants.get(id)!.compact) mountSlot(id);

  if (tabbed) {
    // Past two full panels the column stops stacking and starts naming. Every panel is
    // still MOUNTED - a tab switch must not tear a panel's DOM down and lose what the
    // user had open in it - and paintTabs decides which one is visible.
    body.appendChild(buildTabs(fulls));
    for (const id of fulls) {
      const slot = mountSlot(id);
      slot.setAttribute('role', 'tabpanel');
      slot.setAttribute('aria-labelledby', `edge-dock-tab-${id}`);
    }
    paintTabs();
  } else {
    fulls.forEach((id, i) => {
      // A resize divider only sits BETWEEN two full panels (the split is theirs). The
      // fixed-height compact bar (zoom) can't be resized, so its boundary gets none - a
      // margin on the compact slot separates it instead.
      if (i > 0) {
        const div = document.createElement('div');
        div.className = 'edge-dock-divider';
        div.setAttribute('role', 'separator');
        div.setAttribute('aria-orientation', 'horizontal');
        wireDivider(div);
        body!.appendChild(div);
      }
      mountSlot(id);
    });
    // Heights: with two full panels the top takes `split` and the bottom fills the rest;
    // with one it fills. The compact bar never fills, so neither ever sees it.
    const bottom = fulls[fulls.length - 1];
    if (bottom) slots.get(bottom)!.classList.add('edge-dock-slot--fill');
    applySplit();
  }

  // Collapsed rail: an icon button per occupant, click expands.
  const rail = col.querySelector<HTMLElement>('.edge-dock-rail');
  if (rail) {
    rail.textContent = '';
    for (const id of present) {
      const occ = occupants.get(id)!;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'edge-dock-rail-btn';
      b.title = occ.label ?? id;
      b.setAttribute('aria-label', t('Expand {name}', { name: occ.label ?? id }));
      setGlyph(b, occ.icon ?? '');
      // Expanding onto a named panel shows THAT panel, so the rail is a way back to the
      // one you put away, not just a way to re-open whatever was last active. Expanding
      // also HIDES this button (the rail only exists while collapsed), so the keyboard
      // has to be handed on before it goes - otherwise focus falls to <body> and the next
      // Tab restarts at the top of the page instead of entering the panel that opened.
      b.addEventListener('click', () => {
        if (!occ.compact) showTab(id);
        if (geom.collapsed) { toggleCollapse(); focusRevealed(id); }
      });
      rail.appendChild(b);
    }
  }

  applyWidth();
  paintCollapsed();
}

/** The tab strip: one tab per full panel, roving tabindex, arrows move between them. */
function buildTabs(fulls: PanelId[]): HTMLElement {
  const strip = document.createElement('div');
  strip.className = 'edge-dock-tabs';
  strip.setAttribute('role', 'tablist');
  strip.setAttribute('aria-label', t('Docked panels'));
  for (const id of fulls) {
    const occ = occupants.get(id)!;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'edge-dock-tab';
    tab.id = `edge-dock-tab-${id}`;
    tab.dataset.tab = id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `edge-dock-slot-${id}`);
    tab.title = occ.label ?? id;
    const ic = document.createElement('span');
    ic.className = 'edge-dock-tab-ic';
    ic.setAttribute('aria-hidden', 'true');
    setGlyph(ic, occ.icon ?? '');
    const lb = document.createElement('span');
    lb.className = 'edge-dock-tab-lb';
    lb.textContent = occ.label ?? id;
    tab.append(ic, lb);
    tab.addEventListener('click', () => showTab(id));
    tab.addEventListener('keydown', (e: KeyboardEvent) => onTabKey(e, id, fulls));
    strip.appendChild(tab);
  }
  return strip;
}

/**
 * Paint which tab is selected and which slot is visible, WITHOUT rebuilding the strip:
 * a rebuild would destroy the tab the pointer or the keyboard is on, which is the same
 * trap applySplit avoids for the divider.
 */
function paintTabs(): void {
  if (!body) return;
  const strip = body.querySelector<HTMLElement>('.edge-dock-tabs');
  if (!strip) return;
  const active = activeTab(fullPanels());
  for (const tab of strip.querySelectorAll<HTMLElement>('.edge-dock-tab')) {
    const on = tab.dataset.tab === active;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
  }
  for (const slot of body.querySelectorAll<HTMLElement>('.edge-dock-slot:not(.edge-dock-slot--compact)')) {
    const on = slot.dataset.slot === active;
    slot.hidden = !on;
    slot.classList.toggle('edge-dock-slot--fill', on);
  }
}

/** Show one docked panel's tab (no-op unless the column is in tabbed mode). */
function showTab(id: PanelId): void {
  if (geom.tab === id) return;
  geom.tab = id;
  paintTabs();
  save();
}

/** Anything a Tab press can reach - the same list the app's other focus hand-offs use. */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Put the keyboard inside a panel the column has just revealed: its tab if the column is
 * tabbed, else the first control in its slot, else the collapse button (which is always
 * there and now says "Hide docked panels"). The control that asked for the panel is being
 * removed from the page as this runs, so somewhere in the panel is the only honest answer.
 */
function focusRevealed(id: PanelId): void {
  const tab = body?.querySelector<HTMLElement>(`.edge-dock-tab[data-tab="${id}"]`);
  if (tab) { tab.focus(); return; }
  const slot = body?.querySelector<HTMLElement>(`.edge-dock-slot[data-slot="${id}"]`);
  const target = slot?.querySelector<HTMLElement>(FOCUSABLE)
    ?? col?.querySelector<HTMLElement>('.edge-dock-collapse')
    ?? null;
  target?.focus();
}

function onTabKey(e: KeyboardEvent, id: PanelId, fulls: PanelId[]): void {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const rtl = isRTL();
  const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
  const back = rtl ? 'ArrowRight' : 'ArrowLeft';
  const i = fulls.indexOf(id);
  let next = -1;
  if (e.key === fwd || e.key === 'ArrowDown') next = (i + 1) % fulls.length;
  else if (e.key === back || e.key === 'ArrowUp') next = (i - 1 + fulls.length) % fulls.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = fulls.length - 1;
  else return;
  e.preventDefault();
  const to = fulls[next];
  if (!to) return;
  showTab(to);
  body?.querySelector<HTMLElement>(`.edge-dock-tab[data-tab="${to}"]`)?.focus();
}

/**
 * Size the two stacked slots from `geom.split`, writing the EXISTING top slot's height
 * directly - never rebuilding the DOM. A divider drag calls this every move, so it must
 * not touch the divider element (relayout() recreates it, which would detach the handle
 * holding pointer capture and kill the drag after one move). No-op unless two are docked.
 */
function applySplit(): void {
  if (!body) return;
  // The split is between the two FULL panels only; a compact bar sits outside it.
  const slots = body.querySelectorAll<HTMLElement>('.edge-dock-slot:not(.edge-dock-slot--compact)');
  if (slots.length !== 2) return;
  const top = slots[0]!;
  const bodyH = body.clientHeight || 1;
  // No remembered split: share the height evenly rather than letting the top panel take
  // only its content height (an inspector showing one collapsed section left the lower
  // panel a sliver at the top and nothing usable below, 2026-09-03). The clamp then keeps
  // both slots at least MIN_SLOT_H tall, exactly as a dragged split is clamped.
  const ratio = geom.split === undefined ? 0.5 : geom.split;
  const topH = clamp(ratio * bodyH, MIN_SLOT_H, Math.max(MIN_SLOT_H, bodyH - MIN_SLOT_H));
  top.style.flex = '0 0 auto';
  top.style.height = `${topH}px`;
}

function applyWidth(): void {
  // A column holding ONLY the compact zoom bar (no full panel) is slim - a full 280px
  // panel column reserved for a row of zoom buttons would shove the canvas for nothing.
  const compactOnly = occupants.size > 0 && [...occupants.values()].every(o => o.compact);
  const w = geom.collapsed ? RAIL_W
    : compactOnly ? COMPACT_ONLY_W
    : clamp(geom.width ?? DEFAULT_W, MIN_W, maxWidth());
  document.documentElement.style.setProperty('--dock-w', `${w}px`);
  const grip = col?.querySelector<HTMLElement>('.edge-dock-grip');
  if (grip) {
    grip.setAttribute('aria-valuenow', String(w));
    grip.setAttribute('aria-valuemax', String(maxWidth()));
  }
}

function maxWidth(): number {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  return Math.max(MIN_W, Math.min(560, Math.floor(vw * 0.5)));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Dock `el` into the column under `id`. No-op (returns false) below the desktop
 * breakpoint. Remembers where `el` came from so releaseDock puts it back. The caller
 * stops applying its own float box while docked and re-applies it in `onRelease`.
 */
export function requestDock(id: PanelId, el: HTMLElement, hooks: DockHooks = {}): boolean {
  if (!edgeDockAvailable()) return false;
  // Already in the column: the ask is still "show me this panel", so front it rather than
  // reporting success over a panel that is behind a tab or inside a collapsed rail.
  if (occupants.has(id)) { showPanel(id); return true; }
  ensureColumn();
  occupants.set(id, {
    el,
    home: el.parentNode ? { parent: el.parentNode, next: el.nextSibling } : null,
    onRelease: hooks.onRelease,
    onCollapse: hooks.onCollapse,
    icon: hooks.icon,
    label: hooks.label,
    compact: hooks.compact,
  });
  // The panel someone just docked is the one they want to see, so it takes the strip's
  // active tab. (Inert while one or two panels stack - it is remembered for the moment a
  // third arrives, and for the next session.)
  if (!hooks.compact) geom.tab = id;
  relayout();
  // A collapsed column would swallow it: the body is display:none, so the panel would be
  // mounted and invisible while its owner (and the bar's aria-pressed) said it was open.
  // Docking a PANEL is someone asking to see it, so the column opens for it. The compact
  // zoom bar is the exception - it follows the column automatically, and a bar the user
  // put away must not spring open because the HUD came along behind it.
  if (!hooks.compact) setCollapsed(false);
  if (geom.collapsed) hooks.onCollapse?.(true);
  save();
  notifyDock();
  return true;
}

/**
 * Bring an already-docked panel to the front: its tab if the column is tabbed, and out of
 * the collapsed rail if it was put away. The one door for "show me this panel" from
 * outside the module - the Design object bar's Text / More / Dims / Stroke buttons reveal
 * an inspector section through it, and before it existed those buttons were dead whenever
 * the column was collapsed or the inspector was a background tab.
 */
export function showPanel(id: PanelId): void {
  const occ = occupants.get(id);
  if (!occ) return;
  if (!occ.compact) showTab(id);
  setCollapsed(false);
}

/** Is the column put away to its rail? Docked-but-collapsed is not on screen, so chrome
 *  that steps aside for a docked panel (the Design top bar's zoom cluster) has to ask. */
export function edgeDockCollapsed(): boolean { return !!geom.collapsed; }

/** Undock `id`: restore its element to where it came from, then relayout (or tear the
 *  column down if it was the last). Fires the occupant's onRelease so it re-floats.
 *  `reason` tells the occupant whether a person asked for this or the app did. */
export function releaseDock(id: PanelId, reason: DockReleaseReason = 'user'): void {
  const occ = occupants.get(id);
  if (!occ) return;
  occupants.delete(id);
  if (occ.home) {
    const { parent, next } = occ.home;
    try { parent.insertBefore(occ.el, next); } catch { document.body.appendChild(occ.el); }
  } else {
    // Docked from nowhere, so it goes back to nowhere: parking it on <body> would leave
    // a full panel loose at the end of the page.
    occ.el.remove();
  }
  occ.onRelease?.(reason);
  relayout();
  save();
  notifyDock();
}

export function isDocked(id: PanelId): boolean { return occupants.has(id); }
export function dockedCount(): number { return occupants.size; }
/** How many FULL-height panels are docked - the compact zoom bar is not one of them. */
export function dockedFullCount(): number { return fullPanels().length; }

/**
 * Hear about every occupancy change (dock, undock, the breakpoint's mass undock), so
 * chrome outside this module can follow the column. Returns the unsubscribe.
 *
 * Listeners fire synchronously, and a listener is allowed to dock or release something
 * itself (the stage HUD docks its compact bar when the column opens): a change made
 * during a notification is folded into one more pass rather than nesting, and the pass
 * count is capped so two listeners fighting each other cannot spin.
 */
export function onDockChange(cb: DockChangeListener): () => void {
  dockListeners.add(cb);
  return () => { dockListeners.delete(cb); };
}

function notifyDock(): void {
  if (notifying) { notifyAgain = true; return; }
  notifying = true;
  try {
    let passes = 0;
    do {
      notifyAgain = false;
      const ids = ORDER.filter(id => occupants.has(id));
      for (const cb of [...dockListeners]) {
        try { cb(ids); } catch { /* a listener must not break docking */ }
      }
    } while (notifyAgain && ++passes < 8);
  } finally { notifying = false; notifyAgain = false; }
}

/** The inline-end space the dock currently reserves, in px (0 when nothing is docked).
 *  For sites that clamp popovers to the viewport and must instead clamp to the content
 *  area (e.g. the timeline, which sits beside a docked column). */
export function edgeDockWidth(): number {
  const v = document.documentElement.style.getPropertyValue('--dock-w');
  return v ? (parseFloat(v) || 0) : 0;
}

/** Is `clientX` within the inline-end drop band? RTL-aware (inline-end is the left).
 *  When a column is ALREADY open its whole width is the target, not just the thin
 *  edge band - otherwise a stage-clamped drag (the zoom HUD) can't reach the band,
 *  which sits ~300px deep inside the open dock, and adding to an existing dock feels
 *  broken. With no column open, the thin edge band stands. */
export function edgeDockHitTest(clientX: number): boolean {
  if (!edgeDockAvailable()) return false;
  const vw = window.innerWidth;
  const band = Math.max(DROP_BAND, edgeDockWidth());
  return isRTL() ? clientX <= band : clientX >= vw - band;
}

/** Show / hide the drop-zone affordance while a panel drag hovers the edge. */
export function edgeDockPreview(on: boolean): void {
  if (on) {
    if (!edgeDockAvailable()) return;
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'edge-dock-drop';
      document.body.appendChild(preview);
    }
  } else if (preview) {
    preview.remove();
    preview = null;
  }
}

// ── Width grip (inline-start edge) - the sidebar shape (the former studio-split.ts, removed 2026-09-11) ─────────────

/**
 * One width, from a drag or a key. Inside COLLAPSE_AT the column puts itself away to the
 * rail, and widening back out past it re-opens at MIN_W - so the same gesture that sizes
 * the sidebar also closes and re-opens it, which is how both side panels behaved before
 * the dock existed. The drag stays live across the snap, so a pointer that overshoots and
 * comes back out re-expands without letting go.
 */
function applyGripWidth(w: number): void {
  if (w < COLLAPSE_AT) { setCollapsed(true); return; }
  setCollapsed(false);
  geom.width = clamp(w, MIN_W, maxWidth());
  applyWidth();
}

function wireWidthGrip(grip: HTMLElement): void {
  let dragging = false;
  grip.addEventListener('pointerdown', (e: PointerEvent) => {
    if (!col) return;
    dragging = true;
    try { grip.setPointerCapture(e.pointerId); } catch { /* stray pointer id */ }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  grip.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging || !col) return;
    const r = col.getBoundingClientRect();
    // Column width from the pointer to the column's outer (viewport) edge.
    applyGripWidth(isRTL() ? e.clientX - r.left : r.right - e.clientX);
  });
  const up = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try { if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    save();
  };
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);

  // The keyboard half: arrows resize (narrowing past the snap collapses, widening from
  // the rail re-opens), Enter/Space puts it away and back. Nothing here is a chord, so
  // Meta/Ctrl combinations stay the browser's.
  grip.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // The column sits at the inline END and its grip is on the inline-START edge, so in
    // LTR it is ArrowLeft that pulls the edge outwards and widens it.
    const rtl = isRTL();
    const wider = rtl ? 'ArrowRight' : 'ArrowLeft';
    const narrower = rtl ? 'ArrowLeft' : 'ArrowRight';
    const cur = geom.collapsed ? RAIL_W : clamp(geom.width ?? DEFAULT_W, MIN_W, maxWidth());
    if (e.key === 'Enter' || e.key === ' ') { toggleCollapse(); }
    else if (e.key === wider) { applyGripWidth(geom.collapsed ? MIN_W : cur + WIDTH_STEP); }
    // At the minimum the next press is the "put it away" the pointer makes by crossing the
    // snap. applyGripWidth re-clamps to MIN_W on every pass and COLLAPSE_AT sits 80px below
    // it - wider than one step - so without this the key stalls at 280 forever and the
    // collapse half of the gesture existed only for the mouse.
    else if (e.key === narrower) { if (cur <= MIN_W) setCollapsed(true); else applyGripWidth(cur - WIDTH_STEP); }
    else if (e.key === 'Home') { applyGripWidth(MIN_W); }
    else if (e.key === 'End') { applyGripWidth(maxWidth()); }
    else return;
    e.preventDefault();
    save();
  });
}

// ── Divider (between the two stacked panels) - the former studio-split forked to the Y axis ─
function wireDivider(div: HTMLElement): void {
  let dragging = false;
  div.addEventListener('pointerdown', (e: PointerEvent) => {
    dragging = true;
    try { div.setPointerCapture(e.pointerId); } catch { /* stray pointer id */ }
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  div.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging || !body) return;
    const r = body.getBoundingClientRect();
    const bodyH = r.height || 1;
    const topH = clamp(e.clientY - r.top, MIN_SLOT_H, Math.max(MIN_SLOT_H, bodyH - MIN_SLOT_H));
    geom.split = topH / bodyH;
    applySplit();   // direct height write - must NOT relayout (that recreates this handle)
  });
  const up = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try { if (div.hasPointerCapture(e.pointerId)) div.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    save();
  };
  div.addEventListener('pointerup', up);
  div.addEventListener('pointercancel', up);
}

// ── Collapse ───────────────────────────────────────────────────────────────────
function toggleCollapse(): void { setCollapsed(!geom.collapsed); }

/** Collapse to the rail, or expand back. No-op when already in that state. */
function setCollapsed(next: boolean): void {
  if (!!geom.collapsed === next) return;
  geom.collapsed = next;
  applyWidth();
  paintCollapsed();
  for (const occ of occupants.values()) occ.onCollapse?.(next);
  save();
  // Collapsing takes every docked panel off the screen without changing occupancy, and
  // chrome that stepped aside for one has to hear about that: the Design top bar hid its
  // whole zoom cluster (and the mark and the avatar with it) because the compact zoom bar
  // was docked, which left a collapsed column with no zoom control anywhere on screen.
  notifyDock();
}

/** The collapsed/expanded look and its accessible state, in one place. */
function paintCollapsed(): void {
  if (!col) return;
  const down = !!geom.collapsed;
  col.classList.toggle('is-collapsed', down);
  const cb = col.querySelector<HTMLElement>('.edge-dock-collapse');
  if (cb) {
    cb.textContent = down ? '⟨' : '⟩';
    cb.setAttribute('aria-expanded', String(!down));
    const label = down ? t('Show docked panels') : t('Hide docked panels');
    cb.setAttribute('aria-label', label);
    cb.title = label;
  }
}

// ── Breakpoint + viewport guard ─────────────────────────────────────────────────
function bindResize(): void {
  if (resizeBound) return;
  resizeBound = true;
  window.addEventListener('resize', () => {
    // Dropped below the desktop breakpoint: undock everything back to floating.
    if (!edgeDockAvailable()) {
      // The HOST is taking these back, not the user: a window dragged narrow must not
      // record "closed" against a panel's own open/closed preference.
      for (const id of [...occupants.keys()]) releaseDock(id, 'host');
      return;
    }
    // Still desktop: re-clamp the width (the viewport may have shrunk) and re-derive
    // the split's px from its fraction.
    if (occupants.size) { applyWidth(); relayout(); }
  });
}
