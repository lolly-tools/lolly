// SPDX-License-Identifier: MPL-2.0
/**
 * localizeToolIndex - the non-destructive-localization contract (plans/99 section 2e).
 *
 * Run directly:  node --test shells/web/src/catalog/sync.test.ts
 *
 * The bug this pins against regressing: localizeToolIndex used to overwrite
 * tool.name/description IN PLACE with the active language's overlay, which made
 * the English name unsearchable in any non-English session (a Spanish user
 * could not find "Compress PDF" by typing "compress"). The fix stashes the
 * pristine strings on `tool.en` before overlaying; search haystacks read both.
 *
 * jsdom globals go in before the module import - i18n (setActiveLang writes
 * document.documentElement.lang) and sync's transitive imports expect a DOM.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { setActiveLang } = await import('../i18n.ts');
const { localizeToolIndex } = await import('./sync.ts');

/** A fresh two-tool fixture per test - one translated into Spanish, one not.
 *  The explicit type mirrors sync.ts's ToolIndex entry shape (incl. the `en`
 *  stash localizeToolIndex writes), which a bare literal would not infer. */
type FixtureTool = {
  id: string;
  name: string;
  description: string;
  en?: { name: unknown; description: unknown };
  featured?: { blurb: string };
  i18n?: Record<string, { name?: string; description?: string; blurb?: string }>;
};

function fixture(): { tools: FixtureTool[] } {
  return {
    tools: [
      {
        id: 'compress-pdf',
        name: 'Compress PDF',
        description: 'Shrink a PDF on-device',
        featured: { blurb: 'Squeeze it' },
        i18n: { es: { name: 'Comprimir PDF', description: 'Reduce un PDF en el dispositivo', blurb: 'Exprímelo' } },
      },
      { id: 'qr-code', name: 'QR Code', description: 'Make a QR' },
    ],
  };
}

test('non-English session: overlays the translation AND stashes pristine English on tool.en', async () => {
  await setActiveLang('es', { persist: false });
  const index = fixture();
  localizeToolIndex(index);
  const [pdf, qr] = index.tools;
  assert.equal(pdf!.name, 'Comprimir PDF');
  assert.equal(pdf!.description, 'Reduce un PDF en el dispositivo');
  assert.equal((pdf!.featured as { blurb: string }).blurb, 'Exprímelo');
  assert.deepEqual(pdf!.en, { name: 'Compress PDF', description: 'Shrink a PDF on-device' });
  // A tool with no overlay for the language is untouched - its fields already
  // ARE English, so consumers read `tool.en?.name ?? tool.name`.
  assert.equal(qr!.name, 'QR Code');
  assert.equal(qr!.en, undefined);
});

test('a second localize pass cannot stash already-localized strings over the English ones', async () => {
  await setActiveLang('es', { persist: false });
  const index = fixture();
  localizeToolIndex(index);
  localizeToolIndex(index);
  assert.equal(index.tools[0]!.name, 'Comprimir PDF');
  assert.deepEqual(index.tools[0]!.en, { name: 'Compress PDF', description: 'Shrink a PDF on-device' });
});

test('English session: a pure no-op - nothing overlaid, nothing stashed', async () => {
  await setActiveLang('en', { persist: false });
  const index = fixture();
  localizeToolIndex(index);
  assert.equal(index.tools[0]!.name, 'Compress PDF');
  assert.equal(index.tools[0]!.en, undefined);
});
