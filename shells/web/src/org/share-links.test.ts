// SPDX-License-Identifier: MPL-2.0
/**
 * The Rendered link row while another design system is active.
 *
 * A server render reads the instance's own tokens, so a link made while Lolly Demo is active
 * would come out in the instance's colours. The row says so and offers no link. The row
 * for the catalog's own system, and every row on a one-system instance, stays as it was.
 *
 * Run directly:  node --test shells/web/src/org/share-links.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/#/tool/qr-code', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;

const { buildInstanceShareSection, renderedLinkHeldText } = await import('./share-links.ts');

const ctx = { toolId: 'qr-code', baseParts: ['url=https%3A%2F%2Fx.test', 'format=svg'], copy: async () => {} };
const config = { instance: { name: 'Proof' }, can: { 'link.create': true, 'export.server': true } } as never;

const settled = () => new Promise(resolve => setTimeout(resolve, 0));
const noHold = async () => null;
const hold = async () => ({ own: 'SUSE' });

test('with the catalog system active the row offers a link, exactly as before', async () => {
  const section = buildInstanceShareSection(ctx, config, noHold)!;
  await settled();
  assert.ok(section.querySelector('[data-act="mint-rendered"]'));
  assert.ok(section.querySelector('[data-rendered-open]'));
  assert.equal(section.querySelector('.share-instance-held'), null);
});

test('the section is built at once, so it mounts when it always did', () => {
  const section = buildInstanceShareSection(ctx, config, () => new Promise(() => {}))!;
  assert.ok(section.querySelector('[data-act="mint-rendered"]'), 'an unanswered read leaves the row as it is');
});

test('with another system active the row says what the instance draws in and offers nothing', async () => {
  const section = buildInstanceShareSection(ctx, config, hold)!;
  await settled();
  assert.equal(section.querySelector('[data-act="mint-rendered"]'), null, 'no way to mint');
  assert.equal(section.querySelector('[data-rendered-open]'), null);
  const held = section.querySelector('.share-instance-held')!;
  assert.match(held.textContent ?? '', /This instance draws rendered links in SUSE\. Switch to SUSE to make one\./);
  assert.equal(held.querySelector('a')?.getAttribute('href'), '#/settings?focus=design-systems-section');
});

test('a switch after the row was drawn is caught at the click, and nothing is minted', async () => {
  const realFetch = globalThis.fetch;
  let posted = 0;
  globalThis.fetch = (async () => { posted += 1; return new Response('{}'); }) as typeof fetch;
  try {
    let answer: { own: string } | null = null;
    const section = buildInstanceShareSection(ctx, config, async () => answer)!;
    await settled();
    const button = section.querySelector<HTMLButtonElement>('[data-act="mint-rendered"]')!;
    answer = { own: 'SUSE' };
    button.click();
    await settled();
    assert.equal(posted, 0, 'no request reached the server');
    assert.ok(section.querySelector('.share-instance-held'));
  } finally { globalThis.fetch = realFetch; }
});

test('the words still read when the name is not known', () => {
  assert.match(renderedLinkHeldText(''), /its own design system/);
  assert.doesNotMatch(renderedLinkHeldText(''), /\{name\}/);
});

test('a caller who may not create links sees no row either way', () => {
  assert.equal(buildInstanceShareSection(ctx, { can: {} } as never, hold), null);
});
