// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { FileMetadata, VerifyFinding } from '@lolly/engine';
import { applyDepth, evidenceHeadHtml, findingsJson, recordedTimes } from './valid-evidence.ts';

const meta = { format: 'jpeg', fields: [
  { label: 'Created', value: '2026:11:01 09:30:00', group: 'timestamps', source: 'EXIF DateTimeOriginal' },
  { label: 'Modified', value: '2026-11-03T10:00:00Z', group: 'timestamps' },
  { label: 'Artist', value: 'Jo', group: 'authorship' },
] } as unknown as FileMetadata;
const report = { format: 'jpeg', claim: { actions: [{ action: 'c2pa.created', when: '2026-11-04T08:00:00Z' }, { action: 'c2pa.edited' }] }, signer: { notBefore: '2026-01-01T00:00:00Z', notAfter: '2027-01-01T00:00:00Z' } };
const finding: VerifyFinding = { id: 'licence', state: 'licence', tone: 'info', strength: 'stated', word: '{name}', detail: 'Declared terms: {name}.', vars: { name: 'CC BY 4.0' }, names: ['CC BY 4.0'], evidence: [] };

test('every recorded time is listed with the place it was read from', () => {
  const times = recordedTimes(report, meta);
  assert.deepEqual(times.map((t) => t.source), ['EXIF DateTimeOriginal', 'jpeg Modified', 'Content Credential action', 'Signer certificate', 'Signer certificate']);
  assert.equal(times[2]!.label, 'created');
  assert.equal(recordedTimes({}, undefined).length, 0);
});

test('findings are copied as filled words, with no placeholders left', () => {
  const copied = JSON.parse(findingsJson('photo.jpg', [finding])) as { file: string; findings: Array<{ word: string; detail: string }> };
  assert.equal(copied.file, 'photo.jpg');
  assert.equal(copied.findings[0]!.word, 'CC BY 4.0');
  assert.equal(copied.findings[0]!.detail, 'Declared terms: CC BY 4.0.');
});

test('the head starts in Summary, says when the name and the bytes disagree, and escapes the file name', () => {
  const html = evidenceHeadHtml([finding], report, meta, 'photo.png', 4);
  assert.match(html, /data-verify-depth="summary" aria-pressed="true"/);
  assert.match(html, /data-evidence-only data-evidence-file="4"[^>]* hidden>/);
  assert.match(html, /The name ends in \.png/);
  assert.match(html, /Times the file records/);
  assert.doesNotMatch(evidenceHeadHtml([finding], report, meta, 'photo.JPG', 0), /The name ends in/);
  assert.doesNotMatch(evidenceHeadHtml([], {}, undefined, '<img src=x>.jpg', 0), /<img/);
});

test('Evidence opens every disclosure and reads the file; Summary closes only what Evidence opened', async (t) => {
  const dom = new JSDOM(`<body><div id="report"><div class="valid-result"><div class="vf-column">${evidenceHeadHtml([finding], report, meta, 'photo.jpg', 0)}
    <details id="a"><summary>a</summary></details><details id="b" open><summary>b</summary></details></div></div></div></body>`);
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node']) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value: (dom.window as unknown as Record<string, unknown>)[key], configurable: true, writable: true });
  }
  t.after(() => { for (const [key, d] of originals) { if (d) Object.defineProperty(globalThis, key, d); else delete (globalThis as Record<string, unknown>)[key]; } });
  const root = dom.window.document.querySelector<HTMLElement>('#report')!;
  const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg');
  const details = (id: string) => root.querySelector<HTMLDetailsElement>(`#${id}`)!;

  applyDepth(root, 'evidence', () => file);
  assert.equal(root.querySelector<HTMLElement>('.valid-result')!.dataset.vfDepth, 'evidence');
  assert.equal(root.querySelector<HTMLElement>('[data-evidence-only]')!.hidden, false);
  assert.equal(details('a').open, true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(root.querySelector('[data-evidence-size]')!.textContent, '3 B (3 bytes)');
  assert.equal(root.querySelector('[data-evidence-sha]')!.textContent, '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81');

  applyDepth(root, 'summary', () => file);
  assert.equal(root.querySelector<HTMLElement>('[data-evidence-only]')!.hidden, true);
  assert.equal(details('a').open, false, 'a disclosure Evidence opened is closed again');
  assert.equal(details('b').open, true, 'a disclosure the reader had open stays open');
});
