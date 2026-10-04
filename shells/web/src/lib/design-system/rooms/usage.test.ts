// SPDX-License-Identifier: MPL-2.0
/**
 * The Usage room's rule cards: a Design house rule (plan 291 W3) is checked by Design's
 * export checks and by `lolly check`, so its card says so, while a kind no checker knows
 * keeps the "Unchecked" badge.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/rooms/usage.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="room"></div></body></html>', { url: 'http://localhost/#/start' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

const { mountUsageRoom } = await import('./usage.ts');
type UsageHost = Parameters<typeof mountUsageRoom>[1]['host'];

const rule = (id: string, kind: string, roleIds: string[] = []) => ({
  id, label: `${id} label`, kind, roleIds, parameters: {}, scope: { tools: ['design'] },
  requirement: 'required', origin: { kind: 'manual', author: 'test' }, review: { state: 'draft' },
});

const DOC = {
  color: { ink: { $type: 'color', $value: '#112233' } },
  $extensions: {
    'com.suse.lolly': {
      brandSystem: {
        schemaVersion: 1, id: 'test', label: 'Test', roles: [], bindings: [],
        rules: [rule('headline-weight', 'text-weight'), rule('logo-surface', 'logo-surface'), rule('future', 'clear-space')],
      },
    },
  },
};

const host = {
  tokens: {
    raw: async () => DOC,
    snapshot: async () => ({ document: DOC }),
    active: async () => ({ label: 'Test brand' }),
  },
} as unknown as UsageHost;

test('a house rule reads as checked in Design, an unknown kind as unchecked', async () => {
  const el = document.getElementById('room')!;
  mountUsageRoom(el, { host, readonly: true });
  for (let i = 0; i < 20 && !el.querySelector('.usage-rule'); i++) await new Promise((r) => setTimeout(r, 5));
  const cards = [...el.querySelectorAll<HTMLElement>('.usage-rule')];
  assert.equal(cards.length, 3, el.textContent ?? '');
  const card = (label: string) => cards.find((c) => c.querySelector('h3')?.textContent === label)!;

  const weight = card('headline-weight label');
  assert.ok(weight.querySelector('[data-checker="design"]'), 'the house rule carries the Design checker badge');
  assert.doesNotMatch(weight.textContent ?? '', /Unchecked|no checker/);
  assert.match(weight.textContent ?? '', /lolly check/);
  assert.match(weight.textContent ?? '', /Draft/);
  // A house rule with no role shows its kind in words, not the raw kind id.
  assert.match(card('logo-surface label').querySelector('.usage-rule-copy p')?.textContent ?? '', /Logo per surface/);

  const future = card('future label');
  assert.equal(future.querySelector('[data-checker]'), null);
  assert.match(future.textContent ?? '', /Unchecked/);
  assert.match(future.textContent ?? '', /no checker/);
});
