// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-leave-dialog.ts: the Unsaved edits dialog, built in a DOM. Pins the
 * wording Andy chose on 15 October 2026, the order of the three actions with what
 * each one runs and that a team document's own question changes only the title.
 * Then the kangaroo (components/kangaroo-art.ts): decoration hidden from
 * assistive technology, with ids of its own in every drawing and a motion that
 * starts once and never under reduced motion.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-leave-dialog.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/t/qr-code' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
globalThis.Element = dom.window.Element as unknown as typeof globalThis.Element;

const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { showUnsavedDialog } = await import('./tool-leave-dialog.ts');
const { kangarooArt } = await import('../components/kangaroo-art.ts');
const scope = await import('../lib/document-scope.ts');

/** The open dialog, or null once it has closed. */
const openDialog = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>('dialog.unsaved-dialog');

/** What a person reads, top to bottom: the title, the sentence and each action with its label. */
function readDialog(dlg: HTMLDialogElement): { title: string; body: string; actions: string[][] } {
  return {
    title: dlg.querySelector('h2')?.textContent?.trim() ?? '',
    body: dlg.querySelector('p')?.textContent?.trim() ?? '',
    actions: [...dlg.querySelectorAll<HTMLElement>('[data-act]')].map(el => [el.dataset.act ?? '', el.textContent?.trim() ?? '']),
  };
}

const press = (dlg: HTMLDialogElement, act: string): void => {
  dlg.querySelector<HTMLElement>(`[data-act="${act}"]`)!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
};

test('the ordinary dialog reads Unsaved edits, then Save & leave, Leave anyway and Cancel in that order', () => {
  let saved = 0;
  let left = 0;
  showUnsavedDialog(async () => { saved++; }, () => { left++; });
  const dlg = openDialog();
  assert.ok(dlg?.open, 'the dialog is open');
  assert.deepEqual(readDialog(dlg), {
    title: 'Unsaved edits',
    body: 'Save now or abandon your changes.',
    actions: [['save', 'Save & leave'], ['leave', 'Leave anyway'], ['cancel', 'Cancel']],
  });
  assert.equal(dlg.querySelectorAll('button').length, 3, 'three native buttons without the jelly flag');
  press(dlg, 'cancel');
  assert.equal(openDialog(), null, 'Cancel closes the dialog');
  assert.deepEqual({ saved, left }, { saved: 0, left: 0 }, 'and neither saves nor leaves');
});

test('Leave anyway runs the leave callback and Save & leave runs the save', async () => {
  let saved = 0;
  let left = 0;
  showUnsavedDialog(async () => { saved++; }, () => { left++; });
  press(openDialog()!, 'leave');
  assert.equal(openDialog(), null);
  assert.deepEqual({ saved, left }, { saved: 0, left: 1 });

  showUnsavedDialog(async () => { saved++; }, () => { left++; });
  press(openDialog()!, 'save');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(openDialog(), null);
  assert.deepEqual({ saved, left }, { saved: 1, left: 1 });
});

test('a tool with nothing to save offers Leave anyway and Cancel only', () => {
  showUnsavedDialog(null, () => {});
  const dlg = openDialog()!;
  assert.deepEqual(readDialog(dlg).actions, [['leave', 'Leave anyway'], ['cancel', 'Cancel']]);
  press(dlg, 'cancel');
});

test('a team document asks its own question in the title, with the same sentence and buttons', () => {
  scope._resetDocumentScopeForTests();
  const off = scope.registerDocumentScope({
    chip: () => ({ label: 'Brand refresh · Can edit', role: 'edit' }),
    leavePrompt: () => 'Save changes to <b>Brand refresh</b>?',
  });
  const stop = scope.mountDocumentScope({
    toolId: 'qr-code', view: document.createElement('div'),
    document: () => ({ inputs: {} }), unsaved: () => true, saveOnDevice: async () => true,
  });
  try {
    showUnsavedDialog(async () => {}, () => {});
    const dlg = openDialog()!;
    assert.deepEqual(readDialog(dlg), {
      title: 'Save changes to <b>Brand refresh</b>?',
      body: 'Save now or abandon your changes.',
      actions: [['save', 'Save & leave'], ['leave', 'Leave anyway'], ['cancel', 'Cancel']],
    });
    assert.equal(dlg.querySelector('h2 b'), null, 'the question is text, never markup');
    press(dlg, 'cancel');
  } finally {
    stop();
    off();
    scope._resetDocumentScopeForTests();
  }
});

// ── The kangaroo ─────────────────────────────────────────────────────────────────

test('the kangaroo is decoration, hidden with nothing to read; the title gives the dialog its accessible name and the sentence its description', () => {
  showUnsavedDialog(async () => {}, () => {});
  const dlg = openDialog()!;
  const art = dlg.querySelector('.unsaved-dialog-art')!;
  assert.equal(art.getAttribute('aria-hidden'), 'true', 'the drawing is hidden from assistive technology');
  const svg = art.querySelector('svg')!;
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(svg.getAttribute('focusable'), 'false');
  assert.equal(svg.querySelectorAll('title, desc, [role], [aria-label], [tabindex]').length, 0, 'nothing in the drawing to read or focus');
  const text = (attr: string): string => (dlg.getAttribute(attr) ?? '').split(' ')
    .map(id => document.getElementById(id)?.textContent?.trim()).join(' ');
  assert.equal(text('aria-labelledby'), 'Unsaved edits', 'the title is the accessible name');
  assert.equal(text('aria-describedby'), 'Save now or abandon your changes.', 'the sentence is the description');
  assert.equal(dlg.querySelector('.unsaved-dialog-lead')?.firstElementChild, art, 'the drawing leads, before the text');
  press(dlg, 'cancel');
});

test('the joey moves once as the dialog opens, and never when the system or Lolly reduces motion', () => {
  const started: string[] = [];
  const svgProto = dom.window.SVGElement.prototype as unknown as { beginElement?: (this: Element) => void };
  svgProto.beginElement = function beginElement(this: Element): void { started.push(this.id); };
  let systemReduces = false;
  globalThis.matchMedia = ((query: string) => ({ matches: systemReduces && query.includes('prefers-reduced-motion: reduce') })) as unknown as typeof globalThis.matchMedia;
  const open = (): HTMLDialogElement => { showUnsavedDialog(async () => {}, () => {}); return openDialog()!; };
  try {
    systemReduces = true;
    press(open(), 'cancel');
    assert.deepEqual(started, [], 'the system asks for reduced motion: the still, and no beginElement()');

    systemReduces = false;
    document.documentElement.dataset.a11yMotion = 'reduce';
    press(open(), 'cancel');
    assert.deepEqual(started, [], 'Reduce motion in Lolly: the still, and no beginElement()');
    delete document.documentElement.dataset.a11yMotion;

    const dlg = open();
    const trigger = dlg.querySelector('[data-kg-go]')!;
    assert.deepEqual(started, [trigger.id], 'motion allowed: one beginElement(), on this dialog\'s own trigger');
    press(dlg, 'cancel');
  } finally {
    delete svgProto.beginElement;
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
    delete document.documentElement.dataset.a11yMotion;
  }
});

test('every drawing has ids of its own, refers only to them and never puts a hyphen in a begin value', () => {
  const host = document.createElement('div');
  host.innerHTML = kangarooArt() + kangarooArt();
  const [first, second] = [...host.querySelectorAll('svg')];
  const ids = (svg: Element): string[] => [...svg.querySelectorAll('[id]')].map(el => el.id);
  assert.equal(ids(first!).length, 2, 'the pouch clip and the motion trigger');
  assert.deepEqual(ids(first!).filter(id => ids(second!).includes(id)), [], 'two drawings share no id');
  for (const svg of [first!, second!]) {
    const own = new Set(ids(svg));
    const clips = [...svg.querySelectorAll('[clip-path]')].map(el => /^url\(#([^)]+)\)$/.exec(el.getAttribute('clip-path') ?? '')?.[1]);
    assert.deepEqual(clips.filter(id => !own.has(id ?? '')), [], 'the clip is this drawing\'s own');
    const begins = [...svg.querySelectorAll('[begin]')].map(el => el.getAttribute('begin')!).filter(begin => begin !== 'indefinite');
    assert.equal(begins.length, 4, 'four motions follow the trigger');
    for (const begin of begins) {
      // Chrome reads a hyphen here as a negative offset, and the motion never starts.
      assert.match(begin, /^\w+\.begin$/, begin);
      assert.ok(own.has(begin.slice(0, -'.begin'.length)), `${begin} follows this drawing's trigger`);
    }
  }
});

test('the still is the end pose: every motion settles where the drawing already stands', () => {
  const host = document.createElement('div');
  host.innerHTML = kangarooArt();
  const motions = [...host.querySelectorAll('animate, animateTransform')];
  assert.equal(motions.length, 5);
  for (const motion of motions) {
    const last = motion.getAttribute('values')!.split(';').at(-1)!;
    const target = motion.parentElement!;
    const still = motion.tagName === 'animate'
      ? target.getAttribute('d')
      : /^\w+\(([^)]*)\)$/.exec(target.getAttribute('transform') ?? '')?.[1];
    assert.equal(still, last, `${motion.getAttribute('attributeName')} ${motion.getAttribute('type') ?? ''}`.trim());
    assert.equal(motion.getAttribute('fill'), 'freeze', 'and stays there');
  }
});
