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

const { mountSharePanel, openShareDialog } = await import('./share-dialog.ts');
const { createShareSection } = await import('./share-section.ts');
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

test('the primary link remains visible while options use the sidebar disclosure', () => {
  _clearShareSectionsForTests();
  const c = mount();
  const options = c.querySelector<HTMLDetailsElement>('[data-link-options]')!;
  assert.equal(options.open, false);
  assert.ok(options.matches('details.input-section'));
  assert.ok(options.querySelector('.input-section-summary .input-section-title .input-section-icon svg'));
  assert.ok(options.querySelector('.input-section-body [data-link-behaviour] legend'));
  assert.ok(options.querySelector('.share-credit-btn'));
  assert.equal(c.querySelector('.share-copy-btn')?.closest('details'), null);
  assert.equal(c.querySelectorAll('details').length, 1, 'link behavior and encoding share one disclosure');
});

test('link flags still update and fullscreen disables the export-panel flag', () => {
  _clearShareSectionsForTests();
  const c = mount();
  const full = c.querySelector<HTMLInputElement>('[data-flag="full"]')!;
  const options = c.querySelector<HTMLInputElement>('[data-flag="options"]')!;
  options.checked = true;
  options.dispatchEvent(new dom.window.Event('change'));
  assert.match(c.querySelector<HTMLInputElement>('.share-link-field')!.value, /[?&]options(?:&|$)/);
  full.checked = true;
  full.dispatchEvent(new dom.window.Event('change'));
  assert.equal(options.disabled, true);
  assert.equal(options.checked, false);
  const link = c.querySelector<HTMLInputElement>('.share-link-field')!.value;
  assert.match(link, /[?&]full(?:&|$)/);
  assert.doesNotMatch(link, /[?&]options(?:&|$)/);
});

test('registered headings become disclosures without losing control listeners', () => {
  _clearShareSectionsForTests();
  let presses = 0;
  registerShareSection(() => {
    const node = section('editable');
    node.className = 'custom-share';
    const heading = document.createElement('h3'); heading.textContent = 'Invite people';
    const action = document.createElement('button'); action.addEventListener('click', () => { presses++; });
    node.append(heading, action);
    return node;
  });
  const c = mount();
  const group = c.querySelector<HTMLDetailsElement>('.share-registered-section')!;
  assert.equal(group.open, false);
  assert.match(group.querySelector('summary')!.textContent!, /Invite people/);
  assert.equal(group.querySelector('h3'), null);
  group.querySelector<HTMLButtonElement>('button')!.click();
  assert.equal(presses, 1);
});

test('section choices survive docked rebuilds and stay separate between panels', async () => {
  _clearShareSectionsForTests();
  registerShareSection(async () => createShareSection('Invite an agent', 'aiSpark', { className: 'example-agent' }).section);
  const container = document.createElement('div'); document.body.replaceChildren(container);
  let dispose = mountSharePanel(container, OPTS);
  await new Promise((resolve) => setTimeout(resolve, 0));
  container.querySelector<HTMLDetailsElement>('[data-link-options]')!.open = true;
  container.querySelector<HTMLDetailsElement>('.example-agent')!.open = true;
  dispose();
  dispose = mountSharePanel(container, { ...OPTS, baseParts: ['url=changed'] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(container.querySelector<HTMLDetailsElement>('[data-link-options]')!.open, true);
  assert.equal(container.querySelector<HTMLDetailsElement>('.example-agent')!.open, true, 'async sections restore their own state');
  const other = document.createElement('div'); document.body.append(other);
  const disposeOther = mountSharePanel(other, OPTS);
  assert.equal(other.querySelector<HTMLDetailsElement>('[data-link-options]')!.open, false);
  dispose(); disposeOther();
});

test('the modal and docked panel use identical disclosure anatomy', () => {
  _clearShareSectionsForTests();
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const c = mount();
  const dlg = openShareDialog(OPTS);
  const anatomy = (surface: HTMLElement): string => surface.querySelector('[data-link-options]')!.outerHTML.replace(/helptip-\d+/g, 'helptip-id');
  assert.equal(anatomy(dlg), anatomy(c));
  dlg.querySelector<HTMLButtonElement>('.share-done')!.click();
  assert.equal(dlg.isConnected, false);
});

test('Share info buttons describe controls without changing the choice, and Escape only closes the tip', () => {
  _clearShareSectionsForTests();
  const c = mount();
  const row = c.querySelector<HTMLElement>('[data-encrypt-row]')!;
  const choice = row.querySelector<HTMLInputElement>('input')!;
  const button = row.querySelector<HTMLButtonElement>('.help-tip-btn')!;
  const pop = row.querySelector<HTMLElement>('.help-tip-pop')!;
  assert.equal(button.closest('label'), null);
  assert.equal(choice.getAttribute('aria-describedby'), pop.id);
  assert.equal(pop.hidden, true);
  button.click();
  assert.equal(choice.checked, false);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(pop.hidden, false);
  const escapeEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  button.dispatchEvent(escapeEvent);
  assert.equal(escapeEvent.defaultPrevented, true, 'native dialog dismissal must not consume this Escape');
  assert.equal(pop.hidden, true);
  assert.equal(document.activeElement, button);
  assert.ok(c.isConnected);
});

test('disposing or rebuilding a docked Share surface releases its help listeners', () => {
  _clearShareSectionsForTests();
  const c = document.createElement('div'); document.body.replaceChildren(c);
  const dispose = mountSharePanel(c, OPTS);
  const previous = c.firstElementChild as HTMLElement;
  const previousButton = previous.querySelector<HTMLButtonElement>('[data-encrypt-row] .help-tip-btn')!;
  const previousPop = previous.querySelector<HTMLElement>('[data-encrypt-row] .help-tip-pop')!;
  previousButton.click(); assert.equal(previousPop.hidden, false);
  previousButton.click(); assert.equal(previousPop.hidden, true);
  const disposeNext = mountSharePanel(c, OPTS);
  previousButton.click(); assert.equal(previousPop.hidden, true, 'the replaced surface no longer handles help clicks');
  dispose();
  const next = c.firstElementChild as HTMLElement;
  const nextButton = next.querySelector<HTMLButtonElement>('[data-encrypt-row] .help-tip-btn')!;
  const nextPop = next.querySelector<HTMLElement>('[data-encrypt-row] .help-tip-pop')!;
  nextButton.click(); assert.equal(nextPop.hidden, false, 'disposing the old surface leaves the new one active');
  nextButton.click(); assert.equal(nextPop.hidden, true);
  disposeNext();
  nextButton.click(); assert.equal(nextPop.hidden, true, 'the disposed surface no longer handles help clicks');
});

test('a recommended editable file opens, and delivery reveals its contents receipt', async () => {
  _clearShareSectionsForTests();
  const saves: string[] = [];
  const container = document.createElement('div'); document.body.replaceChildren(container);
  mountSharePanel(container, {
    ...OPTS,
    fidelity: { faithful: false, excludedAssets: [{ id: 'user/image', label: 'Uploaded image' }], droppedScalars: [], droppedBlocks: [] },
    lolly: {
      build: async () => ({ blob: new Blob(['saved design']), filename: 'design.lolly', summary: {
        assetCount: 1, byReferenceCount: 0, totalBytes: 12, hasLicensed: false, licensedExcluded: 0, credits: false, toolFiles: 0,
      } }),
      save: async (_blob, filename) => { saves.push(filename); },
    },
  });
  const file = container.querySelector<HTMLDetailsElement>('[data-share-file]')!;
  assert.equal(file.open, true);
  assert.ok(file.classList.contains('is-recommended'));
  file.open = false;
  file.querySelector<HTMLButtonElement>('[data-lolly-download]')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(file.open, true, 'programmatic delivery opens its receipt and any inclusion choice');
  assert.deepEqual(saves, ['design.lolly']);
  assert.match(file.querySelector('[data-lolly-summary]')!.textContent!, /1 embedded file/);
});

test('clipboard failure rejects for sections and reports failure on the copy buttons', async () => {
  _clearShareSectionsForTests();
  let copy: ((text: string) => Promise<void>) | undefined;
  registerShareSection(ctx => { copy = ctx.copy; return null; });
  const c = mount();
  const field = c.querySelector<HTMLInputElement>('.share-link-field')!;
  field.focus();
  const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const previousExec = document.execCommand;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('unavailable'); } } });
  document.execCommand = () => false;
  try {
    assert.ok(copy);
    await assert.rejects(copy('agent instructions'), /Could not copy to the clipboard/);
    assert.equal(document.querySelector('textarea'), null);
    assert.equal(document.activeElement, field);
    const primary = c.querySelector<HTMLButtonElement>('.share-copy-btn')!;
    const credit = c.querySelector<HTMLButtonElement>('.share-credit-btn')!;
    primary.click(); credit.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(primary.textContent, 'Could not copy');
    assert.equal(credit.textContent, 'Could not copy');
    assert.equal(document.querySelector('textarea'), null);
  } finally {
    document.execCommand = previousExec;
    if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});
