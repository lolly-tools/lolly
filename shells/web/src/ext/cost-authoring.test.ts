// SPDX-License-Identifier: MPL-2.0
/**
 * ext/cost-authoring.ts - the rate-card AUTHORING furniture, extracted behind
 * slot:cost-authoring.
 *
 * Proves the extraction's four required properties:
 *   - AUTHORING ABSENT when the slot is empty: mounting `cost-authoring` with
 *     nothing registered leaves the container untouched (counts-only, dormant);
 *   - REGISTERING RESTORES AUTHORING: enableLocalCostAuthoring() hydrates a single
 *     "manage rate cards" trigger, and its disposer removes it (reversibility);
 *   - CORE CONSUMPTION DOES NOT DEPEND ON THE MANAGER: the cost panel and its
 *     wiring never import rate-cards-manager, so a supplied card still prices with
 *     the authoring UI absent (a static import-graph guard, the extraction invariant).
 *
 * Run with the CSS stub loader (the manager imports CSS):
 *   node --import ./tests/css-stub.mjs --test shells/web/src/ext/cost-authoring.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const { mountSlot, _clearExtensionsForTests } = await import('../lib/extensions.ts');
const { costAuthoringExtension, enableLocalCostAuthoring } = await import('./cost-authoring.ts');

const SLOT = 'cost-authoring' as const;
const here = dirname(fileURLToPath(import.meta.url));

/** A fresh slot container, the element core's mount site owns. */
function slotEl(): HTMLElement {
  const el = document.createElement('div');
  el.dataset.costAuthoring = '';
  return el;
}

/** A stand-in context; the extension only forwards it into openRateCardsPanel on click. */
const ctx = { host: {} as never, onChange() {} };

test('the extension declares the cost-authoring slot and the v1 contract', () => {
  assert.equal(costAuthoringExtension.slot, SLOT);
  assert.equal(costAuthoringExtension.id, 'lolly:cost-authoring');
  assert.equal(costAuthoringExtension.contract, '^1.0.0');
});

test('authoring ABSENT when the slot is empty: container untouched, no-op disposer', async () => {
  _clearExtensionsForTests();
  const el = slotEl();
  const dispose = await mountSlot(SLOT, el, ctx);
  assert.equal(el.children.length, 0, 'nothing rendered into the slot');
  assert.equal(typeof dispose, 'function');
  assert.doesNotThrow(() => dispose());
});

test('registering RESTORES authoring: a trigger appears; the disposer removes it', async () => {
  _clearExtensionsForTests();
  const unregister = enableLocalCostAuthoring();
  const el = slotEl();
  const dispose = await mountSlot(SLOT, el, ctx);

  const btn = el.querySelector<HTMLButtonElement>('button.cost-authoring-open');
  assert.ok(btn, 'the manage-rate-cards trigger hydrated into the slot');
  assert.equal(btn!.type, 'button');
  assert.ok(btn!.textContent && btn!.textContent.trim().length > 0, 'the trigger carries a label');

  dispose();
  assert.equal(el.querySelector('button.cost-authoring-open'), null, 'the disposer removed the trigger');
  unregister();
});

test('CORE consumption does not import the authoring manager (a supplied card still prices)', () => {
  // The extraction invariant, enforced statically: the cost panel and its wiring
  // reach storage only through lib/rate-cards.ts, never through the manager. So with
  // the authoring slot empty, listRateCards + computeCost + canShowMoney still price
  // a card supplied by any channel (a stored user card, --rate-card, a catalog card).
  const read = (rel: string) => readFileSync(join(here, rel), 'utf8');
  for (const f of ['../views/cost-panel.ts', '../views/tool-actions.ts', '../lib/rate-cards.ts']) {
    assert.ok(!read(f).includes('rate-cards-manager'), `${f} must not import the authoring manager`);
  }
});
