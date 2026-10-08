// SPDX-License-Identifier: MPL-2.0
/** A page-owned receiver for the presentation clicker. Only its chosen parent can
 * send commands; replies contain capabilities and scroll depth, never page content. */
export type PresentDepth = { y: number; max: number };
export type PresentScrollTarget = number | string;
export type PresentArrow = 'ArrowUp' | 'ArrowDown';
export type PresentCommand = {
  type: 'lolly:present'; v: 1;
  kind: 'hello' | 'focus' | 'release' | 'key' | 'scroll' | 'slide' | 'handover';
  key?: PresentArrow; to?: PresentScrollTarget; state?: 'start' | 'stop'; hand?: boolean;
};
export const PRESENT_SCROLL_LIMIT = 1_000_000;
const hasControl = (text: string): boolean => Array.from(text).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
const scrollSurfaces = new WeakMap<Document, { element: Element; checked: number }>();

export function boundedPresentNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(PRESENT_SCROLL_LIMIT, Math.max(0, value)) : null;
}

export function validPresentTarget(value: unknown): PresentScrollTarget | null {
  if (typeof value === 'number') return boundedPresentNumber(value);
  if (typeof value !== 'string' || value.length > 129) return null;
  if (/^\d+(?:\.\d+)?%$/.test(value)) return `${Math.min(100, Math.max(0, Number(value.slice(0, -1))))}%`;
  return /^#[^\s#]+$/.test(value) && !hasControl(value) ? value : null;
}

/** Read a closed vocabulary into a prototype-free object. */
export function readPresentCommand(value: unknown): PresentCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const d = value as Record<string, unknown>;
  if (d.type !== 'lolly:present' || d.v !== 1 || typeof d.kind !== 'string') return null;
  const result = Object.assign(Object.create(null), { type: 'lolly:present', v: 1, kind: d.kind }) as PresentCommand;
  if (['hello', 'focus', 'release'].includes(d.kind)) return result;
  if (d.kind === 'key' && (d.key === 'ArrowUp' || d.key === 'ArrowDown')) { result.key = d.key; return result; }
  if (d.kind === 'scroll') {
    const to = validPresentTarget(d.to);
    if (to !== null) { result.to = to; return result; }
  }
  if (d.kind === 'slide' && (d.state === 'start' || d.state === 'stop')) { result.state = d.state; return result; }
  if (d.kind === 'handover' && typeof d.hand === 'boolean') { result.hand = d.hand; return result; }
  return null;
}

/** Find the document's scroll surface, or a visible inner panel with more room. */
export function presentScrollElement(doc: Document): Element | null {
  const now = doc.defaultView?.performance.now() ?? 0;
  const retained = scrollSurfaces.get(doc);
  if (retained?.element.isConnected && now - retained.checked < 1000) return retained.element;
  let best = doc.scrollingElement ?? doc.documentElement;
  if (!best) return null;
  let score = Math.max(0, best.scrollHeight - best.clientHeight);
  for (const el of Array.from(doc.querySelectorAll('*')).slice(0, 5000)) {
    const room = el.scrollHeight - el.clientHeight;
    if (room <= 0 || el.clientHeight <= 0 || el.clientWidth <= 0) continue;
    const style = doc.defaultView?.getComputedStyle(el);
    if (!style || !/^(auto|scroll|overlay)$/.test(style.overflowY) || style.visibility === 'hidden') continue;
    const weight = room * Math.min(1, el.clientWidth / Math.max(1, doc.documentElement.clientWidth));
    if (weight > score) { best = el; score = weight; }
  }
  scrollSurfaces.set(doc, { element: best, checked: now });
  return best;
}

export function readPresentDepth(doc: Document): PresentDepth {
  const el = presentScrollElement(doc);
  const max = boundedPresentNumber(el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0) ?? 0;
  return { y: Math.min(max, boundedPresentNumber(el?.scrollTop ?? 0) ?? 0), max };
}

export function scrollPresentPage(doc: Document, value: PresentScrollTarget): boolean {
  const to = validPresentTarget(value), el = presentScrollElement(doc);
  if (to === null || !el) return false;
  const max = boundedPresentNumber(Math.max(0, el.scrollHeight - el.clientHeight)) ?? 0;
  let y: number;
  if (typeof to === 'number') y = to;
  else if (!to.startsWith('#') && to.endsWith('%')) y = max * Number(to.slice(0, -1)) / 100;
  else {
    let id = to.slice(1);
    try { id = decodeURIComponent(id); } catch { /* a literal percent in an element id */ }
    const target = doc.getElementById(id);
    if (!target) return false;
    const pageRoot = el === doc.scrollingElement || el === doc.documentElement;
    y = el.scrollTop + target.getBoundingClientRect().top - (pageRoot ? 0 : el.getBoundingClientRect().top);
  }
  el.scrollTop = Math.min(max, Math.max(0, y));
  return true;
}

/** Synthetic keys call page handlers. Their uncancelled browser scroll is explicit. */
export function dispatchPresentKey(win: Window, key: PresentArrow): boolean {
  const target = win.document.activeElement ?? win.document.body;
  if (!target) return false;
  const Keyboard = (win as Window & typeof globalThis).KeyboardEvent;
  const permitted = target.dispatchEvent(new Keyboard('keydown', { key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new Keyboard('keyup', { key, bubbles: true, cancelable: true }));
  if (permitted) scrollPresentPage(win.document, readPresentDepth(win.document).y + (key === 'ArrowDown' ? 40 : -40));
  return true;
}

export interface PresentReceiverOptions {
  /** Exact origins allowed to frame this page. Defaults to this page's own origin. */
  allowedOrigins?: readonly string[];
  /** A page can provide lifecycle reactions without granting access to its content. */
  onLifecycle?: (kind: 'focus' | 'release' | 'slide' | 'handover', command: PresentCommand) => void;
  /** The Sandbox owns a narrower relay to its opaque preview. */
  shouldHandle?: () => boolean;
}

export function attachPresentReceiver(win: Window = window, options: PresentReceiverOptions = {}): () => void {
  const origins = new Set((options.allowedOrigins ?? [win.location.origin]).filter(origin => {
    try { const u = new URL(origin); return u.origin === origin && (u.protocol === 'https:' || u.protocol === 'http:'); } catch { return false; }
  }));
  let parentOrigin = '', pending = 0, handed = false;
  const send = (data: Record<string, unknown>): void => {
    if (parentOrigin) win.parent.postMessage({ type: 'lolly:present', v: 1, ...data }, parentOrigin);
  };
  const depth = (): void => { pending = 0; send({ kind: 'depth', ...readPresentDepth(win.document) }); };
  const changed = (): void => { if (!pending && parentOrigin) pending = win.requestAnimationFrame(depth); };
  const onMessage = (event: MessageEvent): void => {
    if (win.parent === win || event.source !== win.parent || !origins.has(event.origin) || options.shouldHandle?.() === false) return;
    const command = readPresentCommand(event.data);
    if (!command) return;
    parentOrigin = event.origin;
    if (command.kind === 'hello') { send({ kind: 'ready', can: ['key', 'scroll', 'depth'] }); depth(); }
    else if (command.kind === 'key') { dispatchPresentKey(win, command.key!); depth(); }
    else if (command.kind === 'scroll') { scrollPresentPage(win.document, command.to!); depth(); }
    else {
      if (command.kind === 'handover') handed = command.hand === true;
      if (command.kind === 'release' || (command.kind === 'slide' && command.state === 'stop')) handed = false;
      options.onLifecycle?.(command.kind, command);
    }
  };
  const deckKey = (event: KeyboardEvent): void => {
    if (!handed || !['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    win.parent.postMessage({ type: 'lolly:deck-key', key: event.key }, parentOrigin);
  };
  win.addEventListener('message', onMessage);
  win.addEventListener('scroll', changed, true);
  win.addEventListener('resize', changed);
  win.addEventListener('keydown', deckKey, true);
  return () => {
    win.removeEventListener('message', onMessage);
    win.removeEventListener('scroll', changed, true);
    win.removeEventListener('resize', changed);
    win.removeEventListener('keydown', deckKey, true);
    scrollSurfaces.delete(win.document);
    if (pending) win.cancelAnimationFrame(pending);
  };
}
