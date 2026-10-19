// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { REVEAL_MESSAGE_LIMIT, readRevealMessage, revealCommand, revealSlideLabel, sameRevealState, type RevealCommand } from './reveal-deck.ts';

const report = (state: unknown, extra: Record<string, unknown> = {}): string => JSON.stringify({ namespace: 'reveal', eventName: 'slidechanged', state, ...extra });

test('commands are reveal.js JSON text for a fixed set of methods', () => {
  assert.equal(revealCommand('next'), '{"method":"next","args":[]}');
  for (const method of ['prev', 'up', 'down', 'getState'] as const) assert.deepEqual(JSON.parse(revealCommand(method)!), { method, args: [] });
  for (const method of ['setState', 'registerPlugin', 'slide', '__proto__']) assert.equal(revealCommand(method as RevealCommand), null, method);
});

test('a report is read as a bounded slide position and nothing else', () => {
  const state = readRevealMessage(report({ indexh: 3, indexv: 1, indexf: 2, paused: false, overview: true, previewIframe: 'https://x.test/' }, { result: { secret: 1 } }))!;
  assert.deepEqual(state, { h: 3, v: 1, f: 2 });
  assert.equal(Object.keys(state).length, 3);
  assert.deepEqual(readRevealMessage(report({ indexh: 0 })), { h: 0, v: 0, f: null }, 'reveal.js omits an absent fragment index');
  assert.deepEqual(readRevealMessage(report({ indexh: 1e9, indexv: -4, indexf: -9 })), { h: 9999, v: 0, f: -1 });
  assert.equal(readRevealMessage(JSON.stringify({ namespace: 'reveal', eventName: 'callback', method: 'getState', state: { indexh: 2, indexv: 0 } }))!.h, 2);
  assert.equal(revealSlideLabel({ h: 3, v: 1, f: null }), '4.2');
  assert.equal(revealSlideLabel({ h: 0, v: 0, f: null }), '1');
});

test('anything that is not a reveal.js report is refused', () => {
  const refused: unknown[] = [
    { namespace: 'reveal', eventName: 'ready', state: { indexh: 1 } },
    report({ indexh: 1 }).slice(0, -1), ` ${report({ indexh: 1 })}`, '{not json}',
    JSON.stringify({ namespace: 'lolly', eventName: 'ready', state: { indexh: 1 } }),
    JSON.stringify({ namespace: 'reveal', state: { indexh: 1 } }),
    JSON.stringify({ namespace: 'reveal', eventName: 'x'.repeat(65), state: { indexh: 1 } }),
    report(null), report([1, 2]), report({ indexh: '1' }), report({ indexh: 1.5 }), report({ indexh: 1, indexv: Number.NaN }),
    report({ indexh: 1 }, { pad: 'x'.repeat(REVEAL_MESSAGE_LIMIT) }),
    '{"__proto__":{"namespace":"reveal"},"eventName":"ready","state":{"indexh":1}}',
    '{"namespace":"reveal","eventName":"ready","state":{"__proto__":{"indexh":1}}}',
    42, null, undefined,
  ];
  for (const data of refused) assert.equal(readRevealMessage(data), null, String(data).slice(0, 80));
  const plain: Record<string, unknown> = {};
  assert.equal(plain.namespace, undefined, 'parsing never writes to Object.prototype');
});

test('state comparison treats a missing report as a change', () => {
  const a = { h: 1, v: 0, f: null };
  assert.equal(sameRevealState(a, { ...a }), true);
  assert.equal(sameRevealState(a, { ...a, f: 0 }), false);
  assert.equal(sameRevealState(null, a), false);
});
