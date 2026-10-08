// SPDX-License-Identifier: MPL-2.0
import { parsePresentInteractOpts, pickPresentInteractStop, resolvePresentInteractStops, samplePresentInteractAuto, type PresentInteractDepth, type PresentInteractOptions } from '../../../../engine/src/present-interact.ts';
import { kfEaseAt } from '../../../../engine/src/keyframes.ts';
import { getWebPageDriver, type WebPageDriver } from '../lib/web-page-driver.ts';
import { webFrameState } from '../lib/design-web-mount.ts';
import { parseWebEmbed } from '../../../../engine/src/web-embed.ts';
import { t } from '../i18n.ts';

const MARKER = '.lolly-box-web[data-lolly-web][data-interact]';
export function interactionStep(marker: Element): number | null {
  const raw = marker.getAttribute('data-interact');
  if (raw === null || !raw.trim()) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : null;
}

/** Focus clicks share the same address space as fragment builds. */
export function presentBuildSteps(page: Element, kiosk = false): number[] {
  const set = new Set<number>();
  for (const box of page.querySelectorAll('[data-build]')) {
    const n = Number(box.getAttribute('data-build'));
    if (Number.isFinite(n) && n >= 1) set.add(n);
  }
  if (!kiosk) for (const marker of page.querySelectorAll(MARKER)) {
    const n = interactionStep(marker);
    if (n !== null && n > 0) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export interface PresentInteractState { index: number; build: number; paused: boolean; overview: boolean }
export interface PresentInteractConfig {
  stage: HTMLElement;
  pages: readonly HTMLElement[];
  reduced: boolean;
  kiosk: boolean;
  load(marker: HTMLElement): void;
  /** Tests can provide a driver without creating a real frame. */
  driver?(marker: HTMLElement): WebPageDriver | null;
}
export interface PresentInteractController {
  sync(state: PresentInteractState): void;
  key(event: KeyboardEvent, key?: string): boolean;
  walk(direction: 1 | -1): boolean;
  speaker(root: HTMLElement): void;
  release(): void;
  returnKeyboard(): void;
  readonly active: HTMLElement | null;
  destroy(): void;
}
interface Visit {
  marker: HTMLElement; opts: PresentInteractOptions; driver: WebPageDriver | null;
  unsubscribe: (() => void) | null; elapsed: number; stamp: number | null;
  started: boolean; manual: boolean; done: boolean; stop: number | null;
  lastTo: PresentInteractDepth | null;
  move: { from: number; to: number; elapsed: number; stamp: number | null } | null;
}

export function mountPresentInteract(config: PresentInteractConfig): PresentInteractController {
  const { stage, pages, reduced, kiosk } = config;
  const doc = stage.ownerDocument, win = doc.defaultView!;
  const findDriver = config.driver ?? getWebPageDriver;
  let state: PresentInteractState = { index: -1, build: 0, paused: false, overview: false };
  let visits: Visit[] = [], current: Visit | null = null;
  let suppressed = '', handed = false, guardAttempts = 0, destroyed = false;
  let frameId: number | null = null, blurTimer: ReturnType<typeof setTimeout> | null = null;
  let returnFrameId: number | null = null;
  let speakerRoot: HTMLElement | null = null, pointerAt = 0, pointerFrame: HTMLIFrameElement | null = null;
  let scrim: HTMLElement | null = null;
  const requestFrame = typeof win.requestAnimationFrame === 'function' ? win.requestAnimationFrame.bind(win)
    : (callback: FrameRequestCallback): number => win.setTimeout(() => callback(win.performance.now()), 16);
  const cancelFrame = typeof win.cancelAnimationFrame === 'function' ? win.cancelAnimationFrame.bind(win) : win.clearTimeout.bind(win);
  const keyOf = (index: number, build: number): string => `${index}:${build}`;

  function dimensions(visit: Visit): { scrollMax: number; boxHeight: number } {
    const frame = visit.marker.querySelector<HTMLIFrameElement>('iframe[data-web-live]');
    const box = visit.marker.closest<HTMLElement>('.lolly-box') ?? visit.marker;
    const width = box.clientWidth || parseFloat(box.style.width) || 1;
    const height = box.clientHeight || parseFloat(box.style.height) || 720;
    const virtualWidth = parseFloat(frame?.style.width ?? '') || Number(visit.marker.dataset.webView) || width;
    const boxHeight = height * virtualWidth / width;
    return { scrollMax: visit.driver?.depth()?.max ?? 0, boxHeight };
  }

  function makeVisit(marker: HTMLElement): Visit | null {
    const opts = parsePresentInteractOpts(marker.dataset.interactOpts);
    if (!opts || interactionStep(marker) === null) return null;
    return { marker, opts, driver: null, unsubscribe: null, elapsed: 0, stamp: null,
      started: false, manual: false, done: false, stop: null, lastTo: null, move: null };
  }

  function connect(visit: Visit): void {
    const driver = findDriver(visit.marker);
    if (driver === visit.driver) return;
    visit.unsubscribe?.(); visit.unsubscribe = null;
    visit.driver = driver;
    if (!driver) return;
    driver.configure(visit.opts); driver.setSlideActive(!state.overview);
    driver.setFocused(current === visit); driver.handKeyboard(current === visit && handed);
    visit.unsubscribe = driver.subscribe(() => { paintSpeaker(); schedule(); });
    if (!(visit.opts.keep && visit.marker.dataset.webLoad === 'keep')) driver.scrollTo(visit.opts.start);
    const frame = visit.marker.querySelector<HTMLIFrameElement>('iframe[data-web-live]');
    if (frame) frame.tabIndex = handed && current === visit ? 0 : -1;
  }

  function stopVisits(): void {
    clearHighlight();
    for (const visit of visits) {
      visit.driver?.setSlideActive(false); visit.unsubscribe?.();
      visit.move = null; visit.stamp = null;
    }
    visits = [];
  }

  function highlightLayer(visit: Visit): HTMLElement {
    return visit.marker.closest<HTMLElement>('.lolly-box') ?? visit.marker;
  }
  function clearHighlight(): void {
    if (current) {
      current.driver?.setFocused(false); current.driver?.handKeyboard(false);
      current.marker.classList.remove('pr-interact-ring', 'pr-interact-focus');
      current.marker.style.removeProperty('--pr-interact-color');
      highlightLayer(current).classList.remove('pr-interact-layer');
    }
    const page = pages[state.index];
    page?.classList.remove('pr-interact-zoom');
    for (const prop of ['--pr-interact-scale', '--pr-interact-x', '--pr-interact-y']) page?.style.removeProperty(prop);
    scrim?.remove(); scrim = null;
    current = null; handed = false;
    stage.classList.remove('pr-interact-on');
  }

  function zoom(visit: Visit): void {
    const page = pages[state.index];
    if (!page) return;
    const box = highlightLayer(visit);
    const pageRect = page.getBoundingClientRect(), boxRect = box.getBoundingClientRect();
    const pw = parseFloat(page.style.width) || page.clientWidth || 1920;
    const ph = parseFloat(page.style.height) || page.clientHeight || 1080;
    const scale = pageRect.width > 0 ? pageRect.width / pw : Number(page.style.getPropertyValue('--pr-scale')) || 1;
    const bw = boxRect.width / scale || parseFloat(box.style.width) || pw;
    const bh = boxRect.height / scale || parseFloat(box.style.height) || ph;
    const x = pageRect.width ? (boxRect.left - pageRect.left) / scale : parseFloat(box.style.left) || 0;
    const y = pageRect.height ? (boxRect.top - pageRect.top) / scale : parseFloat(box.style.top) || 0;
    const fit = Math.min((stage.clientWidth || win.innerWidth) / bw, (stage.clientHeight || win.innerHeight) / bh) * 0.9;
    page.style.setProperty('--pr-interact-scale', String(Math.max(0.01, Math.min(100, fit))));
    page.style.setProperty('--pr-interact-x', `${pw / 2 - x - bw / 2}px`);
    page.style.setProperty('--pr-interact-y', `${ph / 2 - y - bh / 2}px`);
    page.classList.add('pr-interact-zoom');
  }

  function arm(visit: Visit): void {
    if (current === visit) return;
    clearHighlight(); current = visit; guardAttempts = 0;
    stage.classList.add('pr-interact-on'); visit.marker.classList.add('pr-interact-focus');
    const color = visit.opts.highlightColor;
    visit.marker.style.setProperty('--pr-interact-color', color.startsWith('#') ? color : `var(--brand-${color.replaceAll('.', '-')}, var(--brand-primary, #4c8dff))`);
    const effect = reduced && visit.opts.highlight === 'zoom' ? 'ring' : visit.opts.highlight;
    if (effect === 'ring' || effect === 'spotlight') visit.marker.classList.add('pr-interact-ring');
    if (effect === 'spotlight') {
      scrim = doc.createElement('div'); scrim.className = 'pr-interact-scrim';
      scrim.setAttribute('aria-hidden', 'true'); pages[state.index]?.appendChild(scrim);
      highlightLayer(visit).classList.add('pr-interact-layer');
    }
    if (effect === 'zoom') zoom(visit);
    config.load(visit.marker); connect(visit); visit.driver?.setFocused(true);
    if (visit.opts.auto === 'focus' && !visit.manual && !visit.started) visit.started = true;
    stage.focus({ preventScroll: true }); paintSpeaker(); schedule();
  }

  function sync(next: PresentInteractState): void {
    if (destroyed) return;
    const changedPage = next.index !== state.index;
    if (changedPage) stopVisits();
    if (keyOf(next.index, next.build) !== keyOf(state.index, state.build)) suppressed = '';
    state = { ...next };
    if (changedPage) {
      visits = [...(pages[state.index]?.querySelectorAll<HTMLElement>(MARKER) ?? [])].map(makeVisit).filter((visit): visit is Visit => visit !== null);
      for (const visit of visits) visit.started = visit.opts.auto === 'open';
    }
    for (const visit of visits) {
      connect(visit); visit.driver?.setSlideActive(!state.overview);
      if (state.paused || state.overview) {
        visit.stamp = null; if (visit.move) visit.move.stamp = null;
      }
    }
    const focus = !kiosk && !state.overview && suppressed !== keyOf(state.index, state.build)
      ? visits.find((visit) => interactionStep(visit.marker) === state.build && Number(visit.marker.closest('[data-build]')?.getAttribute('data-build') ?? 0) <= state.build) : undefined;
    if (focus) arm(focus); else clearHighlight();
    paintSpeaker(); schedule();
  }

  function release(): void {
    suppressed = keyOf(state.index, state.build);
    clearHighlight(); paintSpeaker(); stage.focus({ preventScroll: true });
  }

  function moveTo(visit: Visit, to: PresentInteractDepth): boolean {
    const driver = visit.driver;
    if (!driver?.capabilities.scroll) return false;
    const depth = driver.depth();
    const target = resolvePresentInteractStops([to], dimensions(visit))[0]?.y;
    if (reduced || !visit.opts.scrollMs || !depth || target == null) return driver.scrollTo(to);
    visit.move = { from: depth.y, to: target, elapsed: 0, stamp: null }; schedule(); return true;
  }
  function manualMove(direction: 1 | -1, walk = false): boolean {
    const visit = current;
    if (!visit) return false;
    visit.manual = true; visit.move = null;
    if (!visit.driver) return !walk;
    if (walk && !visit.driver.capabilities.scroll) return false;
    if (!walk && visit.opts.keys === 'key' && visit.driver.capabilities.key) {
      visit.driver.key(direction === 1 ? 'ArrowDown' : 'ArrowUp'); return true;
    }
    const stops = resolvePresentInteractStops(visit.opts.stops, dimensions(visit));
    if (stops.length) {
      const position = visit.stop === null ? visit.driver.depth()?.y ?? visit.opts.start : stops[visit.stop]?.depth ?? visit.opts.start;
      const target = pickPresentInteractStop(stops, position, direction);
      if (!target) return !walk;
      if (!moveTo(visit, target.depth)) return !walk;
      visit.stop = target.index; paintSpeaker(); return true;
    }
    if (walk) return false;
    const depth = visit.driver.depth();
    if (depth) moveTo(visit, Math.max(0, Math.min(depth.max, depth.y + dimensions(visit).boxHeight * 0.8 * direction)));
    return true;
  }
  function walk(direction: 1 | -1): boolean {
    return !!current?.opts.walk && current.opts.stops.length > 0 && manualMove(direction, true);
  }
  function key(event: KeyboardEvent, keyName = event.key): boolean {
    if (keyName === 'F5') return true;
    if (!current || state.overview) return false;
    if (keyName === 'Escape') { release(); return true; }
    if (keyName === 'Enter' && current.opts.hand && current.driver) {
      handed = true; current.driver.handKeyboard(true);
      const frame = current.marker.querySelector<HTMLIFrameElement>('iframe[data-web-live]');
      if (frame) { frame.tabIndex = 0; frame.focus({ preventScroll: true }); }
      paintSpeaker(); return true;
    }
    if (current.opts.keys !== 'none' && (keyName === 'ArrowUp' || keyName === 'ArrowDown')) return manualMove(keyName === 'ArrowDown' ? 1 : -1);
    return false;
  }

  function schedule(): void {
    if (destroyed || frameId !== null || state.paused || state.overview) return;
    if (!visits.some((visit) => visit.driver && (visit.move || (visit.started && !visit.manual && !visit.done && (visit.opts.auto !== 'focus' || current === visit))))) return;
    frameId = requestFrame(tick);
  }
  function tick(now: number): void {
    frameId = null;
    if (destroyed || state.paused || state.overview) return;
    for (const visit of visits) {
      if (!visit.driver) continue;
      if (visit.move) {
        const move = visit.move;
        if (move.stamp !== null) move.elapsed += Math.max(0, Math.min(100, now - move.stamp));
        move.stamp = now;
        const progress = Math.min(1, move.elapsed / Math.max(1, visit.opts.scrollMs));
        visit.driver.scrollTo(move.from + (move.to - move.from) * kfEaseAt(visit.opts.ease, progress));
        if (progress >= 1) visit.move = null;
        continue;
      }
      if (!visit.started || visit.manual || visit.done || (visit.opts.auto === 'focus' && current !== visit)) { visit.stamp = null; continue; }
      if (visit.stamp !== null) visit.elapsed += Math.max(0, Math.min(100, now - visit.stamp));
      visit.stamp = now;
      const sample = samplePresentInteractAuto(visit.opts, visit.elapsed, dimensions(visit), { reducedMotion: reduced });
      if (sample.to !== visit.lastTo) { visit.driver.scrollTo(sample.to); visit.lastTo = sample.to; }
      visit.stop = sample.stopIndex; visit.done = sample.done;
    }
    paintSpeaker(); schedule();
  }

  function statusText(visit: Visit): string {
    if (!visit.driver) {
      const verdict = webFrameState(parseWebEmbed(visit.marker.dataset.lollyWeb ?? '', { appOrigin: win.location.origin }), 'editor');
      if (verdict === 'ask') return t('This site is not trusted. The slide shows its picture.');
      if (verdict === 'policy') return t('Your workspace blocks this site. The slide shows its picture.');
      if (verdict === 'refused') return t('This site does not allow being shown inside other pages.');
      if (verdict === 'blocked' || verdict === 'browser') return t('This browser cannot show the page here. The slide shows its picture.');
      return t('The page is not live. The slide shows its picture.');
    }
    if (handed) return t('The page has the keyboard. Use Back to slides to take it back.');
    if (visit.opts.keys === 'none') return t('Up and Down keep moving through the slide stack.');
    if (visit.driver.capabilities.checking) return t('Checking the page…');
    if (visit.opts.keys === 'key' && visit.driver.capabilities.key) return t('Up and Down go to the demo.');
    if (!visit.driver.capabilities.scroll) return t('This page cannot scroll here. The clicker still moves the slides.');
    return visit.opts.keys === 'key' ? t('This page cannot receive keys. Up and Down scroll instead.') : t('Up and Down scroll the page.');
  }
  function paintSpeaker(): void {
    if (!speakerRoot?.isConnected) return;
    const currentId = current?.marker.closest<HTMLElement>('.lolly-box')?.dataset.boxId;
    for (const marker of speakerRoot.querySelectorAll<HTMLElement>('.pr-sp-now .lolly-box-web[data-lolly-web]')) {
      const focused = !!current && (currentId ? marker.closest<HTMLElement>('.lolly-box')?.dataset.boxId === currentId : marker.dataset.lollyWeb === current.marker.dataset.lollyWeb);
      marker.classList.toggle('pr-interact-focus', focused);
      if (!focused) marker.classList.remove('pr-interact-ring');
      else marker.style.setProperty('--pr-interact-color', current!.marker.style.getPropertyValue('--pr-interact-color'));
    }
    let panel = speakerRoot.querySelector<HTMLElement>('.pr-sp-interact');
    if (!current) { panel?.remove(); return; }
    if (!panel) {
      panel = speakerRoot.ownerDocument.createElement('section'); panel.className = 'pr-sp-interact';
      panel.setAttribute('aria-label', t('Interactive page'));
      const title = speakerRoot.ownerDocument.createElement('strong'); title.className = 'pr-sp-interact-title';
      const info = speakerRoot.ownerDocument.createElement('span'); info.className = 'pr-sp-interact-info';
      const depth = speakerRoot.ownerDocument.createElement('span'); depth.className = 'pr-sp-interact-depth';
      const releaseButton = speakerRoot.ownerDocument.createElement('button'); releaseButton.type = 'button';
      releaseButton.className = 'btn btn--sm'; releaseButton.textContent = t('Release page'); releaseButton.addEventListener('click', release);
      panel.append(title, info, depth, releaseButton); speakerRoot.querySelector('.pr-sp-aside')?.prepend(panel);
    }
    panel.querySelector('.pr-sp-interact-title')!.textContent = current.marker.dataset.webTitle || t('Interactive page');
    panel.querySelector('.pr-sp-interact-info')!.textContent = statusText(current);
    const depth = current.driver?.depth();
    panel.querySelector('.pr-sp-interact-depth')!.textContent = current.stop !== null && current.opts.stops.length
      ? t('Stop {n} of {total}', { n: current.stop + 1, total: current.opts.stops.length })
      : depth ? t('Page depth: {n}%', { n: Math.round(depth.max > 0 ? depth.y / depth.max * 100 : 0) }) : '';
  }
  function speaker(root: HTMLElement): void { speakerRoot = root; paintSpeaker(); }

  const onPointer = (event: PointerEvent): void => {
    if (!event.isTrusted || !current) return;
    const frame = current.marker.querySelector<HTMLIFrameElement>('iframe[data-web-live]');
    const rect = frame?.getBoundingClientRect();
    if (frame && rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
      pointerAt = Date.now(); pointerFrame = frame;
    } else { pointerAt = 0; pointerFrame = null; }
  };
  const onBlur = (): void => {
    if (blurTimer) clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      blurTimer = null;
      if (destroyed || !current || handed || state.overview) return;
      const frame = current.marker.querySelector<HTMLIFrameElement>('iframe[data-web-live]');
      if (!frame || doc.activeElement !== frame) return;
      if (current.opts.hand && pointerFrame === frame && Date.now() - pointerAt < 500) { handed = true; current.driver?.handKeyboard(true); paintSpeaker(); return; }
      if (guardAttempts++ < 3) stage.focus({ preventScroll: true });
      else { stage.classList.add('pr-embed-focus'); handed = true; paintSpeaker(); }
    }, 0);
  };
  const onReturn = (event: Event): void => {
    if ((event.target as Element | null)?.closest('.pr-embed-return')) returnKeyboard();
  };
  function returnKeyboard(): void {
    handed = false; guardAttempts = 0; current?.driver?.handKeyboard(false);
    const frame = current?.marker.querySelector<HTMLIFrameElement>('iframe[data-web-live]'); if (frame) frame.tabIndex = -1;
    stage.focus({ preventScroll: true });
    if (returnFrameId !== null) cancelFrame(returnFrameId);
    returnFrameId = requestFrame(() => {
      returnFrameId = null;
      if (!destroyed && !handed && (doc.activeElement === doc.body || doc.activeElement === doc.documentElement)) stage.focus({ preventScroll: true });
    });
    paintSpeaker();
  }
  const onResize = (): void => { if (current?.opts.highlight === 'zoom' && !reduced) { pages[state.index]?.classList.remove('pr-interact-zoom'); zoom(current); } };
  const observer = new win.MutationObserver(() => { if (!destroyed) for (const visit of visits) connect(visit); });
  observer.observe(stage, { childList: true, subtree: true });
  stage.addEventListener('pointermove', onPointer); stage.addEventListener('pointerover', onPointer);
  stage.addEventListener('click', onReturn); win.addEventListener('blur', onBlur); win.addEventListener('resize', onResize);
  function destroy(): void {
    if (destroyed) return; destroyed = true;
    observer.disconnect(); if (frameId !== null) cancelFrame(frameId);
    if (returnFrameId !== null) cancelFrame(returnFrameId);
    if (blurTimer) clearTimeout(blurTimer); stopVisits();
    speakerRoot?.querySelector('.pr-sp-interact')?.remove(); speakerRoot = null;
    stage.removeEventListener('pointermove', onPointer); stage.removeEventListener('pointerover', onPointer);
    stage.removeEventListener('click', onReturn); win.removeEventListener('blur', onBlur); win.removeEventListener('resize', onResize);
  }
  return { sync, key, walk, speaker, release, returnKeyboard, get active() { return current?.marker ?? null; }, destroy };
}
