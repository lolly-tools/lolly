// SPDX-License-Identifier: MPL-2.0
/** Coordinate Design's existing panels and keep compact editing actions reachable. */
import { t } from '../i18n.ts';
import { compactActionsHeight, compactDesignViewport, designPanelsFit, phoneDesignPanel } from '../lib/design-panel-layout.ts';
import { edgeDockWidth } from '../lib/edge-dock.ts';
import { isSplitLayout, onLayoutChange } from '../lib/layout-posture.ts';
import type { DesignCanvasPorts } from './design-ports.ts';
import type { DesignNavigatorHandle } from './design-navigator.ts';
import type { DesignInspectorFloatHandle } from './design-inspector-float.ts';
import { mountDesignSplit } from './design-split.ts';
import { mountDesignPhonePanel, type DesignPhonePanelHandle, type PhoneTab } from './design-phone-panel.ts';

type Panel = 'navigator' | 'inspector' | 'timeline';
export function mountDesignPanels(opts: {
  stage: HTMLElement; canvas: HTMLElement; design: DesignCanvasPorts;
  navigator: DesignNavigatorHandle; inspector: DesignInspectorFloatHandle;
  more(anchor: HTMLElement): void;
}) {
  const { stage, canvas, design, inspector } = opts;
  let adjusting = false, disposed = false, scheduled = false;
  // On a phone the inspector and the layers list are the two tabs of one drop-down panel,
  // the tool view's own (views/design-phone-panel.ts). Mounted while the window is in the
  // phone layout, and only with the live elements and the handover it needs; a host
  // without them (a test double) keeps the bottom sheets. Its layout listener is added
  // BEFORE the fold's, so on a fold the panel lets the layers list go before the control
  // pane asks for it, and on the way back takes it only after the pane has let it go.
  // The app placing or opening a column for a layout is not the person bringing that
  // column forward: `active` keeps their last choice through these.
  const quietly = (run: () => void): void => {
    const was = adjusting;
    adjusting = true;
    try { run(); } finally { adjusting = was; }
  };
  let phone: DesignPhonePanelHandle | null = null;
  let phoneWasOpen = false;
  const layoutEl = stage.closest<HTMLElement>('.tool-layout');
  const phoneCapable = (): boolean => !!layoutEl && !!opts.navigator.el && typeof inspector.enterPhone === 'function';
  const followPhone = (): void => {
    if (disposed) return;
    const want = phoneCapable() && phoneDesignPanel();
    if (want && !phone) {
      split.sync();
      phone = mountDesignPhonePanel({
        layout: layoutEl!,
        navigatorEl: opts.navigator.el,
        onChange: ({ tab, open }) => onPhoneChange(tab, open),
        onBand: () => schedule(),
      });
      inspector.enterPhone(el => phone?.host(el));
      phoneWasOpen = false;
    } else if (!want && phone) {
      // Cleared first: placing the inspector again reports its state, which syncs, which
      // comes back here.
      const leaving = phone;
      phone = null;
      quietly(() => inspector.leavePhone());
      leaving.destroy();
      put('--design-panel-reserve-top', 0);
      split.sync();
    }
  };
  const offPhoneLayout = onLayoutChange(() => { followPhone(); schedule(); });
  // Two panes (views/design-split.ts): the right-hand column is the control pane and
  // the navigator joins it as the Layers tab, where it takes no stage band. The
  // panels read the navigator through the split's view of the navigator.
  const split = mountDesignSplit({
    navigator: () => opts.navigator, inspector: () => inspector,
    openInspector: () => { quietly(() => inspector.setOpen(true, 'host')); }, syncPanels: () => schedule(), stage,
  });
  const navigator = split.navigatorForPanels(opts.navigator);
  // The person opening the navigator brings its tab forward in two panes. Every open
  // change reaches sync() below, so that is where the transition is caught.
  let navWasOpen = navigator.isOpen();
  let active: Panel = design.isTimelineOpen() ? 'timeline' : navigator.isOpen() ? 'navigator' : 'inspector';
  // Whether a person has brought a panel forward yet. Until one has, a list restored
  // open beside the inspector stands behind it, as the control pane shows the two at
  // launch (the list joins in the background, views/design-split.ts).
  let chosen = false;
  // The columns the one-at-a-time rule closed, as against the ones a person closed. A
  // window with room for both again gets these back (sync), so a visit to the phone
  // layout, or a fold and unfold, leaves the wide arrangement as it was. A column the
  // person opened while narrow is open already and stays; one they closed themselves
  // was never held.
  const held = new Set<'navigator' | 'inspector'>();
  // The list's width when the rule closed the list: closed, the list reports none, and
  // the question on the way back is whether both fit with the list open.
  let heldNavWidth = 0;
  let wasExclusive = false;
  let wasEditing = false;
  let timelineOpen = design.isTimelineOpen();
  let sheetHeight = 0;
  const actions = document.createElement('div');
  actions.className = 'design-compact-actions';
  actions.setAttribute('role', 'toolbar');
  actions.setAttribute('aria-label', t('Editing actions'));
  actions.setAttribute('data-export-hide', '');
  actions.setAttribute('data-live-hide', '');
  actions.setAttribute('data-canvas-keys', 'off');
  const button = (label: string, run: (button: HTMLButtonElement) => void): HTMLButtonElement => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.addEventListener('click', () => run(b)); actions.append(b); return b;
  };
  button(t('Add'), b => { activate('timeline'); design.openAddMenu?.(b); });
  // On a phone these pick the panel's tab and open it, or fold it back to its peek. Focus
  // goes into the panel with it, and Escape brings it back to the button.
  const layers = button(t('Layer/Page'), () => { navigator.setOpen(!navigator.isOpen()); if (navigator.isOpen()) phone?.show('layers', { focus: true }); else phone?.collapse(); });
  const inspect = button(t('Inspect'), () => { inspector.setOpen(!inspector.isOpen()); if (inspector.isOpen()) phone?.show('inspect', { focus: true }); else phone?.collapse(); });
  button(t('More'), opts.more);
  const done = button(t('Done'), () => {
    if (stage.classList.contains('is-text-editing')) design.finishTextEditing?.();
    else design.finishDrawing?.();
  });
  done.className = 'design-text-done';
  stage.append(actions);

  /** One column at a time: a compact window, or a desk too narrow for both. In two panes
   *  the inspector and the layers are tabs of one control pane, so opening one never has
   *  to close the other. */
  function exclusive(navWidth = navigator.width()): boolean {
    if (isSplitLayout()) return false;
    return compactDesignViewport() || !designPanelsFit(window.innerWidth, navWidth, Math.max(340, edgeDockWidth()));
  }
  /** Room for both again: the columns the rule closed come back, behind the one the
   *  person last brought forward. Nothing is recorded as their choice (`adjusting`). */
  function restoreHeld(): void {
    if (inspector.isOpen()) held.delete('inspector');
    if (navigator.isOpen()) held.delete('navigator');
    if (!held.size || exclusive(held.has('navigator') ? Math.max(heldNavWidth, navigator.width()) : navigator.width())) return;
    adjusting = true;
    if (held.has('inspector')) inspector.setOpen(true, 'host');
    if (held.has('navigator')) navigator.setOpen(true);
    adjusting = false;
    held.clear();
  }
  function activate(panel: Panel, enforce = true): void {
    if (adjusting || disposed) return;
    active = panel;
    chosen = true;
    if (enforce) keepOne(panel);
  }
  /** Where one column shows at a time, close the others and hold them for the way back. */
  function keepOne(panel: Panel): void {
    if (adjusting || disposed) return;
    const compact = compactDesignViewport();
    if (!exclusive()) return;
    adjusting = true;
    if (panel !== 'navigator' && navigator.isOpen()) { held.add('navigator'); heldNavWidth = navigator.width(); navigator.setOpen(false); }
    if (panel !== 'inspector' && inspector.isOpen()) { held.add('inspector'); inspector.setOpen(false, 'host'); }
    if (compact && panel !== 'timeline' && design.isTimelineOpen()) design.toggleTimeline();
    adjusting = false;
    sync();
  }
  /** The person chose a tab, or dragged or tapped the phone panel open or shut. */
  function onPhoneChange(tab: PhoneTab, open: boolean): void {
    if (open) {
      if (tab === 'inspect') inspector.setOpen(true, 'user');
      else navigator.setOpen(true);
      phone?.show(tab);
    } else {
      if (inspector.isOpen()) inspector.setOpen(false, 'user');
      if (navigator.isOpen()) navigator.setOpen(false);
    }
  }
  function put(name: string, value: number): boolean {
    const next = value > 0 ? `${Math.round(value)}px` : '';
    if (stage.style.getPropertyValue(name) === next) return false;
    if (next) stage.style.setProperty(name, next); else stage.style.removeProperty(name);
    return true;
  }
  function sync(): void {
    if (disposed || adjusting) return;
    followPhone();
    const compact = compactDesignViewport();
    stage.dataset.designLayout = compact ? 'compact' : 'wide';
    actions.hidden = !compact;
    const editing = stage.classList.contains('is-text-editing');
    done.hidden = !editing && !stage.matches('.fc-lining, .fc-penning, .fc-penciling');
    if (compact && editing && !wasEditing) {
      wasEditing = true; activate('timeline');
      if (design.isTimelineOpen()) design.toggleTimeline();
    }
    wasEditing = editing;
    if (!chosen && active === 'navigator' && inspector.isOpen()) active = 'inspector';
    restoreHeld();
    // In two panes an opened list is the tab shown when the list is what the person
    // last brought forward; a list that came back beside the inspector joins behind.
    if (navigator.isOpen() !== navWasOpen) { navWasOpen = navigator.isOpen(); split.sync(navWasOpen && active === 'navigator'); }
    // Out of one-at-a-time into two panes with the list last brought forward: the pane
    // took the list in behind the inspector as the layout changed, so the list's tab is
    // shown now.
    const nowExclusive = exclusive();
    if (wasExclusive && !nowExclusive && navigator.isOpen() && active === 'navigator') split.sync(true);
    wasExclusive = nowExclusive;
    layers.setAttribute('aria-pressed', String(navigator.isOpen()));
    inspect.setAttribute('aria-pressed', String(inspector.isOpen()));
    const currentTimeline = design.isTimelineOpen();
    if (currentTimeline && !timelineOpen) { timelineOpen = currentTimeline; activate('timeline'); }
    timelineOpen = design.isTimelineOpen();
    if ((navigator.isOpen() && inspector.isOpen()) || (compact && timelineOpen && (navigator.isOpen() || inspector.isOpen()))) keepOne(active);
    // The phone panel shows what the two columns say: the open one's tab, or its peek.
    if (phone) {
      if (inspector.isOpen()) phone.show('inspect');
      else if (navigator.isOpen()) phone.show('layers');
      else phone.collapse();
      phone.sync();
    }
    const viewport = window.visualViewport;
    const vh = viewport?.height ?? window.innerHeight;
    const inset = compact ? Math.max(0, stage.getBoundingClientRect().bottom - (vh + (viewport?.offsetTop ?? 0))) : 0;
    const navHeight = Math.max(120, Math.min(420, (vh - 120) * 0.5));
    let changed = put('--design-actions-h', compact ? compactActionsHeight() : 0);
    changed = put('--design-viewport-inset', inset) || changed;
    changed = put('--design-nav-height', navHeight) || changed;
    changed = put('--design-panel-reserve', compact && !phone ? Math.max(inspector.isOpen() ? sheetHeight : 0, navigator.isOpen() ? navHeight : 0) : 0) || changed;
    // The phone panel hangs from the top, so it reserves the top of the stage instead: the
    // canvas is framed in the band between the panel's edge and the bottom bar.
    changed = put('--design-panel-reserve-top', phone ? Math.max(0, phone.bandTop() - stage.getBoundingClientRect().top) : 0) || changed;
    design.setColumnWidths(compact ? 0 : navigator.width(), 0);
    if (changed) canvas.dispatchEvent(new Event('canvas-resize'));
    // Opening to half frames the selection into that band, if the fit left it out: the
    // stage's navigation hears this (views/tool-stage-nav.ts `revealSelection`).
    const phoneOpen = !!phone?.isOpen();
    if (phoneOpen && !phoneWasOpen) stage.dispatchEvent(new Event('fc-reveal-selection'));
    phoneWasOpen = phoneOpen;
  }
  function schedule(): void {
    if (scheduled || disposed) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sync(); });
  }
  // An already-open Sequence can be edited beside the inspector on a wide screen.
  // Keep that interaction as the active panel when a resize makes them exclusive.
  const onTimelineInteraction = (event: Event): void => {
    if ((event.target as Element | null)?.closest?.('.tl-panel')) activate('timeline');
  };
  stage.addEventListener('focusin', onTimelineInteraction);
  stage.addEventListener('pointerdown', onTimelineInteraction, true);
  const observer = new MutationObserver(schedule);
  observer.observe(stage, { attributes: true, attributeFilter: ['class'] });
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  resize?.observe(stage);
  canvas.addEventListener('canvas-resize', schedule);
  // The phone panel follows a resize at once, in the same event the inspector's own
  // resize handler stands aside in, so a window narrowed to a phone never shows the
  // bottom sheet for a frame first.
  const onResize = (): void => { followPhone(); schedule(); };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  sync();
  split.sync();
  return {
    get adjusting() { return adjusting; },
    activate, sync: schedule,
    sheetHeight(height: number) { sheetHeight = height; schedule(); },
    destroy() {
      offPhoneLayout();
      if (phone) { inspector.leavePhone(); phone.destroy(); phone = null; }
      disposed = true; observer.disconnect(); resize?.disconnect(); actions.remove(); split.destroy();
      stage.removeEventListener('focusin', onTimelineInteraction);
      stage.removeEventListener('pointerdown', onTimelineInteraction, true);
      canvas.removeEventListener('canvas-resize', schedule);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      delete stage.dataset.designLayout;
      for (const key of ['--design-actions-h', '--design-viewport-inset', '--design-nav-height', '--design-panel-reserve', '--design-panel-reserve-top']) stage.style.removeProperty(key);
    },
  };
}
