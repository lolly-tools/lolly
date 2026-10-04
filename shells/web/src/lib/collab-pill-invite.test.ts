// SPDX-License-Identifier: MPL-2.0
/**
 * lib/collab-pill-invite.ts - the seam that fills the collab pill's invite slot, and
 * the one place that reads it (views/tool-collab.ts).
 *
 * The seam: dormant by default, last wins, an unregister removes only its own
 * provider, and a provider or an action that throws never reaches the pill. The tool
 * view: the pill grows its invite button only when a provider offers one, pressing
 * the button runs that provider's action, and the provider is told the tool and this
 * client's role.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/collab-pill-invite.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import type { CollabSessionHandle } from './collab-session.ts';

const dom = new JSDOM(
  `<!doctype html><html><body>
     <div class="tool-stage" id="tool-stage">
       <div class="stage-nav" id="stage-nav"></div>
       <div class="tool-canvas-outer"><div class="tool-canvas" id="tool-canvas"></div></div>
     </div>
     <div id="tool-inputs"></div>
   </body></html>`,
  { url: 'http://localhost/#/t/qr-code' },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) =>
  setTimeout(() => { cb(Date.now()); }, 0) as unknown as number) as typeof globalThis.requestAnimationFrame;
globalThis.cancelAnimationFrame ??= ((h: number) => {
  clearTimeout(h as unknown as ReturnType<typeof setTimeout>);
}) as typeof globalThis.cancelAnimationFrame;
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof globalThis.ResizeObserver;

const { registerCollabPillInvite, collabPillInviteFor, _clearCollabPillInviteForTests } = await import('./collab-pill-invite.ts');
const { mountToolCollab } = await import('../views/tool-collab.ts');
type CollabPillInviteContext = import('./collab-pill-invite.ts').CollabPillInviteContext;

const ctx: CollabPillInviteContext = { toolId: 'qr-code', role: () => 'writer' };

// ── The seam ──────────────────────────────────────────────────────────────────

test('dormant by default: no provider, no invite', () => {
  _clearCollabPillInviteForTests();
  assert.equal(collabPillInviteFor(ctx), null);
});

test('a provider decides per pill, last wins, and an unregister removes only its own', () => {
  _clearCollabPillInviteForTests();
  const seen: CollabPillInviteContext[] = [];
  let pressed = 0;
  const offFirst = registerCollabPillInvite((c) => { seen.push(c); return c.toolId === 'qr-code' ? () => { pressed += 1; } : null; });
  const invite = collabPillInviteFor(ctx);
  assert.equal(typeof invite, 'function');
  assert.equal(seen[0], ctx, 'the provider is told about the pill');
  invite!();
  assert.equal(pressed, 1);
  assert.equal(collabPillInviteFor({ ...ctx, toolId: 'barcode' }), null, 'the provider may offer none');

  const offSecond = registerCollabPillInvite(() => null);
  assert.equal(collabPillInviteFor(ctx), null, 'the later registration replaced the first');
  offFirst();
  assert.equal(collabPillInviteFor(ctx), null, 'a stale unregister does not remove the current provider');
  offSecond();
  registerCollabPillInvite(() => () => {});
  assert.equal(typeof collabPillInviteFor(ctx), 'function');
  _clearCollabPillInviteForTests();
});

test('a throwing provider reads as no invite, and a throwing action is swallowed', () => {
  _clearCollabPillInviteForTests();
  registerCollabPillInvite(() => { throw new Error('boom'); });
  assert.equal(collabPillInviteFor(ctx), null);
  registerCollabPillInvite(() => () => { throw new Error('boom'); });
  const invite = collabPillInviteFor(ctx)!;
  assert.doesNotThrow(() => invite());
  registerCollabPillInvite(() => 'not a function' as unknown as () => void);
  assert.equal(collabPillInviteFor(ctx), null);
  _clearCollabPillInviteForTests();
});

// ── The tool view reads it ────────────────────────────────────────────────────

function fakeHandle(role: 'writer' | 'observer' = 'writer'): CollabSessionHandle {
  return {
    adapter: {
      onLocalChange: () => [],
      apply: () => {},
      applyRemotePatch: () => ({ col: '', moved: [], restyled: [], added: [], removed: [], zChanged: false }),
      presence: () => {},
      state: () => ({ boxes: new Map(), params: new Map(), order: [] }),
    } as unknown as CollabSessionHandle['adapter'],
    role,
    self: { clientId: 'ME', name: 'Andy' },
    presenceIn: { subscribe: () => () => {} },
    sendPresence: () => {},
    events: { subscribe: () => () => {} },
    close: () => {},
  } as CollabSessionHandle;
}

async function mount(role: 'writer' | 'observer' = 'writer') {
  const doc = dom.window.document;
  const stage = doc.getElementById('tool-stage')!;
  for (const el of [...stage.children]) if (el.id !== 'stage-nav' && !el.classList.contains('tool-canvas-outer')) el.remove();
  return mountToolCollab({
    handle: fakeHandle(role),
    runtime: {
      getModel: () => [] as never,
      setInput: async (): Promise<void> => {},
      applyPatch: async (): Promise<void> => {},
    },
    toolManifest: { id: 'qr-code' },
    host: null,
    stage,
    canvas: doc.getElementById('tool-canvas')!,
    sidebar: doc.getElementById('tool-inputs'),
    colors: [{ hex: '#aa0000', oklch: { l: 0.7, c: 0.12, h: 20 } }] as never,
    now: () => 0,
    setTimer: () => 0,
    clearTimer: () => {},
    raf: (fn) => { fn(); },
  });
}

const inviteButton = (): HTMLButtonElement | null =>
  dom.window.document.querySelector<HTMLButtonElement>('#tool-stage .collab-pill .collab-invite');

test('the pill has no invite button while nothing offers one', async () => {
  _clearCollabPillInviteForTests();
  const collab = await mount();
  assert.ok(dom.window.document.querySelector('#tool-stage .collab-pill'), 'the pill mounted');
  assert.equal(inviteButton(), null);
  collab.teardown();
});

test('an offered invite becomes the pill button, and pressing it runs the action', async () => {
  _clearCollabPillInviteForTests();
  const seen: { toolId: string; role: string }[] = [];
  let pressed = 0;
  registerCollabPillInvite((c) => {
    seen.push({ toolId: c.toolId, role: c.role() });
    return () => { pressed += 1; };
  });
  const collab = await mount('observer');
  assert.deepEqual(seen, [{ toolId: 'qr-code', role: 'observer' }], 'told the tool and this client\'s role');
  const btn = inviteButton()!;
  assert.ok(btn, 'the invite slot is filled');
  btn.click();
  assert.equal(pressed, 1);
  collab.teardown();
  assert.equal(inviteButton(), null, 'gone with the pill');
  _clearCollabPillInviteForTests();
});
