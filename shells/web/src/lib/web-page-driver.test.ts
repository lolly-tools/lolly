// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createWebPageDriver, getWebPageDriver } from './web-page-driver.ts';

function fixture(url = 'https://outside.test/demo') {
  const dom = new JSDOM('<!doctype html><body><div id="marker"><iframe data-web-live></iframe></div></body>', { url: 'https://deck.test/', pretendToBeVisual: true });
  const marker = dom.window.document.getElementById('marker')!;
  const frame = marker.querySelector('iframe')!; frame.src = url;
  marker.dataset.webView = '1200';
  for (const [key, value] of Object.entries({ clientWidth: 600, clientHeight: 300 })) Object.defineProperty(marker, key, { value });
  const posts: { data: Record<string, unknown>; origin: string }[] = [];
  frame.contentWindow!.postMessage = ((data: Record<string, unknown>, origin: string) => { posts.push({ data, origin }); }) as typeof window.postMessage;
  return { dom, marker, frame, posts };
}
test('handover preserves the clicked child focus while keeping the same authenticated message', () => {
  const f = fixture('https://deck.test/demo');
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  let focused = 0; const focus = f.frame.focus.bind(f.frame);
  f.frame.focus = () => { focused++; focus(); };
  try {
    driver.handKeyboard(true); assert.equal(focused, 1); assert.equal(f.frame.tabIndex, 0);
    const child = f.frame.contentDocument!; child.open(); child.write('<!doctype html><body></body>'); child.close();
    const input = child.createElement('input'); child.body.append(input);
    input.value = 'keep this selection'; input.focus(); input.setSelectionRange(5, 9);
    driver.handKeyboard(true);
    assert.equal(focused, 1); assert.equal(child.activeElement, input); assert.equal(input.selectionStart, 5); assert.equal(input.selectionEnd, 9);
    assert.equal(f.posts.at(-1)?.data.kind, 'handover'); assert.equal(f.posts.at(-1)?.data.hand, true); assert.equal(f.posts.at(-1)?.origin, 'https://deck.test');
    driver.handKeyboard(false); assert.equal(f.frame.tabIndex, -1); assert.equal(f.posts.at(-1)?.data.hand, false);
  } finally { driver.destroy(); f.dom.window.close(); }
});
test('outside driver pans a chosen tall viewport without navigation, clamps depth, and resets size', () => {
  const f = fixture();
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  try {
    driver.configure({ mode: 'pan', pageLength: 3200, start: 0 });
    assert.equal(driver.scrollTo(800), true);
    assert.deepEqual(driver.depth(), { y: 800, max: 2600 });
    assert.equal(f.frame.style.height, '3200px');
    assert.equal(f.frame.style.transform, 'scale(0.5) translateY(-800px)');
    assert.equal(f.frame.src, 'https://outside.test/demo');
    driver.scrollTo(1e9); assert.equal(driver.depth()!.y, 2600);
    assert.equal(driver.scrollTo('#name'), false);
    assert.equal(driver.scrollTo('50%'), true, 'Pan percentages use the chosen viewport range');
    assert.equal(driver.depth()!.y, 1300);
    driver.configure({ mode: 'none', pageLength: 0, start: 0 });
    assert.equal(f.frame.style.height, '600px');
    assert.equal(f.frame.style.transform, 'scale(0.5)');
    assert.equal(driver.depth(), null);
    assert.equal(getWebPageDriver(f.marker as unknown as HTMLElement), driver);
  } finally { driver.destroy(); f.dom.window.close(); }
});
test('receiver accepts only its exact window and origin and keeps replies out of document state', () => {
  const f = fixture(); const events: string[] = [];
  f.marker.addEventListener('lolly:web-driver-change', () => events.push('changed'));
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  const send = (data: unknown, origin = 'https://outside.test', source: unknown = f.frame.contentWindow): void => {
    f.dom.window.dispatchEvent(new f.dom.window.MessageEvent('message', { data, origin, source: source as Window }));
  };
  try {
    const ready = { type: 'lolly:present', v: 1, kind: 'ready', can: ['key', 'scroll', 'depth'], private: 'no' };
    send(ready, 'https://evil.test'); send(ready, 'https://outside.test', {});
    assert.equal(driver.capabilities.backend, 'outside');
    send(ready); assert.equal(driver.capabilities.backend, 'receiver');
    assert.equal(driver.capabilities.checking, false); assert.equal(events.length, 2);
    send({ type: 'lolly:present', v: 1, kind: 'depth', y: 500, max: 400 });
    assert.deepEqual(driver.depth(), { y: 400, max: 400 });
    send({ type: 'lolly:present', v: 1, kind: 'depth', y: NaN, max: 100 });
    assert.deepEqual(driver.depth(), { y: 400, max: 400 });
    assert.equal(events.length, 2, 'depth updates do not rebuild inspector capability rows');
    driver.key('ArrowDown'); driver.scrollTo('50%'); driver.setFocused(true); driver.setSlideActive(true);
    assert.ok(f.posts.every(post => post.origin === 'https://outside.test'));
    assert.ok(f.posts.some(post => post.data.kind === 'scroll' && post.data.to === '50%'));
    assert.equal(f.marker.dataset.interactOpts, undefined, 'the receiver never writes authored options');
  } finally { driver.destroy(); f.dom.window.close(); }
});
test('configure reads new marker options while preserving the existing frame', () => {
  const f = fixture(); f.marker.dataset.interactOpts = 'mode=pan;len=4000;start=640';
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  try {
    assert.equal(driver.depth()!.y, 640);
    f.marker.dataset.interactOpts = 'mode=pan;len=5000'; driver.configure();
    assert.equal(driver.depth()!.y, 640);
    assert.equal(driver.depth()!.max, 4400);
    assert.equal(createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement), driver);
  } finally { driver.destroy(); f.dom.window.close(); }
});
test('capability observers can query registry during creation and destruction without remounting', () => {
  const f = fixture(); const seen: unknown[] = [];
  f.marker.addEventListener('lolly:web-driver-change', () => seen.push(getWebPageDriver(f.marker as unknown as HTMLElement)));
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  try {
    assert.equal(seen.length, 1); assert.equal(seen[0], driver);
    driver.destroy(); assert.equal(seen.at(-1), null);
    assert.equal(getWebPageDriver(f.marker as unknown as HTMLElement), null);
  } finally { driver.destroy(); f.dom.window.close(); }
});
const revealReport = (state: Record<string, unknown>): string => JSON.stringify({ namespace: 'reveal', eventName: 'slidechanged', state });
function messenger(f: ReturnType<typeof fixture>) {
  return (data: unknown, origin = new URL(f.frame.src).origin, source: unknown = f.frame.contentWindow): void => {
    f.dom.window.dispatchEvent(new f.dom.window.MessageEvent('message', { data, origin, source: source as Window }));
  };
}
const revealPosts = (f: ReturnType<typeof fixture>) => f.posts.filter(post => typeof (post.data as unknown) === 'string') as unknown as { data: string; origin: string }[];
test('a reveal.js deck is asked for its state at its own origin and accepted only from its frame', () => {
  const f = fixture('https://slides.com/news/deck/embed?postMessageEvents=true'); const events: string[] = [];
  f.marker.addEventListener('lolly:web-driver-change', () => events.push('changed'));
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  const send = messenger(f);
  try {
    assert.deepEqual(revealPosts(f).map(post => [post.data, post.origin]), [['{"method":"getState","args":[]}', 'https://slides.com']]);
    assert.equal(driver.capabilities.checking, true);
    send(revealReport({ indexh: 2 }), 'https://evil.test'); send(revealReport({ indexh: 2 }), 'https://slides.com', {});
    send(revealReport({ indexh: 2 }), 'https://slides.com', null);
    send({ namespace: 'reveal', eventName: 'ready', state: { indexh: 2 } });
    assert.equal(driver.capabilities.backend, 'outside'); assert.equal(driver.deck!(), null);
    assert.equal(driver.step!(1), false, 'no step is sent before the deck reports');
    send(revealReport({ indexh: 2, indexv: 1, private: 'ignored' }));
    assert.equal(driver.capabilities.backend, 'reveal'); assert.equal(driver.capabilities.checking, false);
    assert.equal(driver.capabilities.key, true); assert.equal(driver.capabilities.scroll, false); assert.equal(driver.capabilities.depth, false);
    assert.deepEqual(driver.deck!(), { h: 2, v: 1, f: null });
    const rows = events.length; let changes = 0; const stop = driver.subscribe(() => changes++);
    send(revealReport({ indexh: 2, indexv: 1 })); assert.equal(changes, 0, 'a repeated report changes nothing');
    send(revealReport({ indexh: 3 })); assert.equal(changes, 1); stop();
    assert.equal(events.length, rows, 'position reports do not rebuild inspector rows');
    f.posts.length = 0;
    assert.equal(driver.step!(1), true); assert.equal(driver.step!(-1), true);
    assert.equal(driver.key('ArrowDown'), true); assert.equal(driver.key('ArrowUp'), true);
    assert.equal(driver.scrollTo(400), false); assert.equal(driver.depth(), null);
    assert.deepEqual(revealPosts(f).map(post => JSON.parse(post.data).method), ['next', 'prev', 'down', 'up']);
    assert.ok(f.posts.every(post => post.origin === 'https://slides.com'), 'commands name the deck origin, never a wildcard');
    assert.equal(f.marker.dataset.interactOpts, undefined, 'a deck never writes authored options');
    f.posts.length = 0; f.frame.dispatchEvent(new f.dom.window.Event('load'));
    assert.equal(driver.capabilities.backend, 'outside'); assert.equal(driver.deck!(), null);
    assert.equal(revealPosts(f).length, 1, 'a reload asks the deck again');
  } finally { driver.destroy(); f.dom.window.close(); }
});
test('only a link that asked for reports is sent reveal.js commands, and a receiver outranks a deck', () => {
  const f = fixture(); const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  const send = messenger(f);
  try {
    assert.equal(revealPosts(f).length, 0, 'an ordinary page is never sent reveal.js text');
    assert.equal(driver.step!(1), false);
    send(revealReport({ indexh: 0 }));
    assert.equal(driver.capabilities.backend, 'reveal', 'a deck whose own script reports is recognised');
    send({ type: 'lolly:present', v: 1, kind: 'ready', can: ['scroll'] });
    assert.equal(driver.capabilities.backend, 'receiver');
    send(revealReport({ indexh: 4 }));
    assert.equal(driver.capabilities.backend, 'receiver'); assert.equal(driver.deck!(), null);
    assert.equal(driver.step!(1), false);
  } finally { driver.destroy(); f.dom.window.close(); }
});
