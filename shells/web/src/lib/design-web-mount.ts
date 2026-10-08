// SPDX-License-Identifier: MPL-2.0
/**
 * Web page boxes in Design (plan 288): the one place a live web frame is made.
 *
 * The Design tool paints a marker per web box (`.lolly-box-web[data-lolly-web]`) holding
 * the link as it was given, inert, over the box's poster or a card naming the site. This
 * module decides what each marker may show and mounts the frame:
 *
 *   live     the link is valid and allowed, and (for another site) trusted or agreed
 *            to in this session: a frame
 *   ask      another site nobody has trusted or agreed to: the poster and "Double-click
 *            to load <host>" (in the editor only; never while presenting)
 *   policy   an organisation's site policy blocks the site (lib/site-policy.ts)
 *   refused  the site forbids being framed: the poster, and the reason
 *   blocked  this deployment's security policy cannot frame the site (plan 288 D2)
 *   browser  this browser cannot frame other sites inside an isolated app (Firefox)
 *   invalid  no link, or one engine/src/web-embed.ts refuses
 *   poster   presenting, and this frame is not live now (another slide, or a site not
 *            agreed to: nothing is asked while presenting)
 *
 * Every rule about the link itself lives in engine/src/web-embed.ts; this file only owns
 * the DOM. In the editor (plan 288 D4) frames are live but inert until the person
 * double-clicks one, and they survive the editor's innerHTML repaints: `parkWebFrames`
 * moves them aside with Element.moveBefore (which keeps a frame's state) and
 * `restoreWebFrames` moves them back. A browser without moveBefore shows the poster
 * while edits continue and loads the page again after a quiet moment, never on every
 * keystroke. The presenter asks `conductWebFrames` which slide's frames are live.
 */

import { allowedOnHostedWeb, parseWebEmbed, type WebEmbed } from '../../../../engine/src/web-embed.ts';
import { buildEmbedUrl } from '../../../../engine/src/tool-url.ts';
import { packQuery } from '../../../../engine/src/url-pack.ts';
import { t } from '../i18n.ts';
import { isIframeMode } from './iframe-mode.ts';
import { anySiteActive } from './any-site.ts';
import { siteVerdict, onTrustedSitesChange } from './trusted-sites.ts';
import { normaliseTrustedSite } from '../../../../engine/src/trusted-sites.ts';
import { onSitePolicyChange } from './site-policy.ts';
import { icon } from './icons.ts';
import { createWebPageDriver, getWebPageDriver } from './web-page-driver.ts';
import '../styles/parts/design-web.css';

export type WebFrameState = 'live' | 'poster' | 'ask' | 'policy' | 'refused' | 'blocked' | 'browser' | 'invalid';
export type WebMountMode = 'editor' | 'present';

export interface WebMountOptions {
  mode: WebMountMode;
  /** Present mode: whether this marker's frame should be loaded now. */
  shouldBeLive?: (marker: HTMLElement) => boolean;
  /** A preloaded player stays paused until its slide becomes current. */
  shouldPlay?: (marker: HTMLElement) => boolean;
  knownTool?: (id: string) => boolean;
}

const MARKER = '.lolly-box-web[data-lolly-web]';
const FRAME = 'iframe[data-web-live]';
const REMOUNT_QUIET_MS = 700;
let appearance: typeof import('./design-web-css.ts') | undefined;
let appearanceLoad: Promise<typeof import('./design-web-css.ts')> | undefined;

/** Load the CSS parser only for an object with appearance overrides. */
function styleFrame(frame: HTMLIFrameElement, marker: HTMLElement): void {
  if (appearance) { appearance.updateWebAppearance(frame, marker); return; }
  if (!marker.dataset.webCss && marker.dataset.webHideCookies !== '1') return;
  appearanceLoad ??= import('./design-web-css.ts');
  void appearanceLoad.then(module => {
    appearance = module;
    if (frame.isConnected && frame.parentElement === marker) module.updateWebAppearance(frame, marker);
  }).catch(() => { appearanceLoad = undefined; });
}

/** Sites agreed to "just this time", by origin: this session only. "Always trust" writes
 *  to the person's trusted sites instead (lib/trusted-sites.ts). */
const CONSENT_KEY = 'lolly:web-consent';
function sessionConsents(): string[] {
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(CONSENT_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.slice(0, 128).filter((value): value is string => {
      if (typeof value !== 'string' || value.length > 512) return false;
      const url = new URL(value);
      return url.origin === value && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)));
    }) : [];
  } catch { return []; }
}
const consented = new Set<string>(sessionConsents());
const consentListeners = new Set<() => void>();

export function onWebConsentChange(callback: () => void): () => void {
  consentListeners.add(callback);
  return () => { consentListeners.delete(callback); };
}

export function consentToLink(link: string): void {
  const embed = parse(link);
  if (!embed || embed.sameOrigin || webSiteVerdict(embed).state === 'blocked') return;
  const origin = originOf(embed.src);
  if (consented.has(origin)) return;
  consented.add(origin);
  // Survive the wider-policy reload in this tab; never sync consent to a collaborator.
  try { window.sessionStorage.setItem(CONSENT_KEY, JSON.stringify([...consented].slice(-128))); } catch { /* consent remains in this window */ }
  for (const callback of consentListeners) callback();
}

/** The entry "Always trust" writes for a box: the exact host its frame contacts (or the
 *  origin, for a dev server on this machine). */
export function trustEntryFor(embed: WebEmbed): string | null {
  return normaliseTrustedSite(originOf(embed.src));
}

/** The verdict for what a box's frame would contact. An organisation's block on the link
 *  as the person gave it applies too (a youtube.com link plays from youtube-nocookie.com). */
export function webSiteVerdict(embed: WebEmbed): ReturnType<typeof siteVerdict> {
  const given = /^[a-z][a-z0-9+.-]*:\/\//i.test(embed.source) ? embed.source : `https://${embed.source}`;
  return siteVerdict(embed.src, given === embed.src ? undefined : given);
}

function originOf(src: string): string {
  try { return new URL(src).origin; } catch { return ''; }
}

function parse(link: string, knownTool?: (id: string) => boolean): WebEmbed | null {
  return parseWebEmbed(link, { appOrigin: location.origin, ...(knownTool ? { knownTool } : {}) });
}

/** A Lolly or Sandbox web box's tool and query, read from the frame address web-embed.ts
 *  derives (so a lolly.tools link and this app's own read the same). Null otherwise. */
export function lollyToolRef(link: string): { toolId: string; query: string } | null {
  const embed = parse(link);
  if (embed?.kind !== 'lolly') return null;
  const m = /#\/tool\/([a-z0-9-]+)(?:\?(.*))?$/.exec(embed.src);
  if (!m) return null;
  return { toolId: m[1]!, query: (m[2] ?? '').split('&').filter((p) => p && p !== 'iframe').join('&') };
}

/** Whether an image value is a composed tool render (an embed-URL identity). */
export function isComposedPoster(value: unknown): boolean {
  const id = typeof value === 'string' ? value : (value as { id?: unknown } | null)?.id;
  return typeof id === 'string' && /^https:\/\/lolly\.tools\/tool\//.test(id);
}

/**
 * The poster for a Lolly or Sandbox web box: the tool's own render, as a composed image
 * whose identity is its embed URL, so every export, share link and headless render draws
 * what the demo shows (re-rendered wherever the document opens). A long demo is packed
 * (`z=`) to stay inside the embed id's length. Null for any other link.
 */
function composedPosterIdSync(link: string): string | null {
  const ref = lollyToolRef(link);
  return ref ? buildEmbedUrl({ toolId: ref.toolId, format: 'svg', query: ref.query }) : null;
}
export async function composedPosterId(link: string): Promise<string | null> {
  const plain = composedPosterIdSync(link);
  if (plain) return plain;
  const ref = lollyToolRef(link);
  if (!ref) return null;
  const token = await packQuery(ref.query).catch(() => null);
  return token ? buildEmbedUrl({ toolId: ref.toolId, format: 'svg', query: `z=${token}` }) : null;
}

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** What a marker may show, before anyone is asked. */
export function webFrameState(embed: WebEmbed | null, mode: WebMountMode): WebFrameState {
  if (!embed) return 'invalid';
  // A Design document shown inside another page (`?iframe`) keeps its own web boxes as
  // pictures, so frames can never nest without end.
  if (isIframeMode()) return 'poster';
  if (embed.sameOrigin) return 'live';
  // An organisation's block wins over everything the person could decide.
  const verdict = webSiteVerdict(embed);
  if (verdict.state === 'blocked') return 'policy';
  if (embed.refuses) return 'refused';
  // The hosted web CSP lists a few named players (plan 288 D2); the desktop app's own
  // policy frames any https page, and so does the web app's /any-site/ shell once this
  // device allowed pages from any site (lib/any-site.ts).
  if (!inTauri() && !anySiteActive() && !allowedOnHostedWeb(embed)) return 'blocked';
  // An isolated page can frame another site only with the credentialless attribute,
  // which Firefox does not have.
  if (globalThis.crossOriginIsolated && !('credentialless' in HTMLIFrameElement.prototype)) return 'browser';
  if (verdict.state === 'trusted' || consented.has(originOf(embed.src))) return 'live';
  return mode === 'present' ? 'poster' : 'ask';
}

function boxIdOf(marker: Element): string {
  return (marker.closest('[data-box-id]') as HTMLElement | null)?.dataset.boxId ?? '';
}

function keyFor(marker: HTMLElement, embed: WebEmbed | null): string {
  return `${boxIdOf(marker)}|${embed?.src ?? ''}`;
}

/** Open the author's page, rather than its transformed player, in the person's browser. */
export function webPageHref(embed: WebEmbed): string {
  return /^https?:\/\//i.test(embed.source) ? embed.source : `https://${embed.source}`;
}

function syncPageLink(marker: HTMLElement, embed: WebEmbed | null, mode: WebMountMode): void {
  const current = marker.querySelector<HTMLAnchorElement>('.lolly-box-web-open');
  if (!embed || embed.sameOrigin || (mode !== 'present' && !embed.refuses)) { current?.remove(); return; }
  const link = current ?? document.createElement('a');
  link.className = 'btn btn--ghost lolly-box-web-open';
  link.href = webPageHref(embed);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = t('Open in new tab');
  link.setAttribute('aria-label', `${t('Open in new tab')}: ${embed.host}`);
  link.setAttribute('data-export-hide', '');
  if (!current) {
    link.append(new window.DOMParser().parseFromString(icon('externalLink'), 'image/svg+xml').documentElement);
    marker.appendChild(link);
  }
}

function note(state: WebFrameState, embed: WebEmbed | null): string {
  const host = embed?.host ?? '';
  switch (state) {
    // The question gives the host the frame will contact (a youtu.be link loads from
    // youtube-nocookie.com), so agreeing means exactly what the words say.
    case 'ask': return t('Double-click to load {host}').replace('{host}', frameHost(embed));
    case 'policy': return policyNote(embed);
    case 'refused': return t('{host} does not allow being shown inside other pages. Presenting shows this picture.').replace('{host}', host);
    case 'blocked': return t('Approve {host} in the document inspector to load this page.').replace('{host}', host);
    case 'browser': return t('This browser cannot show other sites inside Lolly. Chrome, Edge and Safari can.');
    case 'invalid': return embed === null ? t('Add a link to a web page, video or Sandbox demo in the inspector.') : '';
    default: return '';
  }
}

/** Why an organisation's policy keeps a site out, in its own words when it gave some. */
export function policyNote(embed: WebEmbed | null): string {
  if (!embed) return '';
  const verdict = webSiteVerdict(embed);
  const line = verdict.by
    ? t('{org} does not allow {host} here.').replace('{org}', verdict.by).replace('{host}', frameHost(embed))
    : t('Your organisation does not allow {host} here.').replace('{host}', frameHost(embed));
  return verdict.reason ? `${line} ${verdict.reason}` : line;
}

export function frameHost(embed: WebEmbed | null): string {
  try { return embed ? new URL(embed.src).hostname.replace(/^www\./, '') : ''; } catch { return embed?.host ?? ''; }
}

function setNote(marker: HTMLElement, text: string): void {
  let el = marker.querySelector<HTMLElement>(':scope > .lolly-box-web-note');
  if (!text) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.className = 'lolly-box-web-note';
    // Editor chrome: never drawn by an export.
    el.setAttribute('data-export-hide', '');
    marker.appendChild(el);
  }
  el.textContent = text;
}

/** Lay the page out at the chosen width and scale it into the box. */
function sizeFrame(frame: HTMLIFrameElement, marker: HTMLElement): void {
  const w = marker.clientWidth, h = marker.clientHeight;
  const view = Number(marker.dataset.webView) || 0;
  if (view > 0 && w > 0 && h > 0) {
    const s = w / view;
    frame.style.width = `${view}px`;
    frame.style.height = `${h / s}px`;
    frame.style.transform = `scale(${s})`;
  } else {
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.style.transform = '';
  }
  getWebPageDriver(marker)?.configure();
}

const resizer = typeof ResizeObserver === 'function'
  ? new ResizeObserver((entries) => {
    for (const entry of entries) {
      const marker = entry.target as HTMLElement;
      const frame = marker.querySelector<HTMLIFrameElement>(FRAME);
      if (frame) sizeFrame(frame, marker);
    }
  })
  : null;

function createFrame(embed: WebEmbed, marker: HTMLElement, mode: WebMountMode): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.className = 'lolly-box-web-frame';
  frame.dataset.webLive = keyFor(marker, embed);
  frame.dataset.webProvider = embed.provider;
  frame.dataset.webMode = mode;
  frame.title = marker.dataset.webTitle || embed.label;
  if (!embed.sameOrigin) {
    // No cookies or storage for another site inside an isolated app, and only the app's
    // origin as the referrer: the document and its link never travel with the request.
    if ('credentialless' in HTMLIFrameElement.prototype) frame.setAttribute('credentialless', '');
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
  }
  if (embed.sandbox) frame.setAttribute('sandbox', embed.sandbox);
  frame.setAttribute('allow', mode === 'present' && !/autoplay/.test(embed.allow) ? `${embed.allow}; autoplay` : embed.allow);
  frame.tabIndex = -1;
  const address = new URL(embed.src);
  if (embed.provider === 'youtube') {
    address.searchParams.set('origin', location.origin);
    if (mode === 'editor' || marker.dataset.webPlay !== '1') address.searchParams.set('autoplay', '0');
  }
  frame.src = address.href;
  sizeFrame(frame, marker);
  styleFrame(frame, marker);
  return frame;
}

/**
 * Pause what a kept frame is playing (plan 288, "Keep running" when its slide is left):
 * YouTube and Vimeo through their player messages, a same-origin Lolly frame through its
 * own media elements. Any other page has no way to be asked, and keeps playing.
 */
export function pauseWebFrame(frame: HTMLIFrameElement): void {
  const win = frame.contentWindow;
  if (!win) return;
  try {
    switch (frame.dataset.webProvider) {
      case 'youtube':
        win.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 'https://www.youtube-nocookie.com');
        break;
      case 'vimeo':
        win.postMessage(JSON.stringify({ method: 'pause' }), 'https://player.vimeo.com');
        break;
      case 'lolly': case 'sandbox':
        for (const media of frame.contentDocument?.querySelectorAll<HTMLMediaElement>('video, audio') ?? []) media.pause();
        break;
      default:
        break;
    }
  } catch { /* the frame navigated away or is not ready */ }
}

/** Blank a frame first so audio stops at once, then remove the element. */
function dropFrame(frame: HTMLIFrameElement): void {
  if (frame.parentElement) getWebPageDriver(frame.parentElement)?.destroy();
  appearance?.clearWebAppearance(frame);
  try { frame.src = 'about:blank'; } catch { /* detached */ }
  frame.remove();
}

/** While the presenter is open the editor's own frames unload: the deck plays its own
 *  copies, and a demo must not run twice behind the stage. */
let presenting = false;
const presentingListeners = new Set<() => void>();

export function setWebPresenting(on: boolean): void {
  if (presenting === on) return;
  presenting = on;
  if (on) {
    for (const frame of document.querySelectorAll<HTMLIFrameElement>(`${FRAME}[data-web-mode="editor"]`)) dropFrame(frame);
  }
  for (const cb of presentingListeners) cb();
}

const pendingRemount = new WeakMap<Element, ReturnType<typeof setTimeout>>();
/** Keys that had a live frame in the previous editor paint (the no-moveBefore path). */
let recentlyLive = new Set<string>();

/** Decide and mount every marker under `root`. */
export function mountWebFrames(root: Element, opts: WebMountOptions): void {
  const seenLive = new Set<string>();
  for (const marker of root.querySelectorAll<HTMLElement>(MARKER)) {
    const embed = parse(marker.dataset.lollyWeb ?? '', opts.knownTool);
    let state = webFrameState(embed, opts.mode);
    marker.dataset.webPlay = opts.mode === 'present' && (opts.shouldPlay?.(marker) ?? true) ? '1' : '0';
    if (opts.mode === 'present' && state === 'live' && opts.shouldBeLive && !opts.shouldBeLive(marker)) state = 'poster';
    if (opts.mode === 'editor' && presenting && state === 'live') state = 'poster';
    const key = keyFor(marker, embed);
    const current = marker.querySelector<HTMLIFrameElement>(FRAME);
    if (current && (state !== 'live' || current.dataset.webLive !== key)) dropFrame(current);
    marker.dataset.webState = state === 'live' ? 'live' : state;
    syncPageLink(marker, embed, opts.mode);
    if (opts.mode === 'editor') {
      marker.toggleAttribute('data-web-inert', !marker.classList.contains('is-entered'));
      setNote(marker, state === 'live' ? '' : note(state, embed));
    } else if (state === 'refused') setNote(marker, note(state, embed));
    if (state !== 'live' || !embed) continue;
    seenLive.add(key);
    const kept = marker.querySelector<HTMLIFrameElement>(FRAME);
    if (kept) {
      styleFrame(kept, marker);
      createWebPageDriver(kept, marker).configure();
      if (embed.provider === 'youtube' && marker.dataset.webPlay === '1' && kept.dataset.webPlay !== '1'
        && new URL(embed.src).searchParams.get('autoplay') === '1') {
        // A player preloaded with autoplay off may not yet accept commands. Its first
        // activation uses the player URL; later visits resume the existing player.
        const address = new URL(kept.src);
        if (address.searchParams.get('autoplay') === '0') { address.searchParams.set('autoplay', '1'); kept.src = address.href; }
        else kept.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube-nocookie.com');
      }
      kept.dataset.webPlay = marker.dataset.webPlay;
      resizer?.observe(marker); continue;
    }
    // Without moveBefore a repaint recreated this marker: wait for the edits to pause
    // rather than reloading the page on every keystroke.
    if (opts.mode === 'editor' && recentlyLive.has(key) && !('moveBefore' in Element.prototype)) {
      const prev = pendingRemount.get(marker);
      if (prev) clearTimeout(prev);
      pendingRemount.set(marker, setTimeout(() => {
        if (marker.isConnected && !marker.querySelector(FRAME)) {
          const frame = createFrame(embed, marker, opts.mode);
          marker.appendChild(frame); createWebPageDriver(frame, marker);
        }
      }, REMOUNT_QUIET_MS));
      continue;
    }
    const frame = createFrame(embed, marker, opts.mode);
    frame.dataset.webPlay = marker.dataset.webPlay;
    marker.appendChild(frame);
    createWebPageDriver(frame, marker);
    resizer?.observe(marker);
  }
  if (opts.mode === 'editor') recentlyLive = seenLive;
}

function parkingLot(): HTMLElement {
  let lot = document.getElementById('lolly-web-parking');
  if (!lot) {
    lot = document.createElement('div');
    lot.id = 'lolly-web-parking';
    lot.setAttribute('aria-hidden', 'true');
    lot.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none';
    document.body.appendChild(lot);
  }
  return lot;
}

type MovableParent = Element & { moveBefore(node: Node, child: Node | null): void };
const canMove = (element: Element): element is MovableParent =>
  'moveBefore' in element && typeof element.moveBefore === 'function';

/** Before an innerHTML repaint: move live frames aside, keeping their state. Null when
 *  the browser cannot move a frame without a reload. */
export function parkWebFrames(root: Element): HTMLIFrameElement[] | null {
  if (!('moveBefore' in Element.prototype)) return null;
  const frames = [...root.querySelectorAll<HTMLIFrameElement>(FRAME)];
  if (!frames.length) return null;
  const lot = parkingLot();
  if (!canMove(lot)) return null;
  const moved: HTMLIFrameElement[] = [];
  for (const frame of frames) {
    try { lot.moveBefore(frame, null); moved.push(frame); } catch { /* left behind, reloads */ }
  }
  return moved;
}

/** After the repaint: move each parked frame into its box's new marker, or drop the frame. */
export function restoreWebFrames(root: Element, parked: HTMLIFrameElement[] | null, knownTool?: (id: string) => boolean): void {
  if (!parked) return;
  const byKey = new Map<string, HTMLElement>();
  for (const marker of root.querySelectorAll<HTMLElement>(MARKER)) {
    byKey.set(keyFor(marker, parse(marker.dataset.lollyWeb ?? '', knownTool)), marker);
  }
  for (const frame of parked) {
    const marker = byKey.get(frame.dataset.webLive ?? '');
    if (!marker) { dropFrame(frame); continue; }
    try { if (canMove(marker)) { marker.moveBefore(frame, null); sizeFrame(frame, marker); styleFrame(frame, marker); } else dropFrame(frame); } catch { dropFrame(frame); }
  }
}

/** Remove every live frame under `root` (presenter close, a slide unloading). */
export function unmountWebFrames(root: Element): void {
  for (const frame of root.querySelectorAll<HTMLIFrameElement>(FRAME)) dropFrame(frame);
}

// ── Entering a live box in the editor ────────────────────────────────────────────────

let entered: HTMLElement | null = null;
let unhookFrameKeys: (() => void) | null = null;

function markerAt(x: number, y: number, canvas: Element): HTMLElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!canvas.contains(el)) continue;
    const marker = el.closest<HTMLElement>(MARKER);
    if (marker) return marker;
  }
  return null;
}

function exit(): void {
  if (!entered) return;
  unhookFrameKeys?.();
  unhookFrameKeys = null;
  const frame = entered.querySelector<HTMLIFrameElement>(FRAME);
  entered.classList.remove('is-entered');
  entered.setAttribute('data-web-inert', '');
  frame?.setAttribute('tabindex', '-1');
  entered.querySelector('.lolly-box-web-done')?.remove();
  // A focused frame keeps every key, so the editor's shortcuts need focus back.
  if (frame && document.activeElement === frame) frame.blur();
  entered = null;
}

/** Escape pressed inside a same-origin Lolly frame reaches only the frame's own
 *  document, so the editor listens there too. The page still hears the key. Another
 *  origin's frame cannot be listened to: Done and a click outside leave the box. */
function hookFrameKeys(frame: HTMLIFrameElement): () => void {
  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') exit(); };
  const hook = (): void => {
    try { frame.contentWindow?.addEventListener('keydown', onKey, true); } catch { /* another origin */ }
  };
  hook();
  frame.addEventListener('load', hook);
  return () => {
    frame.removeEventListener('load', hook);
    try { frame.contentWindow?.removeEventListener('keydown', onKey, true); } catch { /* another origin */ }
  };
}

function enter(marker: HTMLElement): void {
  if (entered === marker) return;
  exit();
  const frame = marker.querySelector<HTMLIFrameElement>(FRAME);
  if (!frame) return;
  entered = marker;
  marker.classList.add('is-entered');
  marker.removeAttribute('data-web-inert');
  frame.tabIndex = 0;
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'lolly-box-web-done';
  done.setAttribute('data-export-hide', '');
  done.textContent = t('Done');
  done.addEventListener('pointerdown', (e) => e.stopPropagation());
  done.addEventListener('click', (e) => { e.stopPropagation(); exit(); });
  marker.appendChild(done);
  unhookFrameKeys = hookFrameKeys(frame);
  // A short delay so the double-click that entered does not also land in the page
  // (it would start a video or select text there).
  setTimeout(() => { if (entered === marker) frame.focus(); }, 100);
}

/**
 * Wire double-click-to-enter on the editor canvas. A double-click on a live web box makes
 * its page usable in place; a click anywhere else, or Esc while focus is back in the app,
 * returns it to an inert picture. A box still waiting for agreement ("ask") is agreed to
 * and loaded by the same double-click. Returns the teardown.
 */
/**
 * Use a web box's page in place: the double-click and the Enter key both come here. A
 * box still waiting for agreement is agreed to and loaded first. False when the box
 * cannot be used in place (no link, a refusing site, a blocked one).
 */
export function enterWebBox(canvas: Element, boxId: string, remount: () => void): boolean {
  const find = (): HTMLElement | null => {
    for (const box of canvas.querySelectorAll<HTMLElement>('[data-box-id]')) {
      if (box.dataset.boxId === boxId) return box.querySelector<HTMLElement>(MARKER);
    }
    return null;
  };
  const marker = find();
  if (!marker) return false;
  if (marker.dataset.webState === 'ask') {
    consentToLink(marker.dataset.lollyWeb ?? '');
    remount();
    const fresh = find();
    if (fresh?.dataset.webState !== 'live') return false;
    enter(fresh);
    return true;
  }
  if (marker.dataset.webState !== 'live') return false;
  enter(marker);
  return true;
}

export function wireWebEditing(canvas: HTMLElement, remount: () => void): () => void {
  const onDbl = (e: MouseEvent): void => {
    const marker = markerAt(e.clientX, e.clientY, canvas);
    if (!marker) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    enterWebBox(canvas, boxIdOf(marker), remount);
  };
  const onDown = (e: PointerEvent): void => {
    if (entered && !entered.contains(e.target as Node)) exit();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (entered && e.key === 'Escape') { exit(); e.stopPropagation(); }
  };
  document.addEventListener('dblclick', onDbl, true);
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  // A site trusted or removed elsewhere (the pre-flight, /profile, an organisation's new
  // rule) loads or unloads here without a reload.
  const offTrust = onTrustedSitesChange(remount);
  const offPolicy = onSitePolicyChange(remount);
  const offConsent = onWebConsentChange(remount);
  presentingListeners.add(remount);
  return () => {
    offTrust();
    offPolicy();
    offConsent();
    presentingListeners.delete(remount);
    exit();
    document.removeEventListener('dblclick', onDbl, true);
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
  };
}

/** Strip live frames and notes from a cloned subtree (thumbnails, presenter previews):
 *  a clone of a frame would load the page again. */
export function stripWebFrames(root: Element): void {
  for (const el of root.querySelectorAll(`${FRAME}, .lolly-box-web-note, .lolly-box-web-done`)) el.remove();
}
