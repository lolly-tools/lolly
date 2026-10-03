// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishToolReady, registerToolReady, type ReadyTool } from './tool-ready.ts';

test('late registration sees the live tool; navigation ends its behavior', () => {
  const a = { toolId: 'design', view: {} as HTMLElement, collaborative: false };
  const b = { ...a, toolId: 'deck' };
  const seen: ReadyTool[] = [];
  let isCurrent: (() => boolean) | undefined;
  let stops = 0;
  const leaveA = publishToolReady(a);
  const stop = registerToolReady((tool, current) => { seen.push(tool); isCurrent = current; return () => { stops++; }; });
  assert.equal(isCurrent?.(), true);
  const aCurrent = isCurrent!;
  const leaveB = publishToolReady(b);
  assert.equal(aCurrent(), false);
  assert.equal(stops, 1);
  leaveA();
  assert.equal(isCurrent?.(), true, 'an old teardown cannot clear the new mount');
  leaveB();
  assert.equal(isCurrent?.(), false);
  assert.equal(stops, 2);
  assert.deepEqual(seen, [a, b]);
  stop();
});

test('replacing a consumer tears down only the previous behavior', () => {
  const leave = publishToolReady({ toolId: 'design', view: {} as HTMLElement, collaborative: false });
  let first = 0;
  let second = 0;
  const stopA = registerToolReady(() => () => { first++; });
  const stopB = registerToolReady(() => () => { second++; });
  assert.equal(first, 1);
  stopA();
  assert.equal(second, 0);
  stopB();
  assert.equal(second, 1);
  leave();
});
