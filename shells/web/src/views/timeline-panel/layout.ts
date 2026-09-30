// SPDX-License-Identifier: MPL-2.0
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { mountBodyPopover } from '../../components/body-popover.ts';
import { isTimed } from '../timeline-math.ts';
import { bindOp, type TpCtx } from './context.ts';

const TRACK_HEIGHT_KEY = 'lolly-timeline-track-height';
const HEIGHT_MIN = 24;
const HEIGHT_MAX = 96;
const HEIGHT_DEFAULT = 34;

function heightOf(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= HEIGHT_MIN && n <= HEIGHT_MAX ? Math.round(n) : HEIGHT_DEFAULT;
}

export function setTrackHeight(tp: TpCtx, value: number): void {
  const height = heightOf(value);
  if (tp.trackHeight === height) return;
  tp.trackHeight = height;
  tp.root.style.setProperty('--tl-track-height', `${height}px`);
  try { localStorage.setItem(TRACK_HEIGHT_KEY, String(height)); } catch { /* device preference unavailable */ }
  // Resize immediately; refresh pictures once the size control settles.
  if (tp.trackThumbTimer) clearTimeout(tp.trackThumbTimer);
  tp.trackThumbTimer = setTimeout(() => {
    tp.trackThumbTimer = null;
    tp.thumbs.scheduleThumbs();
  }, 150);
}

export function wire(tp: TpCtx): void {
  let height = HEIGHT_DEFAULT;
  try { height = heightOf(localStorage.getItem(TRACK_HEIGHT_KEY)); } catch { /* use default */ }
  tp.trackHeight = height;
  tp.root.style.setProperty('--tl-track-height', `${height}px`);
  tp.previousTimed = null;
  tp.alwaysNoticeTimer = null;
  tp.trackThumbTimer = null;
  if (typeof matchMedia === 'function' && matchMedia('(any-pointer: coarse)').matches && !tp.helpers.compactPanel()) {
    tp.panelH = Math.max(tp.panelH, 240);
  }

  tp.alwaysBtn = tp.helpers.actionBtn('tl-always-on', t('Always on'), 'layers');
  tp.alwaysBtn.setAttribute('aria-haspopup', 'dialog');
  tp.alwaysMenu = mountBodyPopover(tp.alwaysBtn, (el) => {
    el.textContent = '';
    el.onkeydown = tp.selectionActions.onMenuKey;
    const hint = document.createElement('p');
    hint.className = 'tl-always-hint';
    hint.textContent = t('These objects stay visible for the whole video.');
    tp.scenery.classList.add('is-popover-list');
    el.append(hint, tp.scenery);
    const done = tp.helpers.actionBtn('tl-always-done', t('Done'), 'check');
    done.addEventListener('click', () => tp.alwaysMenu.close(true));
    el.append(done);
    return tp.scenery.querySelector<HTMLElement>('.is-selected')
      ?? tp.scenery.querySelector<HTMLElement>('.tl-chip') ?? done;
  }, {
    className: 'folder-menu tl-menu tl-always-pop', role: 'dialog',
    ariaLabel: t('Always-on objects'), position: tp.menus.menuPosition,
    onClose() {
      tp.scenery.classList.remove('is-popover-list');
      tp.root.append(tp.scenery);
    },
    isInside: target => !!(target as Element | null)?.closest?.('.tl-ctx-menu'),
  });
  tp.alwaysBtn.addEventListener('click', () => {
    if (tp.alwaysMenu.isOpen()) tp.alwaysMenu.close(true);
    else tp.alwaysMenu.open();
  });
  tp.tools.insertBefore(tp.alwaysBtn, tp.mobileToolsBtn);
  // The list keeps its existing selection and promotion writers when body-mounted.
  tp.scenery.addEventListener('contextmenu', event => {
    if (!tp.alwaysMenu.isOpen()) return;
    event.stopPropagation();
    tp.menus.onContextMenu(event);
  });
  tp.scenery.addEventListener('keydown', event => {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    const chip = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-id]');
    if (!chip?.dataset.id) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = chip.getBoundingClientRect();
    tp.menus.openCtxMenu(chip.dataset.id, rect.left, rect.bottom, chip);
  });

  const size = tp.helpers.actionBtn('tl-track-size', t('Track height'), 'trackHeight');
  size.dataset.tip = t('Track height');
  tp.trackSizeMenu = mountBodyPopover(size, (el, pop) => {
    el.textContent = '';
    const label = document.createElement('label');
    label.className = 'tl-track-size-field';
    const caption = document.createElement('span');
    caption.textContent = t('Track height');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'field-range';
    slider.setAttribute('aria-label', t('Track height'));
    slider.min = String(HEIGHT_MIN);
    slider.max = String(HEIGHT_MAX);
    slider.step = '2';
    slider.value = String(tp.trackHeight);
    const value = document.createElement('output'); value.textContent = `${tp.trackHeight} px`;
    slider.addEventListener('input', () => { tp.layout.setTrackHeight(Number(slider.value)); value.textContent = `${tp.trackHeight} px`; });
    label.append(caption, slider);
    const row = document.createElement('div');
    row.className = 'tl-track-size-actions';
    const shorter = tp.helpers.actionBtn('tl-track-shorter', t('Shorter'), 'minus');
    const taller = tp.helpers.actionBtn('tl-track-taller', t('Taller'), 'plus');
    const change = (delta: number) => {
      const next = Math.max(HEIGHT_MIN, Math.min(HEIGHT_MAX, tp.trackHeight + delta));
      tp.layout.setTrackHeight(next);
      slider.value = String(next);
      value.textContent = `${next} px`;
    };
    shorter.addEventListener('click', () => change(-8));
    taller.addEventListener('click', () => change(8));
    const done = tp.helpers.actionBtn('tl-track-size-done', t('Done'), 'check');
    done.addEventListener('click', () => pop.close(true));
    const reset = tp.helpers.actionBtn('tl-track-reset', t('Reset'), 'undo');
    reset.addEventListener('click', () => { tp.layout.setTrackHeight(HEIGHT_DEFAULT); slider.value = String(HEIGHT_DEFAULT); value.textContent = `${HEIGHT_DEFAULT} px`; });
    row.append(shorter, taller, reset, done);
    el.append(value, label, row);
    // The shell upgrades ranges after mount; keep initial focus on a stable button.
    return shorter;
  }, {
    className: 'folder-menu tl-menu tl-track-size-pop', role: 'dialog',
    ariaLabel: t('Track height'), position: tp.menus.menuPosition,
  });
  size.addEventListener('click', () => {
    if (tp.trackSizeMenu.isOpen()) tp.trackSizeMenu.close(true);
    else tp.trackSizeMenu.open();
  });
  tp.tools.insertBefore(size, tp.kfBtn);
  sync(tp);
}

/** Model changes only: a newly always-on object earns one quiet highlight. */
export function sync(tp: TpCtx): void {
  if (!tp.alwaysBtn) return;
  const rows = tp.getBoxes();
  const timed = new Set<string>();
  let count = 0;
  let changed = false;
  for (const row of rows) {
    const id = String(row?.[tp.cfg.idField] ?? '');
    if (!id) continue;
    if (isTimed(row, tp.cfg)) timed.add(id);
    else { count++; if (tp.previousTimed?.has(id)) changed = true; }
  }
  tp.previousTimed = timed;
  const label = tp.alwaysBtn.querySelector('.tl-action-label');
  const text = t('Always on ({n})', { n: String(count) });
  if (label && label.textContent !== text) label.textContent = text;
  tp.alwaysBtn.setAttribute('aria-label', t('Always on: {n} objects', { n: String(count) }));
  const recoverFocus = !count && (document.activeElement === tp.alwaysBtn || tp.scenery.contains(document.activeElement));
  tp.alwaysBtn.disabled = count === 0;
  if (!count) tp.alwaysMenu.close();
  if (recoverFocus) (tp.bars.get(tp.focusedId) ?? tp.root).focus();
  if (changed) {
    if (tp.alwaysNoticeTimer) clearTimeout(tp.alwaysNoticeTimer);
    tp.alwaysBtn.classList.add('is-notifying');
    announce(t('Object moved to Always on'));
    tp.alwaysNoticeTimer = setTimeout(() => {
      tp.alwaysNoticeTimer = null;
      tp.alwaysBtn.classList.remove('is-notifying');
    }, 1200);
  }
}

export function close(tp: TpCtx): void {
  tp.alwaysMenu?.close();
  tp.trackSizeMenu?.close();
  if (tp.alwaysNoticeTimer) clearTimeout(tp.alwaysNoticeTimer);
  tp.alwaysNoticeTimer = null;
  tp.alwaysBtn?.classList.remove('is-notifying');
  if (tp.trackThumbTimer) clearTimeout(tp.trackThumbTimer);
  tp.trackThumbTimer = null;
}

export function layoutOps(tp: TpCtx) {
  return { wire: bindOp(tp, wire), sync: bindOp(tp, sync), close: bindOp(tp, close), setTrackHeight: bindOp(tp, setTrackHeight) };
}
