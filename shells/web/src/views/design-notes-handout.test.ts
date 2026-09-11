// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import {
  mountDesignNotesHandout,
  paginateDesignNotes,
  snapshotDesignHandoutSlide,
} from './design-notes-handout.ts';

const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
Object.defineProperty(globalThis, 'getComputedStyle', {
  value: dom.window.getComputedStyle.bind(dom.window),
  configurable: true,
});

function slide(index: number, notes: string) {
  const page = dom.window.document.createElement('section');
  page.setAttribute('data-pdf-page', '');
  page.setAttribute('data-frame-id', `frame-${index}`);
  page.setAttribute('data-frame-name', `Named slide ${index}`);
  page.setAttribute('data-frame-notes', notes);
  page.style.width = '1600px';
  page.style.height = '900px';
  page.innerHTML = `<div class="seq-off"><svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs><rect id="r" width="10" height="10" fill="url(#g)"/></svg></div>`;
  dom.window.document.body.appendChild(page);
  return page;
}

test('snapshot captures dimensions and literal frame metadata without moving the source', () => {
  dom.window.document.body.innerHTML = '';
  const source = slide(1, 'Say <b>this</b> & pause.\nThen continue.');
  const snapshot = snapshotDesignHandoutSlide(source, 0);
  assert.equal(snapshot.width, 1600);
  assert.equal(snapshot.height, 900);
  assert.equal(snapshot.name, 'Named slide 1');
  assert.equal(snapshot.notes, 'Say <b>this</b> & pause.\nThen continue.');
  assert.notEqual(snapshot.source, source);
  assert.equal(source.isConnected, true);
});

test('handout emits true A4 pages, a scaled preview and plain-text notes', () => {
  dom.window.document.body.innerHTML = '';
  const source = slide(1, 'Say <b>this</b> & pause.\nThen continue.');
  const mounted = mountDesignNotesHandout([snapshotDesignHandoutSlide(source, 0)], {
    title: 'Quarterly review',
    document: dom.window.document,
  });
  assert.equal(mounted.pages.length, 1);
  const page = mounted.pages[0]!;
  assert.equal(page.style.width, '794px');
  assert.equal(page.style.height, '1123px');
  assert.equal(page.getAttribute('data-pdf-page'), '');
  assert.equal(
    page.querySelectorAll('[data-pdf-page]').length,
    0,
    'the preview is not a nested PDF page'
  );
  const previewSlide = page.querySelector<HTMLElement>('[data-handout-preview] > section')!;
  assert.match(previewSlide.style.transform, /^scale\(/);
  assert.equal(previewSlide.querySelector('.seq-off'), null);
  const note = page.querySelector<HTMLElement>('[data-handout-notes]')!;
  assert.equal(note.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(note.style.filter, 'brightness(1)', 'PDF raster fallback is scoped to notes');
  assert.equal(note.textContent, 'Say <b>this</b> & pause.\nThen continue.');
  assert.equal(note.querySelector('b'), null, 'markup-like notes stay literal text');
  assert.match(page.textContent!, /Quarterly review/);
  assert.match(page.textContent!, /Slide 1 of 1/);
  mounted.dispose();
  assert.equal(mounted.root.isConnected, false);
});

test('a note-less slide is still represented explicitly', () => {
  dom.window.document.body.innerHTML = '';
  const source = slide(2, '');
  const mounted = mountDesignNotesHandout([snapshotDesignHandoutSlide(source, 0)], {
    title: 'Deck',
    document: dom.window.document,
  });
  assert.equal(
    mounted.pages[0]!.querySelector('[data-handout-notes]')?.textContent,
    'No speaker notes.'
  );
  mounted.dispose();
});

test('a photographed preview is preferred over transform-scaling a live clone', () => {
  dom.window.document.body.innerHTML = '';
  const source = slide(4, 'Photographed.');
  const snapshot = snapshotDesignHandoutSlide(source, 0);
  snapshot.previewSrc = 'data:image/jpeg;base64,AA==';
  const mounted = mountDesignNotesHandout([snapshot], {
    title: 'Deck',
    document: dom.window.document,
  });
  const preview = mounted.pages[0]!.querySelector('[data-handout-preview]')!;
  assert.equal(preview.querySelectorAll('[data-handout-preview-image]').length, 1);
  assert.equal(preview.querySelector('section'), null);
  assert.equal(
    mounted.pages[0]!.querySelector('[data-handout-footer]')?.textContent,
    'Page 1 of 1'
  );
  mounted.dispose();
});

test('long notes continue onto extra pages without duplicating the slide preview', () => {
  dom.window.document.body.innerHTML = '';
  const notes = Array.from({ length: 900 }, (_, i) => `word-${i}`).join(' ');
  const chunks = paginateDesignNotes(notes);
  assert.ok(chunks.length >= 3);
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), notes);
  const source = slide(3, notes);
  const mounted = mountDesignNotesHandout([snapshotDesignHandoutSlide(source, 0)], {
    title: 'Long deck',
    document: dom.window.document,
  });
  assert.equal(mounted.pages.length, chunks.length);
  assert.equal(mounted.root.querySelectorAll('[data-handout-preview]').length, 1);
  assert.match(mounted.pages[1]!.textContent!, /2\//);
  const runs = mounted.pages[1]!.querySelectorAll<HTMLElement>('[data-handout-note-run]');
  assert.ok(runs.length > 1);
  assert.ok([...runs].every((run) => (run.textContent?.length ?? 0) <= 60));
  assert.equal([...runs].map((run) => run.textContent).join(''), chunks[1]);
  mounted.dispose();
});
