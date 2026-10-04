// SPDX-License-Identifier: MPL-2.0
/** Coordinate Design's existing panels and keep compact editing actions reachable. */
import { t } from '../i18n.ts';
import { compactActionsHeight, compactDesignViewport, designPanelsFit } from '../lib/design-panel-layout.ts';
import { edgeDockWidth } from '../lib/edge-dock.ts';
import type { DesignCanvasPorts } from './design-ports.ts';
import type { DesignNavigatorHandle } from './design-navigator.ts';
import type { DesignInspectorFloatHandle } from './design-inspector-float.ts';

type Panel = 'navigator' | 'inspector' | 'timeline';
export function mountDesignPanels(opts: {
  stage: HTMLElement; canvas: HTMLElement; design: DesignCanvasPorts;
  navigator: DesignNavigatorHandle; inspector: DesignInspectorFloatHandle;
  more(anchor: HTMLElement): void;
}) {
  const { stage, canvas, design, navigator, inspector } = opts;
  let adjusting = false, disposed = false, scheduled = false;
  let active: Panel = design.isTimelineOpen() ? 'timeline' : navigator.isOpen() ? 'navigator' : 'inspector';
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
  const layers = button(t('Layer/Page'), () => navigator.setOpen(!navigator.isOpen()));
  const inspect = button(t('Inspect'), () => inspector.setOpen(!inspector.isOpen()));
  button(t('More'), opts.more);
  const done = button(t('Done'), () => design.finishTextEditing?.());
  done.className = 'design-text-done';
  stage.append(actions);

  function activate(panel: Panel, enforce = true): void {
    if (adjusting || disposed) return;
    active = panel;
    if (!enforce) return;
    const compact = compactDesignViewport();
    const exclusive = compact || !designPanelsFit(window.innerWidth, navigator.width(), Math.max(340, edgeDockWidth()));
    if (!exclusive) return;
    adjusting = true;
    if (panel !== 'navigator') navigator.setOpen(false);
    if (panel !== 'inspector') inspector.setOpen(false, 'host');
    if (compact && panel !== 'timeline' && design.isTimelineOpen()) design.toggleTimeline();
    adjusting = false;
    sync();
  }
  function put(name: string, value: number): boolean {
    const next = value > 0 ? `${Math.round(value)}px` : '';
    if (stage.style.getPropertyValue(name) === next) return false;
    if (next) stage.style.setProperty(name, next); else stage.style.removeProperty(name);
    return true;
  }
  function sync(): void {
    if (disposed || adjusting) return;
    const compact = compactDesignViewport();
    stage.dataset.designLayout = compact ? 'compact' : 'wide';
    actions.hidden = !compact;
    const editing = stage.classList.contains('is-text-editing');
    done.hidden = !editing;
    if (compact && editing && !wasEditing) {
      wasEditing = true; activate('timeline');
      if (design.isTimelineOpen()) design.toggleTimeline();
    }
    wasEditing = editing;
    layers.setAttribute('aria-pressed', String(navigator.isOpen()));
    inspect.setAttribute('aria-pressed', String(inspector.isOpen()));
    const currentTimeline = design.isTimelineOpen();
    if (currentTimeline && !timelineOpen) { timelineOpen = currentTimeline; activate('timeline'); }
    timelineOpen = design.isTimelineOpen();
    if ((navigator.isOpen() && inspector.isOpen()) || (compact && timelineOpen && (navigator.isOpen() || inspector.isOpen()))) activate(active);
    const viewport = window.visualViewport;
    const vh = viewport?.height ?? window.innerHeight;
    const inset = compact ? Math.max(0, stage.getBoundingClientRect().bottom - (vh + (viewport?.offsetTop ?? 0))) : 0;
    const navHeight = Math.max(120, Math.min(420, (vh - 120) * 0.5));
    let changed = put('--design-actions-h', compact ? compactActionsHeight() : 0);
    changed = put('--design-viewport-inset', inset) || changed;
    changed = put('--design-nav-height', navHeight) || changed;
    changed = put('--design-panel-reserve', compact ? Math.max(inspector.isOpen() ? sheetHeight : 0, navigator.isOpen() ? navHeight : 0) : 0) || changed;
    design.setColumnWidths(compact ? 0 : navigator.width(), 0);
    if (changed) canvas.dispatchEvent(new Event('canvas-resize'));
  }
  function schedule(): void {
    if (scheduled || disposed) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sync(); });
  }
  const observer = new MutationObserver(schedule);
  observer.observe(stage, { attributes: true, attributeFilter: ['class'] });
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  resize?.observe(stage);
  canvas.addEventListener('canvas-resize', schedule);
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  sync();
  return {
    get adjusting() { return adjusting; },
    activate, sync: schedule,
    sheetHeight(height: number) { sheetHeight = height; schedule(); },
    destroy() {
      disposed = true; observer.disconnect(); resize?.disconnect(); actions.remove();
      canvas.removeEventListener('canvas-resize', schedule);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      delete stage.dataset.designLayout;
      for (const key of ['--design-actions-h', '--design-viewport-inset', '--design-nav-height', '--design-panel-reserve']) stage.style.removeProperty(key);
    },
  };
}
