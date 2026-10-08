// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-follow - follow one person's view, and see who follows you or presents
 * (plan 76 milestone 4). Imported by views/tool-collab.ts only, so a tool with no live
 * document never loads this module.
 */
import { collabSurface, revealCollabViewport } from '../lib/collab-surface.ts';
import type { CollabParticipant, CollabSession } from '../lib/collab-session.ts';
import type { PresenceState } from '../lib/collab-presence.ts';
import { deepActiveElement, isTypingTarget } from '../lib/typing-target.ts';
import type { CollabFollowState, CollabPillFollow } from '../components/collab-pill.ts';
import { navs } from './tool-peer-view.ts';
import { STAGE_FLOATING_SURFACES } from './tool-stage-nav.ts';

/** True when a peer's presence says they are presenting. Anything other than `true` is not presenting. */
export function isPresenting(state: PresenceState | undefined): boolean {
  return !!state && 'presenting' in state && state.presenting === true;
}

/** The one presenter shown: the earliest-joined participant who is presenting and not away. */
export function shownPresenter<T extends { readonly away: boolean; readonly presenting: boolean }>(joinOrder: readonly T[]): T | null {
  return joinOrder.find(p => p.presenting && !p.away) ?? null;
}

/** A followed person's view is applied at most once per animation frame and once per this many ms. */
export const FOLLOW_APPLY_MS = 100;
/** Input within this long after a view change made by following is that change echoing, not the person. */
export const FOLLOW_ECHO_MS = 50;
/** How long "You stopped following" stays in the pill. */
export const FOLLOW_NOTICE_MS = 5_000;
/** A press this recent makes an unexplained view change the person's own (a zoom button, a Fit). */
const FOLLOW_PRESS_MS = 500;
/** A pointer that moves this far while pressed on the stage is a drag, which is navigation. */
const FOLLOW_DRAG_PX = 4;
/** The keys the stage navigator zooms with, matched as it matches them. */
const ZOOM_KEYS = new Set(['+', '=', '-', '_', '0', '1']);
/** Layers that own Escape while a key is pressed inside them. */
const ESCAPE_OWNERS = 'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="menu"], [role="listbox"]';
/** Places a press or a wheel on the stage belongs to something other than the camera. */
const NOT_THE_CAMERA = `${STAGE_FLOATING_SURFACES}, .collab-pill, button, a[href], input, textarea, select, [contenteditable="true"]`;

type FollowSession = Pick<CollabSession, 'state' | 'subscribe' | 'updateSurface'> & { presence: Pick<CollabSession['presence'], 'roster'> };

export interface FollowOptions {
  /** `.tool-stage`: the camera's own gestures land here, and the follow frame is drawn here. */
  stage: HTMLElement;
  /** The comments panel: a followed person's open thread is located once per change, without moving focus. */
  comments?: { locate(context?: string, opts?: { focus?: boolean }): Promise<void> } | null;
  /** The name a person is shown, with the pill's role fallbacks. */
  displayName: (p: CollabParticipant) => string;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  raf?: (fn: () => void) => void;
}

export interface FollowController extends CollabPillFollow {
  /** Stop listening and drop every timer. Idempotent. */
  dispose(): void;
}

interface SavedView { surfaceId?: string; view?: { scale: number; x: number; y: number }; selection: string[] }
interface Leader { clientId: string; userId: string; presentation: boolean }

/**
 * Follow one person's view (plan 76 M4): clicking their avatar copies their surface and
 * camera as their presence changes, never their selection. The person's own navigation
 * stops it and keeps the view; Stop following and Escape bring back the view they had.
 * Every camera change is instant, so reduced motion needs no separate path.
 */
export function mountFollow(runtime: object, session: FollowSession, opts: FollowOptions): FollowController {
  const doc = opts.stage.ownerDocument, win = doc.defaultView;
  const now = opts.now ?? (() => Date.now());
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((handle: unknown) => { clearTimeout(handle as ReturnType<typeof setTimeout>); });
  const raf = opts.raf ?? ((fn: () => void) => { if (win?.requestAnimationFrame) win.requestAnimationFrame(() => fn()); else fn(); });

  const subscribers = new Set<(state: CollabFollowState) => void>();
  let current: CollabFollowState = { leader: null, presenter: null, followers: [], notice: null };
  let signature = '';
  let leader: Leader | null = null, leaderName = '', saved: SavedView | null = null;
  let notice: CollabFollowState['notice'] = null, noticeSeq = 0, noticeTimer: unknown;
  let generation = 0, scheduled = false, applyTimer: unknown, lastApplyAt = -Infinity, force = false;
  let applied: { surface?: string; viewport?: string; thread?: string } = {};
  let echoUntil = -Infinity, pendingViewEcho = false, pressedAt = -Infinity, locating = 0;
  let detach: (() => void) | null = null, frame: HTMLElement | null = null, disposed = false;

  const echoing = (): boolean => now() < echoUntil;
  /** An event target as an element of this document's realm, or null. */
  const elementOf = (target: EventTarget | null): Element | null => win && target instanceof win.Element ? target : null;
  const programmatic = (view: boolean): void => {
    echoUntil = now() + FOLLOW_ECHO_MS;
    if (view && navs.has(runtime)) pendingViewEcho = true;
  };

  function compute(): CollabFollowState {
    const state = session.state(), presence = new Map(session.presence.roster().map(p => [p.id, p.state] as const));
    const people = state.peers.filter(p => p.kind !== 'agent');
    const person = (p: CollabParticipant) => ({ clientId: p.clientId, name: opts.displayName(p) });
    const lead = leader && people.find(p => p.clientId === leader!.clientId);
    const presenter = shownPresenter(people.map(p => ({ p, away: p.away, presenting: isPresenting(presence.get(p.clientId)) })));
    return {
      leader: leader && lead ? { ...person(lead), presentation: leader.presentation } : null,
      presenter: presenter ? person(presenter.p) : null,
      followers: people.filter(p => presence.get(p.clientId)?.following === state.self.userId).map(person),
      notice,
    };
  }
  function publish(): void {
    if (disposed) return;
    current = compute();
    const next = JSON.stringify([current.leader, current.presenter, current.followers, current.notice]);
    if (next === signature) return;
    signature = next;
    for (const fn of [...subscribers]) {
      try { fn(current); } catch (error) { console.warn('[lolly:collab] follow subscriber', error); }
    }
  }

  function schedule(): void {
    if (!leader || scheduled || disposed) return;
    scheduled = true;
    const run = generation, wait = lastApplyAt + FOLLOW_APPLY_MS - now();
    const frameThen = (): void => raf(() => {
      if (run !== generation) return;
      scheduled = false;
      if (leader && !disposed) apply();
    });
    if (wait > 0) applyTimer = setTimer(() => { applyTimer = undefined; frameThen(); }, wait);
    else frameThen();
  }

  function apply(): void {
    const peer = session.presence.roster().find(p => p.id === leader!.clientId);
    if (!peer) return;
    lastApplyAt = now();
    const state = peer.state, surfaceId = state.surface?.id, forced = force;
    force = false;
    const thread = surfaceId?.startsWith('comments:') ? surfaceId.slice('comments:'.length) : undefined;
    if (thread !== applied.thread) {
      applied.thread = thread;
      if (thread && opts.comments) {
        locating++; programmatic(false);
        // The person did not ask for this: focus stays put, and the panel waits while they write.
        void opts.comments.locate(thread, { focus: false }).catch(() => {}).finally(() => { locating--; programmatic(false); });
      }
    }
    if (!leader!.presentation && state.viewport) {
      const key = `${state.viewport.x},${state.viewport.y},${state.viewport.zoom}`;
      if (forced || key !== applied.viewport) { applied.viewport = key; programmatic(true); revealCollabViewport(runtime, state.viewport); }
    } else if (surfaceId && !thread && (forced || surfaceId !== applied.surface)) {
      programmatic(true); collabSurface(runtime)?.focusSurface?.(surfaceId);
    }
    if (surfaceId && !thread) applied.surface = surfaceId;
  }

  function attach(): void {
    if (detach) return;
    const controller = new (win?.AbortController ?? AbortController)(), signal = controller.signal;
    const surface = collabSurface(runtime);
    let selection = new Set(surface?.selection() ?? []);
    let press: { id: number; x: number; y: number } | null = null, pointers = 0;
    const own = (): void => { if (!echoing()) end('stopped', false); };
    const onCamera = (target: EventTarget | null): boolean => !elementOf(target)?.closest(NOT_THE_CAMERA);
    opts.stage.addEventListener('wheel', event => { if (onCamera(event.target)) own(); }, { capture: true, passive: true, signal });
    opts.stage.addEventListener('pointerdown', event => {
      pointers++;
      if (!onCamera(event.target)) return;
      if (pointers > 1) { own(); return; }
      press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }, { capture: true, signal });
    opts.stage.addEventListener('pointermove', event => {
      if (press && event.pointerId === press.id && Math.hypot(event.clientX - press.x, event.clientY - press.y) > FOLLOW_DRAG_PX) { press = null; own(); }
    }, { capture: true, passive: true, signal });
    const release = (): void => { pointers = Math.max(0, pointers - 1); press = null; };
    win?.addEventListener('pointerup', release, { capture: true, signal });
    win?.addEventListener('pointercancel', release, { capture: true, signal });
    doc.addEventListener('pointerdown', () => { pressedAt = now(); }, { capture: true, signal });
    // On the window, after the document: an open popover takes Escape first and stops it there.
    win?.addEventListener('keydown', event => {
      const target = elementOf(event.target);
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(target)) return;
      if (event.key === 'Escape') {
        // Escape closes only the topmost layer. A dialog, menu or list box owns the key, even one that
        // closed itself while the key was handled (its element has left the page), and an open
        // dialog's own close is the key's default action, which must not be cancelled.
        if (event.defaultPrevented || target && (!target.isConnected || target.closest(ESCAPE_OWNERS)) || doc.querySelector('dialog[open]')) return;
        event.preventDefault(); end('stopped', true);
        return;
      }
      if (!ZOOM_KEYS.has(event.key) && !(event.shiftKey && (event.code === 'Digit1' || event.code === 'Digit2'))) return;
      // A focused control keeps its own keys, exactly as the stage navigator allows.
      const control = deepActiveElement(doc)?.closest('button, summary, a[href], [role="button"], [role="slider"]');
      if (!control || control.hasAttribute('data-box-id')) own();
    }, { signal });
    // A view change nobody explained: a zoom button, a Fit, or another press just before the change.
    opts.stage.addEventListener('lolly:stage-view', () => {
      if (pendingViewEcho) { pendingViewEcho = false; return; }
      if (now() - pressedAt <= FOLLOW_PRESS_MS) own();
    }, { signal });
    const offSurface = surface?.subscribe(() => {
      const next = surface.selection(), added = next.some(id => !selection.has(id));
      selection = new Set(next);
      // Locating a followed person's thread may select its object; that is not the person's choice.
      if (added && !locating) own();
    });
    detach = () => { controller.abort(); offSurface?.(); };
  }

  function showFrame(color: string): void {
    frame ??= doc.createElement('div');
    frame.className = 'collab-follow-frame';
    frame.setAttribute('aria-hidden', 'true');
    // Live capture hides stage chrome marked this way, so a recording never shows the frame.
    frame.setAttribute('data-live-hide', '');
    if (color) frame.style.setProperty('--collab-color', color); else frame.style.removeProperty('--collab-color');
    if (frame.parentElement !== opts.stage) opts.stage.append(frame);
  }

  function setNotice(kind: 'stopped' | 'left', name: string): void {
    if (noticeTimer !== undefined) clearTimer(noticeTimer);
    notice = { id: ++noticeSeq, kind, name };
    noticeTimer = setTimer(() => { noticeTimer = undefined; notice = null; publish(); }, FOLLOW_NOTICE_MS);
  }

  function restore(view: SavedView): void {
    const surface = collabSurface(runtime), nav = navs.get(runtime);
    programmatic(!!view.view);
    // Following never changes the selection, so this only puts back ids a peer's edit removed.
    if (view.surfaceId && view.selection.length && surface?.revealPeer
      && (surface.id() !== view.surfaceId || surface.selection().join('\n') !== view.selection.join('\n')))
      surface.revealPeer({ userId: '', name: '', color: '', surface: { id: view.surfaceId, space: 'unit' }, selection: view.selection });
    if (view.view) nav?.applyView(view.view);
  }

  function end(kind: 'stopped' | 'left' | null, restoreView: boolean): void {
    if (!leader) return;
    const name = leaderName, view = saved;
    leader = null; saved = null; applied = {}; scheduled = false; generation++;
    if (applyTimer !== undefined) { clearTimer(applyTimer); applyTimer = undefined; }
    detach?.(); detach = null; frame?.remove();
    if (disposed) return;
    session.updateSurface({ following: undefined });
    if (restoreView && view) restore(view);
    if (kind) setNotice(kind, name);
    publish();
  }

  function start(clientId: string, presentation: boolean): void {
    if (disposed) return;
    const state = session.state(), person = state.peers.find(p => p.clientId === clientId);
    if (state.connection !== 'live' || !person || person.away || person.kind === 'agent') return;
    if (leader?.clientId === clientId && leader.presentation === presentation) return;
    const surface = collabSurface(runtime);
    // Switching to someone else keeps the view from before the first follow, so Escape returns there.
    saved ??= { surfaceId: surface?.id(), view: navs.get(runtime)?.viewState(), selection: surface?.selection().slice(0, 200) ?? [] };
    leader = { clientId, userId: person.userId, presentation };
    leaderName = opts.displayName(person);
    if (noticeTimer !== undefined) { clearTimer(noticeTimer); noticeTimer = undefined; }
    notice = null; applied = {}; force = true; scheduled = false; generation++;
    if (applyTimer !== undefined) { clearTimer(applyTimer); applyTimer = undefined; }
    lastApplyAt = -Infinity; pressedAt = -Infinity;
    session.updateSurface({ following: person.userId });
    attach(); showFrame(person.color); schedule(); publish();
  }

  const offSession = session.subscribe(state => {
    if (disposed) return;
    if (leader) {
      const lead = state.peers.find(p => p.clientId === leader!.clientId);
      if (lead) leaderName = opts.displayName(lead);
      const presence = session.presence.roster().find(p => p.id === leader!.clientId)?.state;
      if (state.connection === 'closed') end('stopped', false);
      else if (!lead || lead.away) end('left', false);
      else if (leader.presentation && !isPresenting(presence)) end('stopped', false);
      else schedule();
    }
    publish();
  });
  publish();

  return {
    state: () => current,
    subscribe(fn) { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
    follow(clientId) { start(clientId, false); },
    followPresentation() { if (current.presenter) start(current.presenter.clientId, true); },
    stop() { end('stopped', true); },
    dispose() {
      if (disposed) return;
      disposed = true;
      end(null, false);
      offSession();
      if (noticeTimer !== undefined) { clearTimer(noticeTimer); noticeTimer = undefined; }
      subscribers.clear(); frame?.remove();
    },
  };
}
