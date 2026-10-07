// SPDX-License-Identifier: MPL-2.0
/** Move and resize Comments with the shared panel grips and right-side dock. */
import { t } from '../i18n.ts';
import { edgeDockAvailable, edgeDockHitTest, edgeDockPreview, edgeDockWidth, isDocked, releaseDock, requestDock } from '../lib/edge-dock.ts';
import { icon, type IconName } from '../lib/icons.ts';
import { panelGripsHtml, wirePanelGrips, type GripBox } from '../lib/panel-grips.ts';

const KEY = 'lolly:commentPanel';
const MIN = { w: 280, h: 320 };
const GAP = 8;

export function wireCommentPanel(panel: HTMLElement, head: HTMLElement, close: HTMLElement) {
  const doc = panel.ownerDocument, win = doc.defaultView!;
  const conversation = panel.querySelector<HTMLElement>('.collab-comment-messages');
  let scroll = { top: 0, end: true };
  const rememberScroll = () => { if (conversation) scroll = { top: conversation.scrollTop, end: conversation.scrollHeight - conversation.clientHeight - conversation.scrollTop < 48 }; };
  const restoreScroll = () => { const saved = scroll; win.requestAnimationFrame(() => { if (!disposed && conversation) conversation.scrollTop = saved.end ? conversation.scrollHeight : saved.top; }); };
  conversation?.addEventListener('scroll', rememberScroll);
  let edge = false, box: GripBox | undefined, disposed = false;
  try {
    const saved = JSON.parse(win.localStorage.getItem(KEY) || '{}');
    edge = saved.edge === true;
    if (saved.box && ['x', 'y', 'w', 'h'].every(key => Number.isFinite(saved.box[key]))) box = saved.box;
  } catch { /* Device preferences are optional. */ }
  const mobile = () => win.innerWidth <= 640;
  const dockWidth = () => typeof document !== 'undefined' && document === doc ? edgeDockWidth() : 0;
  const save = () => {
    try { win.localStorage.setItem(KEY, JSON.stringify({ edge, box })); } catch { /* Private mode. */ }
  };
  const clamp = (value: GripBox): GripBox => {
    const band = isDocked('comments') ? 0 : dockWidth();
    const rtl = doc.documentElement.dir === 'rtl';
    const start = rtl ? band : 0, end = win.innerWidth - (rtl ? 0 : band);
    const w = Math.min(Math.max(MIN.w, value.w), Math.max(120, end - start - GAP * 2));
    const h = Math.min(Math.max(MIN.h, value.h), Math.max(160, win.innerHeight - GAP * 2));
    return { w, h, x: Math.max(start + GAP, Math.min(value.x, end - GAP - w)), y: Math.max(GAP, Math.min(value.y, win.innerHeight - GAP - h)) };
  };
  const read = (): GripBox => {
    const rect = panel.getBoundingClientRect();
    return rect.width ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : clamp({ x: win.innerWidth - dockWidth() - 388, y: 80, w: 380, h: win.innerHeight - 96 });
  };
  const clear = () => {
    for (const key of ['left', 'top', 'width', 'height', 'inset-inline-end', 'max-width']) panel.style.removeProperty(key);
  };
  const apply = (value: GripBox) => {
    box = clamp(value);
    panel.style.left = `${Math.round(box.x)}px`; panel.style.top = `${Math.round(box.y)}px`;
    panel.style.width = `${Math.round(box.w)}px`; panel.style.height = `${Math.round(box.h)}px`;
    panel.style.removeProperty('inset-inline-end'); panel.style.removeProperty('max-width');
  };
  const tools = doc.createElement('span'); tools.className = 'collab-comment-panel-tools';
  const button = (label: string, glyph: IconName, run: () => void) => {
    const b = doc.createElement('button'); b.type = 'button'; b.className = 'btn btn--ghost collab-comment-icon';
    b.setAttribute('aria-label', label); b.title = label; b.innerHTML = icon(glyph); b.addEventListener('click', run); tools.append(b); return b;
  };
  const render = () => {
    const docked = isDocked('comments');
    panel.classList.toggle('is-edge-docked', docked);
    panel.classList.toggle('is-floating', !mobile() && !docked && !panel.hidden);
    dock.hidden = mobile() || docked || !edgeDockAvailable(); detach.hidden = mobile() || !docked;
    expand.hidden = mobile();
    if (mobile() || docked) clear(); else if (!panel.hidden && box) apply(box);
  };
  const float = () => {
    rememberScroll(); edge = false;
    if (isDocked('comments')) releaseDock('comments', 'user');
    box = clamp(box ?? read()); render(); save(); restoreScroll();
  };
  const enterEdge = () => {
    if (mobile()) return;
    rememberScroll(); box = clamp(box ?? read());
    if (requestDock('comments', panel, { icon: icon('messageCircle'), label: t('Comments'), onRelease: () => { render(); restoreScroll(); } })) { edge = true; render(); save(); restoreScroll(); }
  };
  const detach = button(t('Detach comments'), 'resize', float);
  const expand = button(t('Expand comments to full height'), 'arrowsV', () => {
    float(); apply({ ...(box ?? read()), y: GAP, h: win.innerHeight - GAP * 2 }); save();
  });
  const dock = button(t('Dock comments to the side'), 'dock', enterEdge);
  head.insertBefore(tools, close);
  panel.insertAdjacentHTML('beforeend', panelGripsHtml());
  const resizeOff = wirePanelGrips(panel, { read, apply, clamp, min: MIN, locked: () => mobile() || isDocked('comments'), onEnd: save });
  let drag: { x: number; y: number; box: GripBox; id: number } | undefined;
  const down = (event: PointerEvent) => {
    if (mobile() || event.button !== 0 || (event.target as Element).closest('button')) return;
    float(); drag = { x: event.clientX, y: event.clientY, box: box ?? read(), id: event.pointerId };
    try { head.setPointerCapture(event.pointerId); } catch { /* The pointer may have ended. */ }
    panel.classList.add('is-dragging'); event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!drag) return;
    apply({ ...drag.box, x: drag.box.x + event.clientX - drag.x, y: drag.box.y + event.clientY - drag.y });
    edgeDockPreview(edgeDockHitTest(event.clientX));
  };
  const end = (event: PointerEvent) => {
    if (!drag) return;
    try { if (head.hasPointerCapture(drag.id)) head.releasePointerCapture(drag.id); } catch { /* Already released. */ }
    drag = undefined; panel.classList.remove('is-dragging'); edgeDockPreview(false);
    if (event.type !== 'pointercancel' && edgeDockHitTest(event.clientX)) enterEdge(); else save();
  };
  const setOpen = (next: boolean) => {
    panel.hidden = !next;
    if (!next && isDocked('comments')) releaseDock('comments', 'host');
    if (next && edge && !mobile()) enterEdge();
    if (next && !mobile() && !isDocked('comments')) box = clamp(box ?? read());
    render();
  };
  const resized = () => {
    if (disposed) return;
    if (mobile() && isDocked('comments')) releaseDock('comments', 'host');
    if (!panel.hidden && edge && !mobile()) enterEdge();
    if (box) box = clamp(box); render(); restoreScroll();
  };
  head.addEventListener('pointerdown', down); head.addEventListener('pointermove', move);
  head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  win.addEventListener('resize', resized); render();
  return { setOpen, positioned: () => !mobile() && !panel.hidden,
    destroy() {
      disposed = true; releaseDock('comments', 'host'); resizeOff(); edgeDockPreview(false);
      head.removeEventListener('pointerdown', down); head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', end); head.removeEventListener('pointercancel', end);
      win.removeEventListener('resize', resized); conversation?.removeEventListener('scroll', rememberScroll); tools.remove();
      panel.querySelectorAll('[data-panel-grip]').forEach(grip => { grip.remove(); });
    },
  };
}
