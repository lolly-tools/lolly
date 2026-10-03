// SPDX-License-Identifier: MPL-2.0
/**
 * share-dialog.ts mountRegisteredSections: where registered sections (lib/share-sections.ts)
 * land in a real Share surface.
 *
 *  - no registrant: no lead host, no own-link heading, an empty extra host, so the
 *    dialog is the same as before the registry had a placement option;
 *  - an 'after' registrant: in [data-extra-sections], told nothing about placement;
 *  - a 'lead' registrant: in `.share-lead-sections`, right before the dialog's own link
 *    row, with a heading over that row, and told `placement: 'lead'`;
 *  - a node returned directly mounts in the same task as the surface (the docked panel
 *    rebuilds the surface on every edit, so a frame-late section moves the content);
 *    an async one mounts when it resolves, and only while the dialog is open.
 *
 * Run directly:  node --test shells/web/src/components/share-dialog-sections.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.test/#/t/qr-code', pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.location = dom.window.location;
g.navigator ??= dom.window.navigator;
for (const k of ['Element', 'HTMLElement', 'HTMLInputElement', 'HTMLDialogElement', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle'] as const) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
g.localStorage = dom.window.localStorage;
g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const { mountSharePanel } = await import('./share-dialog.ts');
const { registerShareSection, _clearShareSectionsForTests } = await import('../lib/share-sections.ts');

const OPTS = { toolId: 'qr-code', baseParts: ['url=https%3A%2F%2Fexample.com'], manifest: { render: { formats: ['svg'] } } };

function section(name: string): HTMLElement {
  const s = document.createElement('section');
  s.dataset.name = name;
  return s;
}

function mount(): HTMLElement {
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  mountSharePanel(container, OPTS);
  return container;
}

const body = (c: HTMLElement): HTMLElement => c.querySelector<HTMLElement>('.share-dialog-body')!;

test('no registrant: no lead host, no own-link heading, nothing in the extra host', () => {
  _clearShareSectionsForTests();
  const c = mount();
  assert.equal(c.querySelector('.share-lead-sections'), null);
  assert.equal(c.querySelector('.share-own-heading'), null);
  assert.equal(c.querySelector('[data-extra-sections]')!.children.length, 0);
  assert.equal(body(c).children[1]!.className, 'share-link-row', 'the own link row stays straight under the heading');
});

test("an 'after' registrant mounts in the extra host, in the same task", () => {
  _clearShareSectionsForTests();
  const seen: unknown[] = [];
  registerShareSection((ctx) => { seen.push(ctx.placement); return section('after'); });
  const c = mount();
  assert.equal(c.querySelector('[data-extra-sections]')!.firstElementChild?.getAttribute('data-name'), 'after');
  assert.equal(c.querySelector('.share-lead-sections'), null);
  assert.equal(c.querySelector('.share-own-heading'), null);
  assert.deepEqual(seen, [undefined]);
});

test("a 'lead' registrant mounts before the own link row, labelled, in the same task", () => {
  _clearShareSectionsForTests();
  const seen: unknown[] = [];
  registerShareSection((ctx) => { seen.push(ctx.placement); return section('lead'); }, { placement: 'lead' });
  registerShareSection(() => section('after'));
  const c = mount();
  const lead = c.querySelector<HTMLElement>('.share-lead-sections');
  assert.ok(lead, 'the lead host is there without waiting a tick');
  assert.equal(lead.firstElementChild?.getAttribute('data-name'), 'lead');
  const heading = lead.nextElementSibling as HTMLElement;
  assert.equal(heading.className, 'share-own-heading');
  assert.equal(heading.textContent, 'Link to this version');
  assert.equal(heading.nextElementSibling?.className, 'share-link-row');
  assert.equal(lead.previousElementSibling?.tagName, 'H2');
  assert.equal(c.querySelector('[data-extra-sections]')!.firstElementChild?.getAttribute('data-name'), 'after');
  assert.deepEqual(seen, ['lead']);
});

test('a section returned directly mounts while the surface is still off the page; a late one does not', async () => {
  _clearShareSectionsForTests();
  registerShareSection(() => section('now'), { placement: 'lead' });
  registerShareSection(async () => section('late'));
  // The docked Share panel builds its body before that body is on the page.
  const detached = document.createElement('div');
  document.body.replaceChildren();
  mountSharePanel(detached, OPTS);
  assert.equal(detached.querySelector('.share-lead-sections')?.firstElementChild?.getAttribute('data-name'), 'now');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(detached.querySelector('[data-name="late"]'), null, 'a closed or detached dialog takes no late section');
});

test("a 'lead' registrant that returns nothing leaves the dialog as it was", () => {
  _clearShareSectionsForTests();
  registerShareSection(() => null, { placement: 'lead' });
  const c = mount();
  assert.equal(c.querySelector('.share-lead-sections'), null);
  assert.equal(c.querySelector('.share-own-heading'), null);
});

test('an async lead section mounts when it resolves; a throwing builder is skipped', async () => {
  _clearShareSectionsForTests();
  registerShareSection(() => { throw new Error('boom'); }, { placement: 'lead' });
  registerShareSection(async () => section('late'), { placement: 'lead' });
  const c = mount();
  assert.equal(c.querySelector('.share-lead-sections'), null);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(c.querySelector('.share-lead-sections')?.firstElementChild?.getAttribute('data-name'), 'late');
  _clearShareSectionsForTests();
});
