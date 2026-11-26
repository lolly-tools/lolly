// SPDX-License-Identifier: MPL-2.0
/**
 * A shell that writes its own Content Credential in place of the one the browser wrote
 * (the MCP server, for a lifetime or an intent) keeps what that credential recorded
 * about the pictures placed in the file: each credentialed picture with its manifests,
 * an AI-made one included, and the pieces the steps declare AI-made. Nothing else is
 * carried, and what is carried is written as it was.
 *
 * Run: node --test tests/c2pa-placed-pictures.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import {
  embedC2pa, exportActionSteps, extractC2paStore, placedPicturesOf, pdfWithoutCredential, prepareC2paIngredientFromStore,
  verifyC2pa, GENERATED_SOURCE_TYPE, CAPTURE_SOURCE_TYPE,
} from '../engine/src/index.ts';
import { aiFactsFromSteps } from '../engine/src/c2pa.ts';
import { parseC2paStore, decodeCbor } from '../engine/src/c2pa-verify.ts';

const PNG_1PX = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
const DATES = { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 30 * 86_400_000) };

/** A picture with a credential of its own: a camera capture, or an AI generation. */
async function picture(title: string, sourceType: string): Promise<Uint8Array> {
  return embedC2pa(PNG_1PX, 'png', { title, claimGenerator: 'Camera or generator', actions: [{ action: 'c2pa.created', digitalSourceType: sourceType }], dates: DATES });
}

/** The ingredient a browser export makes of a placed picture: its store, as a component. */
async function placed(title: string, sourceType: string): Promise<ReturnType<typeof prepareC2paIngredientFromStore> & object> {
  const found = extractC2paStore(await picture(title, sourceType))!;
  return { ...prepareC2paIngredientFromStore(found.store, found.format)!, relationship: 'componentOf' };
}

/** A page as the web shell stamps it: two placed pictures, one declared AI-made. */
async function browserStamped(): Promise<{ bytes: Uint8Array; photo: Awaited<ReturnType<typeof placed>>; generated: Awaited<ReturnType<typeof placed>> }> {
  const photo = await placed('Harbour photo', CAPTURE_SOURCE_TYPE);
  const generated = await placed('Generated sky', GENERATED_SOURCE_TYPE);
  const aiIngredients = [{ name: 'Generated sky', kind: 'full' as const }];
  const bytes = await embedC2pa(PNG_1PX, 'png', {
    title: 'Poster', claimGenerator: 'Lolly lolly.tools', environment: { surface: 'web' },
    actions: exportActionSteps('png', { aiIngredients }), ingredients: [photo, generated], aiDisclosure: {}, dates: DATES,
  });
  return { bytes, photo, generated };
}

const storeOf = (bytes: Uint8Array): Uint8Array => extractC2paStore(bytes)!.store;

/** The ingredient assertions of a file's active manifest, decoded, in order. */
function ingredientAssertions(bytes: Uint8Array): Array<Map<unknown, unknown>> {
  return parseC2paStore(storeOf(bytes)).assertions
    .filter((a) => /^c2pa\.ingredient/.test(a.label))
    .map((a) => decodeCbor(a.content) as Map<unknown, unknown>);
}

test('the record of placed pictures reads back as the ingredients the browser wrote', async () => {
  const { bytes, photo, generated } = await browserStamped();
  const read = placedPicturesOf(storeOf(bytes));
  assert.equal(read.ingredients.length, 2);
  for (const [got, want] of [[read.ingredients[0]!, photo], [read.ingredients[1]!, generated]] as const) {
    assert.equal(got.activeLabel, want.activeLabel);
    assert.equal(got.title, want.title);
    assert.equal(got.relationship, 'componentOf');
    assert.deepEqual(got.manifestBoxes.map((b) => Buffer.from(b).toString('hex')), want.manifestBoxes.map((b) => Buffer.from(b).toString('hex')), 'the manifests, verbatim');
    assert.equal(got.digitalSourceType, want.digitalSourceType, 'the source type the browser carried');
  }
  assert.equal(read.ingredients[1]!.digitalSourceType, GENERATED_SOURCE_TYPE, 'the AI picture keeps its source type');
  assert.equal(read.ingredients[0]!.digitalSourceType, undefined, 'a capture is not an AI type, so none was carried for it');
  assert.deepEqual(read.aiIngredients, [{ name: 'Generated sky', kind: 'full' }]);
  assert.equal(read.aiUpscale, undefined);
});

test('a credential written from that record holds the same ingredients and the same AI steps, and nothing more', async () => {
  const { bytes } = await browserStamped();
  const read = placedPicturesOf(storeOf(bytes));
  const server = await embedC2pa(bytes, 'png', {
    title: 'Poster', claimGenerator: 'Lolly lolly.tools', environment: { surface: 'mcp' },
    actions: exportActionSteps('png', { aiIngredients: read.aiIngredients }), ingredients: read.ingredients, aiDisclosure: {}, dates: DATES,
  });
  const report = await verifyC2pa(server);
  assert.equal(report.state, 'valid');
  assert.equal((report.environment as Record<string, unknown>).surface, 'mcp', 'this is the replacing credential');
  // The ingredient assertions are the browser's, byte for byte once decoded.
  assert.deepEqual(ingredientAssertions(server), ingredientAssertions(bytes));
  const active = report.ingredients!.filter((i) => i.manifest === parseC2paStore(storeOf(server)).manifestLabel);
  assert.deepEqual(active.map((i) => [i.title, i.relationship, i.credentialed]), [['Harbour photo', 'componentOf', true], ['Generated sky', 'componentOf', true]]);
  // The AI facts: the generated piece's own credential, the placed step and the disclosure.
  assert.ok(report.history!.some((s) => s.action === 'c2pa.placed' && s.digitalSourceType === GENERATED_SOURCE_TYPE));
  assert.ok(report.history!.some((s) => s.description === 'Placed AI-declared ingredient: Generated sky (AI-generated)'));
  assert.ok(report.aiDisclosure, 'the AI disclosure travels');
  // The store holds the browser's ingredient manifests once each, and no copy of the browser's own manifest.
  const browserLabel = parseC2paStore(storeOf(bytes)).manifestLabel;
  assert.equal(report.ingredients!.some((i) => i.manifest === browserLabel), false);
});

test('a credential with no placed pictures carries nothing, and an unreadable store carries nothing', async () => {
  const plain = await embedC2pa(PNG_1PX, 'png', { title: 'Plain', dates: DATES });
  assert.deepEqual(placedPicturesOf(storeOf(plain)), { ingredients: [], aiIngredients: [] });
  assert.deepEqual(placedPicturesOf(new Uint8Array([1, 2, 3])), { ingredients: [], aiIngredients: [] });
});

test('the AI steps read back only when writing them again gives the same words', () => {
  const lists = [
    [{ name: 'Sky', kind: 'full' as const }],
    [{ name: 'Sky, at dusk', kind: 'partial' as const }, { name: 'Rocks and sand', kind: 'full' as const }],
    [{ name: 'a', kind: 'full' as const }, { name: 'b (draft)', kind: 'partial' as const }, { name: 'c', kind: 'full' as const }],
  ];
  for (const aiIngredients of lists) {
    const steps = exportActionSteps('png', { aiIngredients, aiUpscale: { model: 'Real ESRGAN x4', version: '0.3' } });
    assert.deepEqual(aiFactsFromSteps(steps), { aiIngredients, aiUpscale: { model: 'Real ESRGAN x4', version: '0.3' } });
    assert.deepEqual(exportActionSteps('png', aiFactsFromSteps(steps)), steps, 'the same steps again');
  }
  // Another writer's placed step, or one naming an ingredient, is not a declaration.
  assert.deepEqual(aiFactsFromSteps([{ action: 'c2pa.placed', description: 'Placed Harbour photo', parameters: new Map() }]), { aiIngredients: [] });
  assert.deepEqual(aiFactsFromSteps([{ action: 'c2pa.placed', description: 'Placed AI-declared ingredient: x (made by hand)' }]), { aiIngredients: [] });
});

test('a PDF loses the credential update and nothing else, and only that update is cut', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 100]);
  doc.setTitle('Certificate');
  const base = await doc.save({ useObjectStreams: false });
  const stamped = await embedC2pa(base, 'pdf', { title: 'Certificate', dates: DATES });
  const cut = pdfWithoutCredential(stamped);
  assert.ok(cut);
  assert.equal((await verifyC2pa(cut)).state, 'none');
  // The bytes before the update are the file the browser stamped, give or take the one newline the embedder adds.
  assert.equal(Buffer.from(cut).toString('latin1').replace(/\n$/, ''), Buffer.from(base).toString('latin1').replace(/\n$/, ''));
  const again = await embedC2pa(cut, 'pdf', { title: 'Certificate', dates: DATES });
  assert.equal((await verifyC2pa(again)).state, 'valid');
  assert.equal(Buffer.from(again).toString('latin1').split('manifest.c2pa').length - 1, Buffer.from(stamped).toString('latin1').split('manifest.c2pa').length - 1, 'one credential, as before');
  assert.equal((await PDFDocument.load(again, { updateMetadata: false })).getTitle(), 'Certificate');
  // Nothing to cut: a PDF with no credential, one with object streams, and bytes that are not a PDF.
  assert.equal(pdfWithoutCredential(base), null);
  assert.equal(pdfWithoutCredential(await doc.save({ useObjectStreams: true })), null);
  assert.equal(pdfWithoutCredential(new TextEncoder().encode('not a pdf')), null);
  // An edit appended after the credential is someone's update, not the credential's.
  const edited = new Uint8Array([...stamped, ...new TextEncoder().encode('% a note\n')]);
  assert.equal(pdfWithoutCredential(edited), null);
});

// D1: a shell that replaces the web shell's credential with its own (the CLI with an
// identity, the MCP server) keeps a rendition's parent and the step that says what was
// done to it, so its credential never claims a rendition was made from nothing.
test('a replacing credential keeps a rendition: the parent opened, then what was done to it', async () => {
  const parent = { ...(await placed('Harbour photo', CAPTURE_SOURCE_TYPE)), relationship: 'parentOf' };
  const web = await embedC2pa(PNG_1PX, 'png', {
    title: 'Darkroom', claimGenerator: 'Lolly lolly.tools', environment: { surface: 'web' },
    actions: exportActionSteps('png', { rendition: { action: 'c2pa.color_adjustments' } }), ingredients: [parent], dates: DATES,
  });
  const read = placedPicturesOf(storeOf(web));
  assert.deepEqual(read.rendition, { action: 'c2pa.color_adjustments' });
  assert.equal(read.ingredients[0]!.relationship, 'parentOf');
  const { buildExportC2paOpts } = await import('../packages/node-shell/src/c2pa-opts.ts');
  const opts = buildExportC2paOpts({
    surface: 'mcp', manifest: { id: 'darkroom', name: 'Darkroom', version: '2.6.0', render: { width: 4, height: 4 } } as never, model: [],
    format: 'png', dims: { width: 4, height: 4 }, profile: {}, ingredients: read.ingredients as never, carried: read,
  } as never);
  assert.deepEqual((opts.actions ?? []).map((s) => s.action), ['c2pa.color_adjustments', 'c2pa.converted']);
  const again = await embedC2pa(PNG_1PX, 'png', opts);
  const report = await verifyC2pa(again);
  assert.equal(report.state, 'valid');
  assert.deepEqual(placedPicturesOf(storeOf(again)).rendition, { action: 'c2pa.color_adjustments' }, 'and it reads back the same');
  // A record with no parent left carries no rendition: a history has to start somewhere true.
  const orphan = buildExportC2paOpts({ surface: 'mcp', manifest: { id: 'darkroom', name: 'Darkroom', version: '2.6.0', render: { width: 4, height: 4 } } as never, model: [], format: 'png', dims: { width: 4, height: 4 }, profile: {}, ingredients: [], carried: read } as never);
  assert.equal(orphan.actions, undefined);
});
