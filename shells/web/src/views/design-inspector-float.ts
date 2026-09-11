// SPDX-License-Identifier: MPL-2.0
/** Dock/float ownership for Design's live Inspector panel. */

import { t } from '../i18n.ts';
import {
  type DockReleaseReason,
  edgeDockHitTest,
  edgeDockPreview,
  edgeDockWidth,
  isDocked,
  onDockChange,
  releaseDock,
  requestDock,
  showPanel,
} from '../lib/edge-dock.ts';
import { icon } from '../lib/icons.ts';
import { type GripBox, panelGripsHtml, wirePanelGrips } from '../lib/panel-grips.ts';
import { attachWobble } from '../lib/wobble.ts';
import type { DesignInspectorHandle } from './design-inspector.ts';

type Mode = 'edge' | 'floating' | 'maximized';
type OpenReason = 'user' | 'host';

interface SavedState {
  mode?: Mode;
  box?: GripBox | null;
}

export interface DesignInspectorFloatOptions {
  inspector: DesignInspectorHandle;
  head: HTMLElement;
  isMobile?(): boolean;
  onOpenChange?(open: boolean, reason: OpenReason): void;
}

export interface DesignInspectorFloatHandle {
  setOpen(open: boolean, reason?: OpenReason): boolean;
  isOpen(): boolean;
  mode(): Mode;
  dock(): void;
  detach(): void;
  destroy(): void;
}

export const DESIGN_INSPECTOR_FLOAT_KEY = 'lolly:designInspectorFloat';
const MIN = { w: 300, h: 280 };
const MARGIN = 8;

function load(): SavedState {
  try {
    const value = JSON.parse(
      localStorage.getItem(DESIGN_INSPECTOR_FLOAT_KEY) || '{}'
    ) as SavedState;
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function wireDesignInspectorFloat(
  opts: DesignInspectorFloatOptions
): DesignInspectorFloatHandle {
  const { inspector, head } = opts;
  const panel = inspector.el;
  const isMobile = opts.isMobile ?? (() => window.innerWidth <= 640);
  const saved = load();
  let mode: Mode = saved.mode === 'floating' || saved.mode === 'maximized' ? saved.mode : 'edge';
  let box: GripBox | null =
    saved.box && [saved.box.x, saved.box.y, saved.box.w, saved.box.h].every(Number.isFinite)
      ? saved.box
      : null;
  let restoreBox: GripBox | null = null;
  let open = false;
  let destroyed = false;
  let releaseAction: 'float' | 'close' | 'destroy' | null = null;

  const save = (): void => {
    try {
      localStorage.setItem(DESIGN_INSPECTOR_FLOAT_KEY, JSON.stringify({ mode, box }));
    } catch {
      /* private mode */
    }
  };
  const vw = (): number => window.innerWidth;
  const vh = (): number => window.innerHeight;
  const freeSpan = (): { x0: number; x1: number } => {
    const band = isDocked('inspector') ? 0 : edgeDockWidth();
    if (!(band > 0)) return { x0: 0, x1: vw() };
    const span = Math.max(MIN.w + MARGIN * 2, vw() - band);
    return document.documentElement.dir === 'rtl'
      ? { x0: vw() - span, x1: vw() }
      : { x0: 0, x1: span };
  };
  const clamp = (value: GripBox): GripBox => {
    const { x0, x1 } = freeSpan();
    const maxW = Math.max(MIN.w, x1 - x0 - MARGIN * 2);
    const maxH = Math.max(MIN.h, vh() - MARGIN * 2);
    const w = Math.min(Math.max(MIN.w, value.w), maxW);
    const h = Math.min(Math.max(MIN.h, value.h), maxH);
    return {
      x: Math.min(Math.max(x0 + MARGIN, value.x), x1 - MARGIN - w),
      y: Math.min(Math.max(MARGIN, value.y), vh() - MARGIN - h),
      w,
      h,
    };
  };
  const currentRect = (): GripBox => {
    const rect = panel.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      w: rect.width || 340,
      h: rect.height || Math.min(720, vh() - 32),
    };
  };
  const seedBox = (): GripBox => {
    const w = Math.min(380, Math.max(MIN.w, vw() - MARGIN * 2));
    const h = Math.min(720, Math.max(MIN.h, vh() - MARGIN * 2));
    const rtl = document.documentElement.dir === 'rtl';
    return clamp({ x: rtl ? MARGIN : vw() - w - edgeDockWidth() - MARGIN, y: 64, w, h });
  };
  const applyBox = (value: GripBox): void => {
    panel.style.left = `${Math.round(value.x)}px`;
    panel.style.top = `${Math.round(value.y)}px`;
    panel.style.width = `${Math.round(value.w)}px`;
    panel.style.height = `${Math.round(value.h)}px`;
  };
  const clearBox = (): void => {
    panel.style.left = panel.style.top = panel.style.width = panel.style.height = '';
  };

  const tools = document.createElement('span');
  tools.className = 'fc-insp-tools';
  const button = (action: string, glyph: string, label: string): HTMLButtonElement => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'fc-insp-tool';
    el.dataset.actCol = action;
    el.innerHTML = glyph;
    el.setAttribute('aria-label', label);
    el.title = label;
    return el;
  };
  const detachBtn = button('detach', icon('resize'), t('Detach inspector'));
  const maxBtn = button('maximize', icon('arrowsV'), t('Expand inspector to full height'));
  const dockBtn = button('dock', icon('dock'), t('Dock inspector to the side'));
  tools.append(detachBtn, maxBtn, dockBtn);
  const closeBtn = head.querySelector<HTMLElement>('[data-act-col="close"]');
  head.insertBefore(tools, closeBtn ?? null);

  panel.insertAdjacentHTML('beforeend', panelGripsHtml());
  const wobble = attachWobble(panel);

  const notify = (next: boolean, reason: OpenReason): void => {
    if (open === next) return;
    open = next;
    inspector.setOpen(next);
    opts.onOpenChange?.(next, reason);
  };

  const render = (): void => {
    const floating = mode !== 'edge';
    panel.classList.toggle('is-floating', floating);
    panel.classList.toggle('is-maximized', mode === 'maximized');
    detachBtn.hidden = mode !== 'edge';
    dockBtn.hidden = mode === 'edge';
    maxBtn.setAttribute('aria-pressed', String(mode === 'maximized'));
    maxBtn.setAttribute(
      'aria-label',
      mode === 'maximized' ? t('Restore inspector size') : t('Expand inspector to full height')
    );
    maxBtn.title = maxBtn.getAttribute('aria-label') || '';
    if (floating && box) applyBox(box);
    else if (!floating) clearBox();
  };

  const released = (reason: DockReleaseReason): void => {
    const action = releaseAction;
    releaseAction = null;
    if (action === 'float') {
      document.body.appendChild(panel);
      mode = 'floating';
      box = clamp(box ?? seedBox());
      render();
      notify(true, 'user');
      save();
      return;
    }
    panel.remove();
    notify(false, action === 'close' && reason === 'user' ? 'user' : 'host');
  };

  const enterEdge = (): boolean => {
    if (isMobile()) return false;
    if (isDocked('inspector')) {
      showPanel('inspector');
      mode = 'edge';
      render();
      notify(true, 'user');
      return true;
    }
    if (
      !requestDock('inspector', panel, {
        icon: icon('sliders'),
        label: t('Inspector'),
        onRelease: released,
      })
    )
      return false;
    mode = 'edge';
    render();
    notify(true, 'user');
    save();
    return true;
  };

  const enterFloating = (): void => {
    if (isMobile()) return;
    if (isDocked('inspector')) {
      box = clamp(currentRect());
      releaseAction = 'float';
      releaseDock('inspector', 'host');
      return;
    }
    document.body.appendChild(panel);
    mode = 'floating';
    box = clamp(box ?? seedBox());
    render();
    notify(true, 'user');
    save();
  };

  const setOpen = (next: boolean, reason: OpenReason = 'user'): boolean => {
    if (destroyed) return false;
    if (next) {
      if (open) {
        if (mode === 'edge') showPanel('inspector');
        return true;
      }
      if (mode === 'edge') return enterEdge();
      if (isMobile()) return false;
      document.body.appendChild(panel);
      box = clamp(box ?? seedBox());
      render();
      notify(true, reason);
      return true;
    }
    if (!open) return false;
    if (isDocked('inspector')) {
      releaseAction = 'close';
      releaseDock('inspector', reason === 'user' ? 'user' : 'host');
    } else {
      panel.remove();
      notify(false, reason);
    }
    return false;
  };

  const dock = (): void => {
    if (!open || mode === 'edge') return;
    box = clamp(box ?? currentRect());
    if (enterEdge()) save();
  };

  const toggleMax = (): void => {
    if (isMobile()) return;
    if (mode === 'edge') enterFloating();
    if (mode === 'maximized') {
      mode = 'floating';
      box = clamp(restoreBox ?? box ?? seedBox());
      restoreBox = null;
    } else {
      restoreBox = { ...(box ?? currentRect()) };
      mode = 'maximized';
      const base = box ?? seedBox();
      box = clamp({ x: base.x, y: MARGIN, w: base.w, h: vh() - MARGIN * 2 });
    }
    render();
    save();
  };

  detachBtn.addEventListener('click', enterFloating);
  dockBtn.addEventListener('click', dock);
  maxBtn.addEventListener('click', toggleMax);

  let drag: { px: number; py: number; lx: number; ly: number; box: GripBox; id: number } | null =
    null;
  const onHeadDown = (event: PointerEvent): void => {
    if (isMobile() || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    if (mode === 'edge') enterFloating();
    if (mode === 'maximized') toggleMax();
    const current = box ?? seedBox();
    drag = {
      px: event.clientX,
      py: event.clientY,
      lx: event.clientX,
      ly: event.clientY,
      box: { ...current },
      id: event.pointerId,
    };
    try {
      head.setPointerCapture(event.pointerId);
    } catch {
      /* stray id */
    }
    panel.classList.add('is-dragging');
    wobble.grab(event.clientX, event.clientY);
    event.preventDefault();
  };
  const onHeadMove = (event: PointerEvent): void => {
    if (!drag) return;
    box = clamp({
      ...drag.box,
      x: drag.box.x + event.clientX - drag.px,
      y: drag.box.y + event.clientY - drag.py,
    });
    applyBox(box);
    wobble.drag(event.clientX - drag.lx, event.clientY - drag.ly);
    drag.lx = event.clientX;
    drag.ly = event.clientY;
    edgeDockPreview(edgeDockHitTest(event.clientX));
  };
  const onHeadUp = (event: PointerEvent): void => {
    if (!drag) return;
    try {
      if (head.hasPointerCapture(drag.id)) head.releasePointerCapture(drag.id);
    } catch {
      /* already released */
    }
    const dropX = event.clientX;
    drag = null;
    panel.classList.remove('is-dragging');
    wobble.release();
    edgeDockPreview(false);
    if (edgeDockHitTest(dropX)) dock();
    else save();
  };
  head.addEventListener('pointerdown', onHeadDown);
  head.addEventListener('pointermove', onHeadMove);
  head.addEventListener('pointerup', onHeadUp);
  head.addEventListener('pointercancel', onHeadUp);

  const gripsOff = wirePanelGrips(panel, {
    read: () => box ?? currentRect(),
    apply: (next) => {
      box = next;
      applyBox(next);
    },
    clamp,
    min: MIN,
    locked: () => isMobile() || mode === 'edge',
    onEnd: () => {
      if (mode === 'maximized') mode = 'floating';
      save();
    },
  });

  const onResize = (): void => {
    if (!open || mode === 'edge' || !box) return;
    box = clamp(box);
    render();
  };
  window.addEventListener('resize', onResize);
  const offDock = onDockChange(() => {
    if (!open || mode === 'edge' || !box || drag) return;
    box = clamp(box);
    render();
  });
  render();

  return {
    setOpen,
    isOpen: () => open,
    mode: () => mode,
    dock,
    detach: enterFloating,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      offDock();
      window.removeEventListener('resize', onResize);
      head.removeEventListener('pointerdown', onHeadDown);
      head.removeEventListener('pointermove', onHeadMove);
      head.removeEventListener('pointerup', onHeadUp);
      head.removeEventListener('pointercancel', onHeadUp);
      gripsOff();
      edgeDockPreview(false);
      if (isDocked('inspector')) {
        releaseAction = 'destroy';
        releaseDock('inspector', 'host');
      }
      panel.remove();
      inspector.setOpen(false);
      wobble.dispose();
    },
  };
}
