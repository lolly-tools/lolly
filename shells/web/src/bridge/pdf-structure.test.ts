// SPDX-License-Identifier: MPL-2.0
/**
 * The PDF structural scan, asserted through a real save/reopen cycle.
 * Run directly:  node --test shells/web/src/bridge/pdf-structure.test.ts
 *
 * Every case builds a pdf-lib document, wires the object graph by hand, saves
 * it, and RE-OPENS the bytes before scanning. That round trip is the point: the
 * scanner's job is to find things in a file someone else wrote, and a graph
 * asserted only in the memory that built it proves nothing about what survives
 * serialisation - indirect references in particular only become PDFRefs once
 * the document has been through the context.
 *
 * The graphs here are hand-built rather than harvested from sample files so each
 * one isolates a single structure. No DOM: the scanner takes a loaded document.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanPdfStructure } from './pdf-structure.ts';
import type { PdfFinding } from '@lolly-tools/core/host-v1';

// ─── harness ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

// pdf-lib is loaded once at module scope so the fixtures below can build string
// objects synchronously. This matters: `context.obj('x')` yields a PDFName, not a
// PDFString - filenames, script bodies, URIs, field values and comment text are
// all TEXT STRINGS in the spec, so a fixture that spells them as bare JS strings
// builds a document no real producer would write, and tests nothing.
const { PDFDocument, PDFName, PDFString } = await import('pdf-lib') as Any;

/** A PDF text string - the type the spec requires wherever prose is stored. */
const S = (v: string): Any => PDFString.of(v);

/** A one-page document to hang structures off. */
async function doc1(): Promise<Any> {
  const d = await PDFDocument.create();
  d.addPage([595, 842]);
  return d;
}

/** Save and reopen, then scan - what a READER of the file actually finds. */
async function scan(doc: Any): Promise<PdfFinding[]> {
  const bytes = await doc.save({ updateFieldAppearances: false });
  const reopened = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return scanPdfStructure(reopened);
}

const find = (fs: PdfFinding[], label: string): PdfFinding | undefined => fs.find((f) => f.label === label);
const labels = (fs: PdfFinding[]): string[] => fs.map((f) => f.label);

/** Register a dict as an indirect object and hand back its ref. */
function reg(doc: Any, obj: Record<string, unknown>): Any {
  return doc.context.register(doc.context.obj(obj));
}

/** An embedded-file stream of `n` bytes, sized via /Params /Size like a real one. */
function payload(doc: Any, n: number): Any {
  return doc.context.register(doc.context.flateStream(new Uint8Array(n), { Type: 'EmbeddedFile', Params: { Size: n } }));
}

/** A /Filespec naming an embedded payload. */
function filespec(doc: Any, name: string, size = 64): Any {
  return reg(doc, { Type: 'Filespec', F: S(name), UF: S(name), EF: { F: payload(doc, size) } });
}

/** Set a key on the document catalog. */
function onCatalog(doc: Any, key: string, value: unknown): void {
  doc.catalog.set(PDFName.of(key), value);
}

/** Attach an /Annots array to the first page. */
function annots(doc: Any, items: unknown[]): void {
  doc.getPages()[0].node.set(PDFName.of('Annots'), doc.context.obj(items));
}

// ─── baseline ─────────────────────────────────────────────────────────────────

test('a document with nothing in it reports only its page count', async () => {
  const findings = await scan(await doc1());
  assert.deepEqual(labels(findings), ['Pages']);
  assert.equal(find(findings, 'Pages')!.detail, '1 page');
  // Nothing structural means nothing flagged - a clean file must read as clean.
  assert.equal(findings.some((f) => f.tone === 'warn'), false);
});

test('page count pluralises', async () => {
  const doc = await doc1();
  doc.addPage([595, 842]);
  assert.equal(find(await scan(doc), 'Pages')!.detail, '2 pages');
});

// ─── attachments ──────────────────────────────────────────────────────────────

test('an /EmbeddedFiles name tree is reported with filename and size', async () => {
  const doc = await doc1();
  const stream = doc.context.register(
    doc.context.flateStream(new Uint8Array(2048), { Type: 'EmbeddedFile', Params: { Size: 2048 } }),
  );
  const spec = reg(doc, { Type: 'Filespec', F: S('payload.zip'), UF: S('payload.zip'), EF: { F: stream } });
  onCatalog(doc, 'Names', doc.context.obj({ EmbeddedFiles: { Names: [S('payload.zip'), spec] } }));

  const f = find(await scan(doc), 'Attachments')!;
  assert.ok(f, 'attachment not found');
  assert.equal(f.tone, 'warn');
  assert.match(f.detail, /1 embedded file/);
  assert.match(f.detail, /payload\.zip/);
  // The size shown is /Params /Size (the true size), not the deflated /Length.
  assert.match(f.detail, /2\.0 KB/);
});

test('a nested name tree is flattened through /Kids', async () => {
  const doc = await doc1();
  const spec = (name: string): Any => reg(doc, { Type: 'Filespec', UF: name, EF: { F: doc.context.register(doc.context.flateStream(new Uint8Array(16))) } });
  const leafA = reg(doc, { Names: [S('a.txt'), spec('a.txt')] });
  const leafB = reg(doc, { Names: [S('b.txt'), spec('b.txt')] });
  onCatalog(doc, 'Names', doc.context.obj({ EmbeddedFiles: { Kids: [leafA, leafB] } }));

  const f = find(await scan(doc), 'Attachments')!;
  assert.match(f.detail, /2 embedded files/);
  assert.match(f.detail, /a\.txt/);
  assert.match(f.detail, /b\.txt/);
});

test('a /FileAttachment annotation is found even with no name tree', async () => {
  const doc = await doc1();
  const spec = reg(doc, { Type: 'Filespec', UF: S('pinned.docx'), EF: { F: doc.context.register(doc.context.flateStream(new Uint8Array(64))) } });
  annots(doc, [reg(doc, { Type: 'Annot', Subtype: 'FileAttachment', Rect: [0, 0, 10, 10], FS: spec })]);

  const f = find(await scan(doc), 'Attachments')!;
  assert.match(f.detail, /1 embedded file/);
  assert.match(f.detail, /pinned\.docx/);
  // A FileAttachment is a payload, not authored commentary - it must not also
  // inflate the annotation count.
  assert.equal(find(await scan(doc), 'Annotations'), undefined);
});

test('the same payload in both the tree and an annotation counts once', async () => {
  const doc = await doc1();
  const stream = doc.context.register(doc.context.flateStream(new Uint8Array(32), { Params: { Size: 32 } }));
  const spec = reg(doc, { Type: 'Filespec', UF: S('dup.bin'), EF: { F: stream } });
  onCatalog(doc, 'Names', doc.context.obj({ EmbeddedFiles: { Names: [S('dup.bin'), spec] } }));
  annots(doc, [reg(doc, { Type: 'Annot', Subtype: 'FileAttachment', Rect: [0, 0, 1, 1], FS: spec })]);

  assert.match(find(await scan(doc), 'Attachments')!.detail, /1 embedded file/);
});

test('an /AF associated file on the catalog is reported', async () => {
  const doc = await doc1();
  const spec = reg(doc, { Type: 'Filespec', UF: S('manifest.c2pa'), EF: { F: doc.context.register(doc.context.flateStream(new Uint8Array(8))) } });
  onCatalog(doc, 'AF', doc.context.obj([spec]));

  assert.match(find(await scan(doc), 'Attachments')!.detail, /manifest\.c2pa/);
});

// ─── JavaScript + actions ─────────────────────────────────────────────────────

test('an /OpenAction script is reported with a snippet', async () => {
  const doc = await doc1();
  onCatalog(doc, 'OpenAction', reg(doc, { S: 'JavaScript', JS: S('app.alert("hi");') }));

  const f = find(await scan(doc), 'JavaScript')!;
  assert.ok(f, 'script not found');
  assert.equal(f.tone, 'warn');
  assert.match(f.detail, /1 script/);
  assert.match(f.detail, /app\.alert/);
});

test('a document-level /Names /JavaScript tree is reported', async () => {
  const doc = await doc1();
  onCatalog(doc, 'Names', doc.context.obj({
    JavaScript: { Names: [S('boot'), reg(doc, { S: 'JavaScript', JS: S('this.print();') })] },
  }));

  assert.match(find(await scan(doc), 'JavaScript')!.detail, /this\.print/);
});

test('a script hidden behind an action /Next chain is still found', async () => {
  const doc = await doc1();
  // A benign-looking /GoTo that chains into a script: the case a scanner which
  // only reads the first action's /S misses entirely.
  const chained = reg(doc, { S: 'JavaScript', JS: S('sneaky();') });
  onCatalog(doc, 'OpenAction', reg(doc, { S: 'GoTo', Next: chained }));

  assert.match(find(await scan(doc), 'JavaScript')!.detail, /sneaky/);
});

test('a /JS carried as a stream rather than a string is decoded', async () => {
  const doc = await doc1();
  // A long program is stored as a stream and REFERENCED from the action's /JS,
  // rather than inlined as a string literal.
  const js = doc.context.register(doc.context.flateStream(new TextEncoder().encode('streamed();')));
  onCatalog(doc, 'Names', doc.context.obj({
    JavaScript: { Names: [S('s'), reg(doc, { S: 'JavaScript', JS: js })] },
  }));

  assert.match(find(await scan(doc), 'JavaScript')!.detail, /streamed/);
});

test('identical scripts in two places are counted once', async () => {
  const doc = await doc1();
  onCatalog(doc, 'OpenAction', reg(doc, { S: 'JavaScript', JS: S('same();') }));
  onCatalog(doc, 'Names', doc.context.obj({
    JavaScript: { Names: [S('a'), reg(doc, { S: 'JavaScript', JS: S('same();') })] },
  }));

  assert.match(find(await scan(doc), 'JavaScript')!.detail, /1 script/);
});

test('an annotation /AA additional action is walked', async () => {
  const doc = await doc1();
  annots(doc, [reg(doc, {
    Type: 'Annot', Subtype: 'Widget', Rect: [0, 0, 1, 1],
    AA: { E: reg(doc, { S: 'JavaScript', JS: S('onEnter();') }) },
  })]);

  assert.match(find(await scan(doc), 'JavaScript')!.detail, /onEnter/);
});

test('launch, submit and remote-jump actions each get their own finding', async () => {
  const doc = await doc1();
  annots(doc, [
    reg(doc, { Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 1, 1], A: reg(doc, { S: 'Launch', F: S('cmd.exe') }) }),
    reg(doc, { Type: 'Annot', Subtype: 'Widget', Rect: [0, 0, 1, 1], A: reg(doc, { S: 'SubmitForm', F: S('https://collect.example/post') }) }),
    reg(doc, { Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 1, 1], A: reg(doc, { S: 'GoToR', F: S('other.pdf') }) }),
  ]);

  const fs = await scan(doc);
  assert.match(find(fs, 'Launch actions')!.detail, /cmd\.exe/);
  assert.equal(find(fs, 'Launch actions')!.tone, 'warn');
  assert.match(find(fs, 'Form submission')!.detail, /collect\.example/);
  assert.equal(find(fs, 'Form submission')!.tone, 'warn');
  assert.match(find(fs, 'Remote documents')!.detail, /other\.pdf/);
});

test('a /Launch whose target is a filespec dict resolves the filename', async () => {
  const doc = await doc1();
  const spec = reg(doc, { Type: 'Filespec', UF: S('payload.bat') });
  onCatalog(doc, 'OpenAction', reg(doc, { S: 'Launch', F: spec }));

  assert.match(find(await scan(doc), 'Launch actions')!.detail, /payload\.bat/);
});

test('outbound links are summarised by host', async () => {
  const doc = await doc1();
  annots(doc, [
    reg(doc, { Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 1, 1], A: reg(doc, { S: 'URI', URI: S('https://track.example/a?u=1') }) }),
    reg(doc, { Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 1, 1], A: reg(doc, { S: 'URI', URI: S('https://track.example/b') }) }),
  ]);

  const f = find(await scan(doc), 'Links')!;
  assert.match(f.detail, /2 outbound links/);
  assert.match(f.detail, /track\.example/);
  // Links are disclosure, not hidden behaviour - neutral tone.
  assert.equal(f.tone, '');
});

test('a link with an unparseable URI still reports the raw target', async () => {
  const doc = await doc1();
  annots(doc, [reg(doc, { Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 1, 1], A: reg(doc, { S: 'URI', URI: S('not a url') }) })]);

  assert.match(find(await scan(doc), 'Links')!.detail, /not a url/);
});

// ─── AcroForm ─────────────────────────────────────────────────────────────────

test('filled form fields are reported by qualified name and value', async () => {
  const doc = await doc1();
  const field = reg(doc, { FT: 'Tx', T: S('ssn'), V: S('123-45-6789') });
  onCatalog(doc, 'AcroForm', doc.context.obj({ Fields: [field] }));

  const f = find(await scan(doc), 'Form values')!;
  assert.ok(f, 'form value not found');
  assert.equal(f.tone, 'warn');
  assert.match(f.detail, /1 filled field/);
  assert.match(f.detail, /ssn: 123-45-6789/);
});

test('a nested field tree yields dotted qualified names and inherits /FT', async () => {
  const doc = await doc1();
  const kid = reg(doc, { T: S('city'), V: S('Berlin') });          // no /FT - inherits
  const parent = reg(doc, { FT: 'Tx', T: S('address'), Kids: [kid] });
  onCatalog(doc, 'AcroForm', doc.context.obj({ Fields: [parent] }));

  assert.match(find(await scan(doc), 'Form values')!.detail, /address\.city: Berlin/);
});

test('an unchecked checkbox is not a filled value', async () => {
  const doc = await doc1();
  onCatalog(doc, 'AcroForm', doc.context.obj({
    Fields: [
      reg(doc, { FT: 'Btn', T: S('agree'), V: 'Off' }),
      reg(doc, { FT: 'Btn', T: S('subscribe'), V: 'Yes' }),
    ],
  }));

  const f = find(await scan(doc), 'Form values')!;
  assert.match(f.detail, /1 filled field/);
  assert.match(f.detail, /subscribe: Yes/);
  assert.doesNotMatch(f.detail, /agree/);
});

test('a widget kid with no name of its own does not become a second field', async () => {
  const doc = await doc1();
  // The common real shape: one field, one appearance widget merged as a kid.
  const widget = reg(doc, { Type: 'Annot', Subtype: 'Widget', Rect: [0, 0, 10, 10] });
  onCatalog(doc, 'AcroForm', doc.context.obj({ Fields: [reg(doc, { FT: 'Tx', T: S('name'), V: S('Ada'), Kids: [widget] })] }));

  assert.match(find(await scan(doc), 'Form values')!.detail, /1 filled field/);
});

test('a signed signature field is reported as evidence, not as a leak', async () => {
  const doc = await doc1();
  const sig = reg(doc, { FT: 'Sig', T: S('approval'), V: reg(doc, { Type: 'Sig', Name: S('Ada Lovelace') }) });
  onCatalog(doc, 'AcroForm', doc.context.obj({ Fields: [sig] }));

  const fs = await scan(doc);
  const f = find(fs, 'Digital signature')!;
  assert.ok(f, 'signature not found');
  assert.equal(f.tone, '');
  assert.match(f.detail, /re-saving this file invalidates it/);
  // A signature's own /V must not be listed as a filled form value.
  assert.equal(find(fs, 'Form values'), undefined);
});

test('an XFA form layer is reported', async () => {
  const doc = await doc1();
  onCatalog(doc, 'AcroForm', doc.context.obj({
    Fields: [], XFA: doc.context.register(doc.context.flateStream(new TextEncoder().encode('<xdp/>'))),
  }));

  assert.ok(find(await scan(doc), 'XFA form'));
});

// ─── annotations ──────────────────────────────────────────────────────────────

test('markup annotations report author and comment text', async () => {
  const doc = await doc1();
  annots(doc, [reg(doc, {
    Type: 'Annot', Subtype: 'Text', Rect: [0, 0, 1, 1], T: S('Grace Hopper'), Contents: S('reject this clause'),
  })]);

  const f = find(await scan(doc), 'Annotations')!;
  assert.equal(f.tone, 'warn');
  assert.match(f.detail, /1 annotation/);
  assert.match(f.detail, /Grace Hopper/);
  assert.match(f.detail, /reject this clause/);
});

test('links, widgets and popups are page furniture, not commentary', async () => {
  const doc = await doc1();
  annots(doc, [
    reg(doc, { Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 1, 1] }),
    reg(doc, { Type: 'Annot', Subtype: 'Widget', Rect: [0, 0, 1, 1] }),
    reg(doc, { Type: 'Annot', Subtype: 'Popup', Rect: [0, 0, 1, 1] }),
  ]);

  assert.equal(find(await scan(doc), 'Annotations'), undefined);
});

test('an anonymous markup annotation is counted without a warn tone', async () => {
  const doc = await doc1();
  annots(doc, [reg(doc, { Type: 'Annot', Subtype: 'Square', Rect: [0, 0, 1, 1] })]);

  const f = find(await scan(doc), 'Annotations')!;
  assert.match(f.detail, /1 annotation/);
  assert.equal(f.tone, '');
});

// ─── optional content ─────────────────────────────────────────────────────────

test('layers switched off in the default config are flagged as hidden', async () => {
  const doc = await doc1();
  const visible = reg(doc, { Type: 'OCG', Name: S('Artwork') });
  const off = reg(doc, { Type: 'OCG', Name: S('Internal notes') });
  onCatalog(doc, 'OCProperties', doc.context.obj({ OCGs: [visible, off], D: { OFF: [off] } }));

  const fs = await scan(doc);
  const f = find(fs, 'Hidden layers')!;
  assert.ok(f, 'hidden layer not found');
  assert.equal(f.tone, 'warn');
  assert.match(f.detail, /Internal notes/);
  // The hidden finding replaces the plain inventory rather than doubling it.
  assert.equal(find(fs, 'Layers'), undefined);
});

test('all-visible layers are plain inventory', async () => {
  const doc = await doc1();
  onCatalog(doc, 'OCProperties', doc.context.obj({
    OCGs: [reg(doc, { Type: 'OCG', Name: S('Artwork') })], D: { ON: [] },
  }));

  const f = find(await scan(doc), 'Layers')!;
  assert.equal(f.tone, '');
  assert.match(f.detail, /Artwork/);
});

// ─── hostile input ────────────────────────────────────────────────────────────

test('a name tree that references itself terminates', async () => {
  const doc = await doc1();
  const node = doc.context.obj({ Names: [] });
  const ref = doc.context.register(node);
  node.set(PDFName.of('Kids'), doc.context.obj([ref])); // self-referential /Kids
  onCatalog(doc, 'Names', doc.context.obj({ EmbeddedFiles: ref }));

  // The assertion is that this returns at all.
  assert.ok(Array.isArray(await scan(doc)));
});

test('an action chain that loops terminates', async () => {
  const doc = await doc1();
  const action = doc.context.obj({ S: 'JavaScript', JS: S('loop();') });
  const ref = doc.context.register(action);
  action.set(PDFName.of('Next'), ref);
  onCatalog(doc, 'OpenAction', ref);

  assert.match(find(await scan(doc), 'JavaScript')!.detail, /loop/);
});

test('a long list is truncated with a remainder count', async () => {
  const doc = await doc1();
  const specs = Array.from({ length: 12 }, (_, i) =>
    reg(doc, { Type: 'Filespec', UF: `file-${i}.bin`, EF: { F: doc.context.register(doc.context.flateStream(new Uint8Array([i]))) } }));
  onCatalog(doc, 'Names', doc.context.obj({
    EmbeddedFiles: { Names: specs.flatMap((s, i) => [S(`file-${i}.bin`), s]) },
  }));

  const f = find(await scan(doc), 'Attachments')!;
  assert.match(f.detail, /12 embedded files/);
  assert.match(f.detail, /\+4 more/);   // LIST_CAP is 8
});

test('every detail is bounded regardless of input size', async () => {
  const doc = await doc1();
  onCatalog(doc, 'OpenAction', reg(doc, { S: 'JavaScript', JS: S('x();'.repeat(5000)) }));

  for (const f of await scan(doc)) assert.ok(f.detail.length <= 400, `${f.label} detail was ${f.detail.length} chars`);
});

test('wrong-typed structures are ignored rather than thrown on', async () => {
  const doc = await doc1();
  // Every one of these is the right key holding the wrong kind of object.
  onCatalog(doc, 'Names', doc.context.obj({ EmbeddedFiles: 42 }));
  onCatalog(doc, 'OpenAction', doc.context.obj(['not', 'an', 'action']));
  onCatalog(doc, 'AcroForm', doc.context.obj({ Fields: 'nope' }));
  onCatalog(doc, 'OCProperties', doc.context.obj({ OCGs: 7 }));
  annots(doc, [doc.context.obj(9)]);

  assert.deepEqual(labels(await scan(doc)), ['Pages']);
});
