// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { FOLLOW_APPLY_MS, FOLLOW_ECHO_MS, FOLLOW_NOTICE_MS, isPresenting, mountFollow, shownPresenter } from './tool-follow.ts';
import { mountPeerViewport } from './tool-peer-view.ts';
import { registerCollabSurface } from '../lib/collab-surface.ts';
import type { CollabConnectionState, CollabParticipant, CollabSessionState } from '../lib/collab-session.ts';
import type { PresencePeer, PresenceState } from '../lib/collab-presence.ts';

test('presenting is read only when it is exactly true, and one presenter is shown: the earliest present', () => {
  const state = (presenting: unknown): PresenceState => ({ userId: 'u', name: 'U', color: '#123456', ...{ presenting } });
  assert.equal(isPresenting(state(true)), true);
  for (const value of ['yes', 1, false, undefined, null]) assert.equal(isPresenting(state(value)), false, String(value));
  assert.equal(isPresenting(undefined), false);
  const order = [{ id: 'a', away: true, presenting: true }, { id: 'b', away: false, presenting: false }, { id: 'c', away: false, presenting: true }, { id: 'd', away: false, presenting: true }];
  assert.equal(shownPresenter(order)?.id, 'c', 'the away presenter is passed over; the later one is never shown too');
  assert.equal(shownPresenter([]), null);
});

// ── following ────────────────────────────────────────────────────────────────

interface PersonSpec { id: string; name?: string; away?: boolean; presence?: Record<string, unknown> }

/** A scripted session, a canvas surface and a stage camera: everything `mountFollow` reads. */
function followFixture() {
  const dom = new JSDOM('<main id="stage"><div id="canvas"><input id="field"></div></main>', { url: 'https://lolly.tools/' });
  const doc = dom.window.document, stage = doc.getElementById('stage')!, canvas = doc.getElementById('canvas')!, runtime = {};
  let t = 1_000, nextTimer = 1, connection: CollabConnectionState = 'live';
  const timers = new Map<number, () => void>();
  let people: PersonSpec[] = [];
  const subs = new Set<(state: CollabSessionState) => void>();
  const patches: Partial<PresenceState>[] = [];
  const self: CollabParticipant = { clientId: 'me-device', userId: 'me', name: 'Andy', color: '#aa0000', colorIndex: 0, away: false, isSelf: true, isHost: false, inviteeIndex: 0 };
  const participant = (p: PersonSpec): CollabParticipant => ({ clientId: p.id, userId: `user-${p.id}`, name: p.name ?? p.id, color: '#00aa00', colorIndex: 1, away: !!p.away, isSelf: false, isHost: false, inviteeIndex: 0 });
  const state = (): CollabSessionState => ({ connection, role: 'writer', self, peers: people.map(participant) });
  const roster = (): PresencePeer[] => people.map((p, i) => ({ id: p.id, away: !!p.away, firstSeen: i, lastSeen: t, seq: 1,
    state: { userId: `user-${p.id}`, name: p.name ?? p.id, color: '#00aa00', ...p.presence } }));
  const session = {
    state, subscribe(fn: (s: CollabSessionState) => void) { subs.add(fn); return () => { subs.delete(fn); }; },
    updateSurface(patch: Partial<PresenceState>) { patches.push(patch); }, presence: { roster },
  };
  let selection: string[] = ['mine'];
  const surfaceSubs = new Set<() => void>(), focused: string[] = [], revealed: PresenceState[] = [];
  const offSurface = registerCollabSurface(runtime, { id: () => 'board-1', element: () => null, selection: () => selection,
    subscribe: fn => { surfaceSubs.add(fn); return () => { surfaceSubs.delete(fn); }; },
    focusSurface: id => { focused.push(id); return true; }, revealPeer: s => { revealed.push(s); return true; } });
  let camera = { scale: 1, x: 0, y: 0 };
  // The canvas box moves with the camera, as the stage transform moves it in a browser.
  canvas.getBoundingClientRect = () => new dom.window.DOMRect(camera.x, camera.y, 100, 100);
  const views: { scale: number; x: number; y: number }[] = [];
  const offNav = mountPeerViewport(runtime, stage, canvas, { zoomTo() {}, actual: () => 1, viewState: () => camera, applyView(v) { camera = v; views.push(v); } });
  const located: string[] = [], locateFocus: Array<boolean | undefined> = [];
  const follow = mountFollow(runtime, session, {
    stage, displayName: p => p.name, comments: { async locate(context, opts) { if (context) { located.push(context); locateFocus.push(opts?.focus); } } },
    now: () => t, raf: fn => fn(),
    setTimer: (fn, _ms) => { const id = nextTimer++; timers.set(id, fn); return id; },
    clearTimer: h => { timers.delete(h as number); },
  });
  return {
    dom, doc, stage, canvas, follow, patches, focused, revealed, located, locateFocus, views, timers,
    camera: () => camera, setCamera(v: typeof camera) { camera = v; },
    set(next: PersonSpec[], conn: CollabConnectionState = 'live') { people = next; connection = conn; for (const fn of [...subs]) fn(state()); },
    advance(ms: number) { t += ms; },
    flush() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } },
    select(ids: string[]) { selection = ids; for (const fn of [...surfaceSubs]) fn(); },
    key(key: string, target: EventTarget = doc.body, init: KeyboardEventInit = {}) {
      const event = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event); return event;
    },
    pointer(type: string, x: number, y = 0, target: Element = canvas) { target.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y })); },
    viewEvent() { stage.dispatchEvent(new dom.window.CustomEvent('lolly:stage-view')); },
    close() { follow.dispose(); offNav(); offSurface(); dom.window.close(); },
  };
}
const viewport = (x: number, y = 0, zoom = 1) => ({ surface: { id: 'board-2', space: 'unit' }, viewport: { x, y, zoom }, selection: ['their-box'] });

test('following copies a person\'s camera, never their selection, at most once per frame and per 100 ms', () => {
  const f = followFixture();
  try {
    f.set([{ id: 'bea', name: 'Bea', presence: viewport(10) }]);
    f.follow.follow('bea');
    assert.deepEqual(f.patches.at(-1), { following: 'user-bea' }, 'following is published as the person\'s user id');
    assert.equal(f.views.length, 1, 'their camera is applied at once');
    assert.equal(f.follow.state().leader?.name, 'Bea');
    const frame = f.stage.querySelector<HTMLElement>('.collab-follow-frame');
    assert.ok(frame, 'the stage is framed while following');
    assert.equal(frame.style.getPropertyValue('--collab-color'), '#00aa00');
    assert.equal(f.canvas.querySelector('.collab-follow-frame'), null, 'and never inside the render surface');

    f.advance(20); f.set([{ id: 'bea', name: 'Bea', presence: viewport(11) }]);
    f.advance(20); f.set([{ id: 'bea', name: 'Bea', presence: viewport(12) }]);
    assert.equal(f.views.length, 1, 'nothing more inside 100 ms');
    assert.equal(f.timers.size, 1, 'one deferred apply, however many updates arrived');
    f.advance(FOLLOW_APPLY_MS); f.flush();
    assert.equal(f.views.length, 2, 'then the newest camera, once');
    assert.equal(f.views[1]!.x, -12);
    f.advance(FOLLOW_APPLY_MS); f.set([{ id: 'bea', name: 'Bea', presence: viewport(12) }]);
    assert.equal(f.views.length, 2, 'an unchanged camera is not re-applied');
    assert.deepEqual(f.revealed, [], 'their selection is never copied');
  } finally { f.close(); }
});

test('a presenter\'s slide is focused, and a thread they open is located once per change', async () => {
  const f = followFixture();
  try {
    f.set([{ id: 'cy', name: 'Cy', presence: { surface: { id: 'slide-1', space: 'unit' }, presenting: true } }]);
    assert.equal(f.follow.state().presenter?.name, 'Cy');
    f.follow.followPresentation();
    assert.deepEqual(f.focused, ['slide-1']);
    assert.equal(f.follow.state().leader?.presentation, true);
    f.advance(FOLLOW_APPLY_MS); f.set([{ id: 'cy', name: 'Cy', presence: { surface: { id: 'slide-2', space: 'unit' }, presenting: true } }]);
    assert.deepEqual(f.focused, ['slide-1', 'slide-2'], 'slide changes are followed');
    f.advance(FOLLOW_APPLY_MS); f.set([{ id: 'cy', name: 'Cy', presence: { surface: { id: 'slide-2', space: 'unit' } } }]);
    assert.equal(f.follow.state().leader, null, 'the presentation ending ends the presentation follow');
    assert.equal(f.follow.state().notice?.kind, 'stopped');

    f.set([{ id: 'cy', name: 'Cy', presence: { surface: { id: 'comments:t1', space: 'unit' } } }]);
    f.follow.follow('cy');
    f.advance(FOLLOW_APPLY_MS); f.set([{ id: 'cy', name: 'Cy', presence: { surface: { id: 'comments:t1', space: 'unit' }, cursor: { x: .5, y: .5 } } }]);
    f.advance(FOLLOW_APPLY_MS); f.set([{ id: 'cy', name: 'Cy', presence: { surface: { id: 'comments:t2', space: 'unit' } } }]);
    assert.deepEqual(f.located, ['t1', 't2'], 'each thread once, however often their presence repeats it');
    assert.deepEqual(f.locateFocus, [false, false], 'their thread opens without moving this person\'s focus');
    f.advance(FOLLOW_ECHO_MS); f.select(['thread-object']);
    assert.ok(f.follow.state().leader, 'locating their thread may select its object; that is not the person navigating');
    await new Promise(resolve => { setTimeout(resolve, 0); });
    f.advance(FOLLOW_ECHO_MS); f.select(['thread-object', 'mine-now']);
    assert.equal(f.follow.state().leader, null, 'once located, the person\'s own choice stops following again');
  } finally { f.close(); }
});

test('Stop following and Escape bring back the saved view; Escape in a field and a handled Escape do not', () => {
  const f = followFixture();
  try {
    f.setCamera({ scale: 2, x: 5, y: 6 });
    f.set([{ id: 'bea', name: 'Bea', presence: viewport(10) }]);
    f.follow.follow('bea');
    assert.notDeepEqual(f.camera(), { scale: 2, x: 5, y: 6 });
    f.key('Escape', f.doc.getElementById('field')!);
    assert.ok(f.follow.state().leader, 'Escape while typing belongs to the field');
    const handled = new f.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    handled.preventDefault(); f.doc.body.dispatchEvent(handled);
    assert.ok(f.follow.state().leader, 'an Escape something else already handled is not ours');
    const popover = (event: KeyboardEvent): void => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); } };
    f.doc.addEventListener('keydown', popover);
    f.key('Escape');
    assert.ok(f.follow.state().leader, 'an open popover takes Escape first, so one Escape closes one thing');
    f.doc.removeEventListener('keydown', popover);
    const pressed = f.key('Escape');
    assert.equal(pressed.defaultPrevented, true);
    assert.equal(f.follow.state().leader, null);
    assert.deepEqual(f.camera(), { scale: 2, x: 5, y: 6 }, 'Escape returns to the view from before following');
    assert.deepEqual(f.patches.at(-1), { following: undefined });
    assert.equal(f.stage.querySelector('.collab-follow-frame'), null);
    assert.equal(f.follow.state().notice?.kind, 'stopped');
    assert.equal(f.follow.state().notice?.name, 'Bea');
    f.advance(FOLLOW_NOTICE_MS); f.flush();
    assert.equal(f.follow.state().notice, null, 'the notice clears itself');

    f.follow.follow('bea');
    f.follow.stop();
    assert.deepEqual(f.camera(), { scale: 2, x: 5, y: 6 }, 'Stop following does the same');
  } finally { f.close(); }
});

test('Escape inside a dialog, a menu or a list box closes only that layer and leaves following on', () => {
  const f = followFixture();
  try {
    f.set([{ id: 'bea', name: 'Bea', presence: viewport(10) }]);
    f.follow.follow('bea');
    // A modal dialog: its close is Escape's default action, so the key must not be cancelled.
    const dialog = f.doc.createElement('dialog'); dialog.setAttribute('open', ''); dialog.innerHTML = '<button>Close preview</button>';
    f.doc.body.append(dialog);
    const inDialog = f.key('Escape', dialog.querySelector('button')!);
    assert.ok(f.follow.state().leader, 'Escape in an open dialog leaves following on');
    assert.equal(inDialog.defaultPrevented, false, 'and the dialog still gets its close request');
    f.key('Escape');
    assert.ok(f.follow.state().leader, 'while a dialog is open, Escape belongs to the dialog wherever focus is');
    dialog.remove();
    for (const role of ['dialog', 'alertdialog', 'menu', 'listbox']) {
      const layer = f.doc.createElement('div'); layer.setAttribute('role', role); layer.innerHTML = '<button>Option</button>';
      f.doc.body.append(layer);
      f.key('Escape', layer.querySelector('button')!);
      assert.ok(f.follow.state().leader, `Escape in a ${role} leaves following on`);
      layer.remove();
    }
    // A tool popover closes itself on Escape in the capture phase without cancelling the key:
    // the option that had focus has left the page by the time the key reaches the window.
    const popover = f.doc.createElement('div'); popover.setAttribute('role', 'listbox'); popover.innerHTML = '<button role="option">Bold</button>';
    const plain = f.doc.createElement('div'); plain.innerHTML = '<button>Detached</button>';
    f.doc.body.append(popover, plain);
    const closePopover = (event: KeyboardEvent): void => { if (event.key === 'Escape') { popover.remove(); plain.remove(); } };
    f.doc.addEventListener('keydown', closePopover, true);
    f.key('Escape', popover.querySelector('button')!);
    assert.ok(f.follow.state().leader, 'one Escape closes the popover and nothing else');
    f.doc.body.append(plain);
    f.key('Escape', plain.querySelector('button')!);
    assert.ok(f.follow.state().leader, 'a key whose element left the page during the key was handled by another layer');
    f.doc.removeEventListener('keydown', closePopover, true);
    const pressed = f.key('Escape');
    assert.equal(pressed.defaultPrevented, true);
    assert.equal(f.follow.state().leader, null, 'with no layer open, Escape stops following');
  } finally { f.close(); }
});

test('the person\'s own wheel, drag, zoom key or selection stops following and keeps the view', () => {
  const f = followFixture();
  try {
    f.setCamera({ scale: 2, x: 5, y: 6 });
    f.set([{ id: 'bea', name: 'Bea', presence: viewport(10) }]);
    const following = (): void => { f.follow.follow('bea'); assert.ok(f.follow.state().leader); f.advance(FOLLOW_ECHO_MS); };
    const keptView = (why: string): void => {
      assert.equal(f.follow.state().leader, null, why);
      assert.equal(f.camera().x, -10, `${why}: the current view is kept`);
    };

    f.follow.follow('bea');
    f.canvas.dispatchEvent(new f.dom.window.WheelEvent('wheel', { bubbles: true }));
    assert.ok(f.follow.state().leader, 'input inside 50 ms of a programmatic change is that change echoing');
    f.advance(FOLLOW_ECHO_MS);
    f.canvas.dispatchEvent(new f.dom.window.WheelEvent('wheel', { bubbles: true }));
    keptView('a wheel');

    following(); f.key('+'); keptView('a zoom key');
    following(); f.key('1', f.doc.getElementById('field')!); assert.ok(f.follow.state().leader, 'a digit typed into a field is not a zoom');
    f.key('2', f.doc.body, { shiftKey: true, code: 'Digit2' }); keptView('Shift+2');

    following(); f.pointer('pointerdown', 0); f.pointer('pointermove', 2);
    assert.ok(f.follow.state().leader, 'a click that barely moves is not a drag');
    f.pointer('pointermove', 9); keptView('a stage drag');
    f.pointer('pointerup', 9);

    following(); f.pointer('pointerdown', 0); f.pointer('pointerdown', 50); keptView('a second pointer, a pinch');
    f.pointer('pointerup', 0); f.pointer('pointerup', 50);

    following(); f.select(['mine']); assert.ok(f.follow.state().leader, 'the same selection is no change');
    f.select([]); assert.ok(f.follow.state().leader, 'a selection emptied by someone else\'s edit is not navigation');
    f.select(['other']); keptView('choosing something');

    following(); f.viewEvent(); assert.ok(f.follow.state().leader, 'the echo of a programmatic change is ignored');
    f.viewEvent(); assert.ok(f.follow.state().leader, 'a view change nobody pressed for (a resize) is ignored');
    f.pointer('pointerdown', 0, 0, f.doc.body); f.viewEvent(); keptView('a press then a view change: a zoom button');
  } finally { f.close(); }
});

test('the person leaving or going away ends the follow with a status; nothing stays behind', () => {
  const f = followFixture();
  try {
    f.set([{ id: 'bea', name: 'Bea', presence: viewport(10) }]);
    f.follow.follow('bea');
    f.set([{ id: 'bea', name: 'Bea', away: true, presence: viewport(10) }]);
    assert.equal(f.follow.state().leader, null);
    assert.deepEqual(f.follow.state().notice && { kind: f.follow.state().notice!.kind, name: f.follow.state().notice!.name }, { kind: 'left', name: 'Bea' });
    f.set([{ id: 'bea', name: 'Bea', presence: viewport(10) }]);
    f.follow.follow('bea');
    assert.equal(f.follow.state().notice, null, 'a new follow clears the old notice');
    f.set([]);
    assert.equal(f.follow.state().notice?.kind, 'left', 'leaving the room too');
    f.follow.follow('bea'); assert.equal(f.follow.state().leader, null, 'nobody to follow');

    f.set([{ id: 'bea', name: 'Bea', away: true }]); f.follow.follow('bea');
    assert.equal(f.follow.state().leader, null, 'an away person cannot be followed');
    f.set([{ id: 'bea', name: 'Bea' }], 'reconnecting'); f.follow.follow('bea');
    assert.equal(f.follow.state().leader, null, 'nor anyone while the room is not live');

    f.set([{ id: 'bea', name: 'Bea', presence: viewport(10) }]); f.follow.follow('bea');
    f.follow.dispose();
    assert.equal(f.timers.size, 0, 'dispose drops every timer');
    assert.equal(f.stage.querySelector('.collab-follow-frame'), null);
    f.canvas.dispatchEvent(new f.dom.window.WheelEvent('wheel', { bubbles: true }));
    assert.equal(f.follow.state().leader?.name, 'Bea', 'a disposed controller does nothing more');
  } finally { f.close(); }
});

test('followers are named from presence, and the presenter shown is the earliest present one', () => {
  const f = followFixture();
  const seen: number[] = [];
  const off = f.follow.subscribe(s => { seen.push(s.followers.length); });
  try {
    f.set([
      { id: 'ana', name: 'Ana', away: true, presence: { presenting: true, following: 'me' } },
      { id: 'bea', name: 'Bea', presence: { following: 'me' } },
      { id: 'cy', name: 'Cy', presence: { presenting: true, following: 'someone-else' } },
      { id: 'dee', name: 'Dee', presence: { presenting: true } },
    ]);
    assert.deepEqual(f.follow.state().followers.map(p => p.name), ['Ana', 'Bea'], 'everyone whose presence follows this person');
    assert.equal(f.follow.state().presenter?.name, 'Cy', 'one presenter: Ana is away, Dee joined later');
    f.set([{ id: 'bea', name: 'Bea', presence: { following: 'me' } }]);
    assert.deepEqual(seen, [2, 1], 'subscribers hear about changes only');
  } finally { off(); f.close(); }
});
