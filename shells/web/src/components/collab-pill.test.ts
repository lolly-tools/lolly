// SPDX-License-Identifier: MPL-2.0
/**
 * collab-pill - the stage cluster (plan 100 section 4.6), driven from a scripted state
 * stream.
 *
 * The pill is the anchor component of the whole presence surface, and almost
 * everything it does is a promise about how a person reads it rather than about
 * what the DOM contains. So the cases are chosen for what a regression would cost
 * SOMEONE, not for coverage:
 *
 *  1. The avatar stack shows 3 and then "+N" - the plan's number, and the thing that
 *     stops a six-person roster from pushing the zoom HUD off the stage.
 *  2. The connection dot is never colour ALONE (section 4.8). `data-state` is what CSS
 *     hangs a distinct SHAPE off, and the `title` plus a live-region label carry it
 *     for anyone not reading shapes either - so the attribute, the title and the
 *     text are all asserted, and so is the fact that reconnecting ≠ away.
 *  3. Nameless people fall back by ROLE, not by device id: the inviter reads as
 *     "Host", everyone else as "Invitee", numbered from the second (section 4.5).
 *  4. The invite slot exists only when a caller supplies `onInvite`. A dead invite
 *     button in a session you cannot invite into is worse than none.
 *  5. Joins and leaves are announced once each, by name, and the FIRST render - the
 *     roster as found - announces nothing.
 *  6. The roster popover lists everyone with their tags, live-updates while open,
 *     and closes on Escape.
 *  7. The injected sheet keeps its two house promises: every font-size rides
 *     `--a11y-fs`, and the inline axis is written LOGICALLY so RTL mirrors for free.
 *
 * Run directly:  node --test shells/web/src/components/collab-pill.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { CollabParticipant, CollabSessionState } from '../lib/collab-session.ts';

const dom = new JSDOM('<!doctype html><html><body><main id="stage"></main></body></html>', {
  url: 'http://localhost/#/t/qr-code',
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.MouseEvent = dom.window.MouseEvent;

const {
  mountCollabPill, collabDisplayName, collabInitials, collabChipName, pillDotState,
  COLLAB_STACK_MAX, COLLAB_CHIP_MAX, STRINGS,
} = await import('./collab-pill.ts');

// ── fixtures ──────────────────────────────────────────────────────────────────

const participant = (over: Partial<CollabParticipant> = {}): CollabParticipant => ({
  clientId: 'X', userId: 'X', name: '', color: '#00aa00', colorIndex: 1,
  away: false, isSelf: false, isHost: false, inviteeIndex: 0, ...over,
});

const me = participant({ clientId: 'SELF', userId: 'SELF', name: 'Andy', color: '#aa0000', colorIndex: 0, isSelf: true });

const sessionState = (over: Partial<CollabSessionState> = {}): CollabSessionState => ({
  connection: 'live', role: 'writer', self: me, peers: [], ...over,
});

/** A scripted state stream - the component's only input. */
function source(initial: CollabSessionState) {
  let current = initial;
  const subs = new Set<(s: CollabSessionState) => void>();
  return {
    state: () => current,
    subscribe(fn: (s: CollabSessionState) => void): () => void {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
    push(next: CollabSessionState): void { current = next; for (const fn of [...subs]) fn(next); },
    subscribers: () => subs.size,
  };
}

const stage = (): HTMLElement => {
  const el = document.createElement('div');
  document.getElementById('stage')!.appendChild(el);
  return el;
};

/** A pill mounted with the announcer and the motion read stubbed out. */
function mount(
  state: CollabSessionState,
  over: {
    onInvite?: () => void;
    reducedMotion?: () => boolean;
    actions?: readonly import('./collab-pill.ts').CollabPillAction[];
  } = {},
) {
  const host = stage();
  const src = source(state);
  const said: string[] = [];
  const pill = mountCollabPill(host, {
    source: src,
    announce: (m) => { said.push(m); },
    reducedMotion: () => true,
    className: 'collab-pill--stage',
    ...over,
  });
  return {
    host, src, said, pill,
    // The "+N" counter carries `.collab-av` too (same disc geometry), so a count of
    // PEOPLE has to exclude it.
    avatars: () => [...pill.el.querySelectorAll('.collab-stack .collab-av:not(.collab-av--more)')],
  };
}

// ── pure helpers ──────────────────────────────────────────────────────────────

test('display names fall back by ROLE, and only the second invitee onward is numbered', () => {
  assert.equal(collabDisplayName(participant({ name: 'Priya Fernandes' })), 'Priya Fernandes');
  assert.equal(collabDisplayName(participant({ isHost: true })), 'Host');
  assert.equal(collabDisplayName(participant({ inviteeIndex: 1 })), 'Invitee');
  assert.equal(collabDisplayName(participant({ inviteeIndex: 3 })), 'Invitee 3');
  assert.equal(
    collabDisplayName(participant({ name: 'Sam', isHost: true })),
    'Sam',
    'a chosen name always beats the fallback',
  );
});

test('initials take the first letter of the first two WORDS, by code point', () => {
  assert.equal(collabInitials('Priya Fernandes'), 'PF');
  assert.equal(collabInitials('andy'), 'A');
  assert.equal(collabInitials('  Ada  Lovelace  King '), 'AL', 'two words, not three');
  assert.equal(collabInitials('🐙 squid'), '🐙S', 'an astral first character survives whole');
  assert.equal(collabInitials('   '), '', 'no letters is an empty disc, not a crash');
});

test('chip names truncate; the roster and the announcements keep the whole thing', () => {
  const short = 'Priya F.';
  assert.equal(collabChipName(short), short);
  const long = 'Bartholomew Fitzsimon';
  const chip = collabChipName(long);
  assert.equal([...chip].length, COLLAB_CHIP_MAX);
  assert.ok(chip.endsWith('…'));
});

test('the dot reads away only when everyone else IS away - being alone is not being away', () => {
  assert.equal(pillDotState(sessionState()), 'live');
  assert.equal(pillDotState(sessionState({ connection: 'connecting' })), 'connecting');
  assert.equal(pillDotState(sessionState({ connection: 'reconnecting' })), 'reconnecting');
  assert.equal(pillDotState(sessionState({ connection: 'closed' })), 'closed');
  assert.equal(
    pillDotState(sessionState({ peers: [participant({ clientId: 'P1', away: true })] })),
    'away',
  );
  assert.equal(
    pillDotState(sessionState({
      peers: [participant({ clientId: 'P1', away: true }), participant({ clientId: 'P2' })],
    })),
    'live',
    'one attentive peer is enough',
  );
});

// ── the component ─────────────────────────────────────────────────────────────

test('the avatar stack shows self plus peers, in colour, and collapses past three', () => {
  const peers = ['P1', 'P2', 'P3', 'P4'].map((id, i) =>
    participant({ clientId: id, userId: id, name: `Peer ${i}`, color: '#0000aa' }));
  const { pill, avatars } = mount(sessionState({ peers: peers.slice(0, 1) }));

  assert.equal(avatars().length, 2, 'self and the one peer');
  assert.equal((avatars()[0] as HTMLElement).style.background, 'rgb(170, 0, 0)', 'the collaborator colour paints the disc');
  assert.equal((avatars()[0] as HTMLElement).title, 'Andy');
  assert.equal(avatars()[0]!.textContent, 'A', 'initials, and they are aria-hidden');
  assert.equal(avatars()[0]!.querySelector('[aria-hidden="true"]')?.textContent, 'A');

  pill.refresh();
  assert.equal(avatars().length, 2, 'refresh() re-renders from the same state, idempotently');
  pill.destroy();

  const many = mount(sessionState({ peers }));
  assert.equal(many.avatars().length, COLLAB_STACK_MAX, 'three discs, no more');
  const more = many.pill.el.querySelector('.collab-av--more');
  assert.equal(more?.textContent, '+2', 'and the rest become one counter');
  assert.equal(
    many.pill.el.querySelector('.collab-stack')?.getAttribute('aria-label'),
    'Collaborators: Andy, Peer 0, Peer 1, Peer 2, Peer 3',
    'the accessible name lists EVERYONE, not only the three on screen',
  );
  many.pill.destroy();
});

test('the connection dot pairs its colour with a state attribute, a title and a spoken label', () => {
  const { pill, src } = mount(sessionState({ connection: 'connecting' }));
  const dot = pill.el.querySelector<HTMLElement>('.collab-dot')!;
  const spoken = (): string => pill.el.querySelector('.visually-hidden')!.textContent ?? '';

  assert.equal(dot.dataset.state, 'connecting');
  assert.equal(dot.title, 'Connecting');
  assert.equal(spoken(), 'Connecting');

  src.push(sessionState({ connection: 'live' }));
  assert.equal(dot.dataset.state, 'live');
  assert.equal(spoken(), 'Live');

  src.push(sessionState({ connection: 'reconnecting' }));
  assert.equal(dot.dataset.state, 'reconnecting', 'a UDP blip is its own state, not a failure');
  assert.equal(spoken(), 'Reconnecting');

  src.push(sessionState({ peers: [participant({ clientId: 'P1', name: 'Sam', away: true })] }));
  assert.equal(dot.dataset.state, 'away');
  assert.equal(spoken(), 'Away');

  src.push(sessionState({ connection: 'closed' }));
  assert.equal(dot.dataset.state, 'closed');
  assert.equal(spoken(), 'Disconnected');

  pill.destroy();
});

test('an observer is told so on the pill itself, not only in the roster', () => {
  const writer = mount(sessionState());
  assert.equal(writer.pill.el.querySelector('.collab-pill-tags')?.textContent, '');
  writer.pill.destroy();

  const observer = mount(sessionState({ role: 'observer' }));
  assert.equal(observer.pill.el.querySelector('.collab-pill-tags')?.textContent, 'Observing');
  observer.pill.destroy();
});

test('the invite slot renders only when a caller supplies one', () => {
  const none = mount(sessionState());
  assert.equal(none.pill.el.querySelector('.collab-invite'), null, 'no callback, no control');
  none.pill.destroy();

  let invites = 0;
  const withSlot = mount(sessionState(), { onInvite: () => { invites += 1; } });
  const button = withSlot.pill.el.querySelector<HTMLButtonElement>('.collab-invite')!;
  assert.equal(button.getAttribute('aria-label'), 'Invite someone');
  assert.ok(button.querySelector('svg'), 'it carries an icon, not a bare glyph');
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(invites, 1);
  withSlot.pill.destroy();
});

// ── action slots (section 6.4's "Send this session" is the first one) ────────────────

test('an action slot renders only when a caller supplies one, and the PILL owns its words', () => {
  const none = mount(sessionState());
  assert.equal(none.pill.el.querySelector('.collab-action'), null, 'no action, no control');
  none.pill.destroy();

  let sends = 0;
  const withAction = mount(sessionState(), {
    actions: [{ kind: 'send-session', onSelect: () => { sends += 1; } }],
  });
  const button = withAction.pill.el.querySelector<HTMLButtonElement>('.collab-action')!;
  assert.equal(button.dataset.action, 'send-session');
  assert.equal(
    button.getAttribute('aria-label'), STRINGS.sendSession,
    'the caller supplies behaviour; the copy comes out of this file\'s map, where the '
    + 'translation corpus can see it',
  );
  assert.equal(button.title, STRINGS.sendSession);
  assert.ok(button.querySelector('svg'), 'it carries an icon, not a bare glyph');
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(sends, 1);
  withAction.pill.destroy();
});

test('an action hides itself the moment it stops being available, and comes back', () => {
  // The beam's case: the bulk lane dies with the pair, and a button that can only fail
  // is the dead control section 4.6 refuses. The predicate is re-read on every paint, so the
  // session's own state stream is what makes it live.
  let open = false;
  const { pill, src } = mount(sessionState(), {
    actions: [{ kind: 'send-session', available: () => open, onSelect: () => {} }],
  });
  const button = pill.el.querySelector<HTMLButtonElement>('.collab-action')!;
  assert.equal(button.hidden, true, 'pre-connect it must not paint');

  open = true;
  src.push(sessionState());
  assert.equal(button.hidden, false);

  open = false;
  src.push(sessionState({ connection: 'closed' }));
  assert.equal(button.hidden, true, 'a dropped pair takes the control with it');
  pill.destroy();
});

test('an action runs once at a time, and a failure is announced rather than swallowed', async () => {
  let running = 0;
  let peak = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  const { pill, said } = mount(sessionState(), {
    actions: [{
      kind: 'send-session',
      async onSelect() {
        running += 1;
        peak = Math.max(peak, running);
        await gate;
        running -= 1;
        throw new Error('the lane is down');
      },
    }],
  });
  const button = pill.el.querySelector<HTMLButtonElement>('.collab-action')!;
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  // The impatient second click: a beam started twice comes back as `busy`, which a human
  // reads as "it didn't work".
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(button.disabled, true, 'the control disables itself for the duration');
  assert.equal(peak, 1, 'a double click must not start two transfers');

  release();
  await new Promise((r) => { setTimeout(r, 0); });
  assert.deepEqual(said, [STRINGS.sendFailed], 'a refusal that never reached the toast is announced here');
  assert.equal(button.disabled, false, 'and the control comes back');
  pill.destroy();
});

test('joins and leaves are announced once each, by name - and the first render is silent', () => {
  const priya = participant({ clientId: 'P1', userId: 'P1', name: 'Priya' });
  const sam = participant({ clientId: 'P2', userId: 'P2', name: 'Sam' });
  const { pill, src, said } = mount(sessionState({ peers: [priya] }));
  assert.deepEqual(said, [], 'the roster as found is not a burst of arrivals');

  src.push(sessionState({ peers: [priya, sam] }));
  assert.deepEqual(said, ['Sam joined']);

  // A re-render with the same roster must not repeat itself.
  src.push(sessionState({ peers: [priya, sam] }));
  assert.deepEqual(said, ['Sam joined']);

  src.push(sessionState({ peers: [sam] }));
  assert.deepEqual(said, ['Sam joined', 'Priya left'], 'the name survives the person leaving');

  // A nameless peer is announced by the same fallback the avatars use.
  src.push(sessionState({ peers: [sam, participant({ clientId: 'P3', userId: 'P3', inviteeIndex: 2 })] }));
  assert.equal(said.at(-1), 'Invitee 2 joined');
  pill.destroy();
});

test('the roster popover lists everyone with their tags, updates live, and closes on Escape', () => {
  const observer = participant({ clientId: 'P1', userId: 'P1', name: 'Priya', role: 'observer' });
  const nameless = participant({ clientId: 'P2', userId: 'P2', isHost: true });
  const { pill, src } = mount(sessionState({ peers: [observer, nameless] }));
  const stack = pill.el.querySelector<HTMLButtonElement>('.collab-stack')!;

  assert.equal(stack.getAttribute('aria-expanded'), 'false');
  stack.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const roster = document.querySelector('.collab-roster')!;
  assert.ok(roster, 'the popover mounted');
  assert.equal(stack.getAttribute('aria-expanded'), 'true');

  const rows = [...roster.querySelectorAll('.collab-roster-row')];
  assert.equal(rows.length, 3, 'self first, then the roster in join order');
  assert.equal(rows[0]!.querySelector('.collab-roster-name')?.textContent, 'Andy');
  assert.equal(rows[0]!.querySelector('.collab-roster-tags')?.textContent, 'You');
  assert.equal(rows[1]!.querySelector('.collab-roster-name')?.textContent, 'Priya');
  assert.equal(
    rows[1]!.querySelector('.collab-roster-tags')?.textContent,
    'Observer',
    'only an observer is tagged - an unknown role makes no claim',
  );
  assert.equal(rows[2]!.querySelector('.collab-roster-name')?.textContent, 'Host');
  assert.equal(rows[2]!.querySelector('.collab-roster-tags')?.textContent, 'Host');

  // A peer going away while the roster is open must show there, not only in the dot.
  src.push(sessionState({ peers: [{ ...observer, away: true }, nameless] }));
  const open = document.querySelector('.collab-roster')!;
  assert.match(open.querySelectorAll('.collab-roster-row')[1]!.textContent ?? '', /Away/);

  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.querySelector('.collab-roster'), null, 'Escape closes it (house rule)');
  assert.equal(stack.getAttribute('aria-expanded'), 'false');
  pill.destroy();
});

test('destroy() unsubscribes, closes the popover and removes the element - idempotently', () => {
  const { pill, src, host } = mount(sessionState());
  pill.el.querySelector<HTMLButtonElement>('.collab-stack')!
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.ok(document.querySelector('.collab-roster'));
  assert.equal(src.subscribers(), 1);

  pill.destroy();
  assert.equal(src.subscribers(), 0);
  assert.equal(document.querySelector('.collab-roster'), null);
  assert.equal(pill.el.isConnected, false);
  assert.equal(host.children.length, 0);

  pill.destroy();
  src.push(sessionState({ connection: 'closed' }));
  assert.equal(pill.el.dataset.state, undefined, 'a destroyed pill is not still rendering');
});

test('a new arrival gets the entrance flash only when motion is allowed', () => {
  const peer = participant({ clientId: 'P1', userId: 'P1', name: 'Priya' });
  const still = mount(sessionState());
  still.src.push(sessionState({ peers: [peer] }));
  assert.equal(still.pill.el.querySelector('.collab-av.is-new'), null, 'reduced motion: no flash');
  still.pill.destroy();

  const moving = mount(sessionState(), { reducedMotion: () => false });
  moving.src.push(sessionState({ peers: [peer] }));
  assert.ok(moving.pill.el.querySelector('.collab-av.is-new'), 'and otherwise, one');
  assert.equal(
    moving.pill.el.querySelector('.collab-stack .collab-av')?.classList.contains('is-new'),
    false,
    'never on yourself - you did not just arrive',
  );
  moving.pill.destroy();
});

// ── the injected sheet's own promises ─────────────────────────────────────────

/** The one `<style>` the component injects, id-guarded and shared across mounts. */
function sheet(): string {
  const el = document.getElementById('collab-pill-styles');
  assert.ok(el, 'the component injects its own sheet (the music-player/neuro-dock idiom)');
  return el!.textContent ?? '';
}

test('the sheet is injected exactly once, however many pills mount', () => {
  const a = mount(sessionState());
  const b = mount(sessionState());
  assert.equal(document.querySelectorAll('#collab-pill-styles').length, 1);
  a.pill.destroy();
  b.pill.destroy();
  assert.equal(
    document.querySelectorAll('#collab-pill-styles').length, 1,
    'and it survives teardown - it is shared, not per-instance',
  );
});

test('every font-size in the sheet rides the --a11y-fs multiplier', () => {
  const sizes = [...sheet().matchAll(/font-size:[^;}]+/g)].map(m => m[0]);
  assert.ok(sizes.length >= 4, 'sanity: the sheet does set type');
  for (const decl of sizes) {
    assert.match(decl, /var\(--a11y-fs\)/, `unscaled type: ${decl}`);
  }
});

test('the inline axis is written logically, so RTL mirrors with no second stylesheet', () => {
  // Block-axis physicals (top/bottom) are direction-agnostic and stay; it is the
  // INLINE axis that flips, and every one of those must be a logical property.
  const physical = /(^|[;{\s])(margin|padding|border|inset)?-?(left|right)\s*:/g;
  const hits = [...sheet().matchAll(physical)].map(m => m[0].trim());
  assert.deepEqual(hits, [], `physical inline properties would not mirror: ${hits.join(', ')}`);
  assert.match(sheet(), /inset-inline-end/, 'the stage placement is logical');
  assert.match(sheet(), /margin-inline-start/, 'and so is the avatar overlap');
});

test('the reconnecting pulse and the entrance flash are gated on BOTH motion signals', () => {
  const css = sheet();
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'the OS preference');
  assert.match(css, /html\[data-a11y-motion="reduce"\]/, "and the app's own (parts/base.css does not zero transitions globally)");
  for (const cls of ['collab-dot\\[data-state="reconnecting"\\]', 'collab-av\\.is-new']) {
    const gated = new RegExp(`html\\[data-a11y-motion="reduce"\\][^{]*${cls}[^{]*\\{[^}]*animation:\\s*none`);
    assert.match(css, gated, `${cls} is not gated on the app preference`);
  }
});

test('the dot has a distinct shape per state, so colour is never carrying it alone', () => {
  const css = sheet();
  for (const state of ['live', 'connecting', 'reconnecting', 'away', 'closed']) {
    assert.match(
      css,
      new RegExp(`\\.collab-dot\\[data-state="${state}"\\]`),
      `no rule paints the ${state} dot`,
    );
  }
  // Filled disc vs hollow ring vs split disc vs barred ring - four different shapes,
  // each still legible with every hue removed.
  assert.match(css, /\.collab-dot\[data-state="away"\]\s*\{[^}]*linear-gradient/);
  assert.match(css, /\.collab-dot\[data-state="closed"\]::after/);
});

test('every avatar carries the 1px theme-contrast halo (section 4.4), not just a colour', () => {
  assert.match(sheet(), /\.collab-av\s*\{[^}]*box-shadow:[^;]*var\(--foreground\)/);
});
