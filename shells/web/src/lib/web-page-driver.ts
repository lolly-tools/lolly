// SPDX-License-Identifier: MPL-2.0
/** One retained driver per web frame. A page can report only its capabilities and
 * scroll depth; neither a receiver nor an outside page can edit the document. */
import {
  boundedPresentNumber, dispatchPresentKey, readPresentDepth, scrollPresentPage, validPresentTarget,
  type PresentArrow, type PresentDepth, type PresentScrollTarget,
} from '../../../../packages/core/src/present-receiver.ts';
import { parsePresentInteractOpts, type PresentInteractOptions } from '../../../../engine/src/present-interact.ts';

export type WebPageOptions = Pick<PresentInteractOptions, 'mode' | 'pageLength' | 'start'>;
export interface WebPageCapabilities {
  backend: 'same-origin' | 'receiver' | 'outside';
  key: boolean; scroll: boolean; depth: boolean; checking: boolean;
}
export interface WebPageDriver {
  readonly frame: HTMLIFrameElement;
  readonly capabilities: WebPageCapabilities;
  depth(): PresentDepth | null;
  key(key: PresentArrow): boolean;
  scrollTo(to: PresentScrollTarget): boolean;
  configure(options?: WebPageOptions): void;
  setFocused(on: boolean): void;
  setSlideActive(on: boolean): void;
  handKeyboard(on: boolean): void;
  subscribe(callback: () => void): () => void;
  destroy(): void;
}
const byFrame = new WeakMap<HTMLIFrameElement, WebPageDriver>();
const byMarker = new WeakMap<HTMLElement, WebPageDriver>();
const disposedFrames = new WeakSet<HTMLIFrameElement>();

export function getWebPageDriver(marker: HTMLElement): WebPageDriver | null {
  const frame = marker.querySelector<HTMLIFrameElement>('iframe[data-web-live]');
  const current = byMarker.get(marker);
  return current && current.frame === frame ? current : frame && !disposedFrames.has(frame) ? createWebPageDriver(frame, marker) : null;
}

/** Frame moves use Element.moveBefore, preserving the page and this driver. */
export function createWebPageDriver(frame: HTMLIFrameElement, marker: HTMLElement): WebPageDriver {
  const retained = byFrame.get(frame);
  if (retained) { byMarker.set(marker, retained); retained.configure(); return retained; }
  const driver = new FrameDriver(frame, marker);
  disposedFrames.delete(frame);
  byFrame.set(frame, driver); byMarker.set(marker, driver);
  driver.start();
  return driver;
}

class FrameDriver implements WebPageDriver {
  readonly frame: HTMLIFrameElement;
  private marker: HTMLElement;
  private win: Window;
  private origin: string;
  private caps: WebPageCapabilities = { backend: 'outside', key: false, scroll: false, depth: false, checking: true };
  private options: WebPageOptions = { mode: 'none', pageLength: 0, start: 0 };
  private reported: PresentDepth | null = null;
  private panY = 0;
  private callbacks = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private hellos: ReturnType<typeof setTimeout>[] = [];
  private unwatch: (() => void) | null = null;
  private focused = false;
  private active = false;
  private disposed = false;
  private placesUnavailable = false;
  private greeted = false;
  constructor(frame: HTMLIFrameElement, marker: HTMLElement) {
    this.frame = frame; this.marker = marker;
    this.win = marker.ownerDocument.defaultView!;
    this.origin = new URL(frame.src, this.win.location.href).origin;
    frame.addEventListener('load', this.loaded);
    this.win.addEventListener('message', this.message);
    this.configure();
  }
  start(): void { this.loaded(); }
  get capabilities(): WebPageCapabilities {
    const caps = { ...this.caps };
    if (caps.backend === 'outside') {
      caps.scroll = (this.options.mode === 'pan' && this.options.pageLength > 0) || (this.options.mode === 'places' && !this.placesUnavailable);
      caps.depth = this.options.mode === 'pan' && this.options.pageLength > 0;
    }
    return caps;
  }
  private emit(): void { for (const cb of this.callbacks) cb(); }
  private capabilitiesChanged(): void {
    this.paintFrame();
    const Event = (this.win as Window & typeof globalThis).CustomEvent;
    this.marker.dispatchEvent(new Event('lolly:web-driver-change', { bubbles: true }));
    this.emit();
  }
  private page(): Document | null {
    try {
      if (this.origin !== this.win.location.origin || this.frame.dataset.webProvider === 'sandbox') return null;
      const doc = this.frame.contentDocument;
      return doc?.documentElement && doc.defaultView?.location.origin === this.origin ? doc : null;
    } catch { return null; }
  }
  private send(kind: string, fields: Record<string, unknown> = {}): boolean {
    if (this.disposed || !this.frame.contentWindow || !/^https?:\/\//.test(this.origin)) return false;
    try { this.frame.contentWindow.postMessage({ type: 'lolly:present', v: 1, kind, ...fields }, this.origin); return true; } catch { return false; }
  }
  private watchPage(doc: Document): void {
    const changed = (): void => this.emit();
    doc.addEventListener('scroll', changed, true);
    doc.defaultView?.addEventListener('resize', changed);
    this.unwatch = () => {
      doc.removeEventListener('scroll', changed, true);
      try { doc.defaultView?.removeEventListener('resize', changed); } catch { /* the frame navigated to another origin */ }
    };
  }
  private loaded = (): void => {
    if (this.disposed) return;
    this.unwatch?.(); this.unwatch = null; this.reported = null; this.placesUnavailable = false; this.greeted = false;
    this.hellos.forEach(clearTimeout); this.hellos = [];
    if (this.timer) clearTimeout(this.timer);
    const doc = this.page();
    this.caps = { backend: doc ? 'same-origin' : 'outside', key: !!doc, scroll: !!doc, depth: !!doc, checking: !doc };
    if (doc) this.watchPage(doc);
    this.send('hello'); this.send(this.focused ? 'focus' : 'release');
    this.hellos = [120, 400, 1000, 2500, 5000].map(ms => setTimeout(() => { if (!this.greeted) this.send('hello'); }, ms));
    this.send('slide', { state: this.active ? 'start' : 'stop' });
    if (doc || this.options.mode === 'pan' || this.options.mode === 'places') this.scrollTo(this.options.start);
    this.timer = setTimeout(() => { this.caps.checking = false; this.capabilitiesChanged(); }, 1800);
    this.capabilitiesChanged();
  };
  private message = (event: MessageEvent): void => {
    if (this.disposed || event.source !== this.frame.contentWindow || event.origin !== this.origin) return;
    const d: unknown = event.data;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return;
    const value: Record<string, unknown> = Object.create(null);
    for (const key of ['type', 'v', 'kind', 'can', 'y', 'max']) value[key] = (d as Record<string, unknown>)[key];
    if (value.type !== 'lolly:present' || value.v !== 1) return;
    if (value.kind === 'ready' && Array.isArray(value.can)) {
      const can = value.can.slice(0, 3).filter(item => item === 'key' || item === 'scroll' || item === 'depth');
      this.caps = { backend: this.page() ? 'same-origin' : 'receiver', key: can.includes('key'), scroll: can.includes('scroll'), depth: can.includes('depth'), checking: false };
      if (this.timer) clearTimeout(this.timer);
      const first = !this.greeted; this.greeted = true;
      this.hellos.forEach(clearTimeout); this.hellos = [];
      if (first) this.scrollTo(this.options.start);
      this.send(this.focused ? 'focus' : 'release');
      this.send('slide', { state: this.active ? 'start' : 'stop' });
      this.capabilitiesChanged();
    } else if (value.kind === 'depth' && this.caps.depth && this.caps.backend === 'receiver') {
      const y = boundedPresentNumber(value.y), max = boundedPresentNumber(value.max);
      if (y === null || max === null) return;
      this.reported = { y: Math.min(y, max), max }; this.emit();
    }
  };
  private viewport(): { width: number; height: number; scale: number } {
    const width = Math.max(1, this.marker.clientWidth);
    const view = boundedPresentNumber(Number(this.marker.dataset.webView)) || width;
    const scale = width / view;
    return { width: view, height: Math.max(1, this.marker.clientHeight / scale), scale };
  }
  private panMax(): number { return Math.max(0, Math.min(1_000_000, this.options.pageLength) - this.viewport().height); }
  private paintFrame(): void {
    const view = this.viewport();
    if (this.options.mode !== 'pan' || this.caps.backend !== 'outside' || this.options.pageLength <= 0) {
      const explicitWidth = Number(this.marker.dataset.webView) > 0;
      this.frame.style.width = explicitWidth ? `${view.width}px` : '100%';
      this.frame.style.height = explicitWidth ? `${view.height}px` : '100%';
      this.frame.style.transform = explicitWidth ? `scale(${view.scale})` : '';
      return;
    }
    this.panY = Math.min(this.panMax(), Math.max(0, this.panY));
    this.frame.style.width = `${view.width}px`;
    this.frame.style.height = `${Math.max(view.height, this.options.pageLength)}px`;
    this.frame.style.transform = `scale(${view.scale}) translateY(${-this.panY}px)`;
    this.frame.style.transformOrigin = '0 0';
  }
  depth(): PresentDepth | null {
    const doc = this.page();
    if (doc) return readPresentDepth(doc);
    if (this.caps.backend === 'receiver') return this.reported ? { ...this.reported } : null;
    return this.options.mode === 'pan' ? { y: this.panY, max: this.panMax() } : null;
  }
  key(key: PresentArrow): boolean {
    if (key !== 'ArrowUp' && key !== 'ArrowDown') return false;
    const doc = this.page();
    if (doc?.defaultView) { const result = dispatchPresentKey(doc.defaultView, key); this.emit(); return result; }
    return this.caps.key && this.caps.backend === 'receiver' && this.send('key', { key });
  }
  scrollTo(value: PresentScrollTarget): boolean {
    const to = validPresentTarget(value);
    if (to === null) return false;
    const doc = this.page();
    if (doc) { const result = scrollPresentPage(doc, to); this.emit(); return result; }
    if (this.caps.backend === 'receiver') return this.caps.scroll && this.send('scroll', { to });
    if (this.options.mode === 'pan' && (typeof to === 'number' || (!to.startsWith('#') && to.endsWith('%')))) {
      if (this.options.pageLength <= 0) return false;
      this.panY = typeof to === 'number' ? to : this.panMax() * Number(to.slice(0, -1)) / 100;
      this.paintFrame(); this.emit(); return true;
    }
    if (this.options.mode === 'places' && typeof to === 'string' && to.startsWith('#')) {
      try {
        const address = new URL(this.frame.src); address.hash = to;
        this.frame.contentWindow?.location.replace(address.href); return true;
      } catch { this.placesUnavailable = true; this.capabilitiesChanged(); return false; }
    }
    return false;
  }
  configure(options?: WebPageOptions): void {
    const freshMarker = this.frame.parentElement;
    if (freshMarker) { this.marker = freshMarker; byMarker.set(freshMarker, this); }
    this.options = options ? { ...options } : parsePresentInteractOpts(this.marker.dataset.interactOpts) ?? { mode: 'none', pageLength: 0, start: 0 };
    this.paintFrame();
  }
  setFocused(on: boolean): void { this.focused = on; this.send(on ? 'focus' : 'release'); }
  setSlideActive(on: boolean): void { if (this.active !== on) { this.active = on; this.send('slide', { state: on ? 'start' : 'stop' }); } }
  handKeyboard(on: boolean): void {
    this.send('handover', { hand: on }); this.frame.tabIndex = on ? 0 : -1;
    if (on && this.frame.ownerDocument.activeElement !== this.frame) this.frame.focus();
  }
  subscribe(callback: () => void): () => void { this.callbacks.add(callback); return () => { this.callbacks.delete(callback); }; }
  destroy(): void {
    if (this.disposed) return;
    this.setFocused(false); this.setSlideActive(false); this.disposed = true;
    this.frame.removeEventListener('load', this.loaded); this.win.removeEventListener('message', this.message);
    this.unwatch?.(); if (this.timer) clearTimeout(this.timer); this.hellos.forEach(clearTimeout);
    this.callbacks.clear(); byFrame.delete(this.frame); byMarker.delete(this.marker); disposedFrames.add(this.frame);
    const Event = (this.win as Window & typeof globalThis).CustomEvent;
    this.marker.dispatchEvent(new Event('lolly:web-driver-change', { bubbles: true }));
  }
}
