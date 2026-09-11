// SPDX-License-Identifier: MPL-2.0
/**
 * The PDF/X-4 pass, asserted on the PRODUCED BYTES.
 * Run directly:  node --test shells/web/src/bridge/export-pdfx.test.ts
 *
 * Every test here builds a pdf-lib document, runs applyPdfX over it, `save()`s
 * it, and RE-OPENS the result with pdf-lib before asserting. That is deliberate:
 * the spec-object layer was already right, and the thing worth proving is that a
 * reader of the file finds an OutputIntent whose /DestOutputProfile really is a
 * stream, whose /N really is the profile's channel count, and whose inflated
 * bytes really are the profile that was handed in. A claim about a file that is
 * not read back out of the file is not evidence.
 *
 * No DOM: export-pdfx.ts takes a loaded document, so this needs neither jsdom nor
 * a canvas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import {
  applyPdfX, usedFontsEmbedded, groupCsOk, hasDeviceRgbImage, shadingCsOk,
} from './export-pdfx.ts';
import type { EmbedResolution } from '../lib/press-profile-embed.ts';
import { pressProfileBytes } from '../../../../tests/helpers/icc-fixture.ts';

// ─── harness ──────────────────────────────────────────────────────────────────

/** A one-page document with nothing on it - the neutral case for the claim gate. */
async function blankDoc(): Promise<any> {
  const { PDFDocument } = await import('pdf-lib') as any;
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  return doc;
}

/** Run the pass, save, and hand back a REOPENED document plus the raw bytes. */
async function roundTrip(doc: any, ...args: Parameters<typeof applyPdfX> extends [any, ...infer R] ? R : never): Promise<{
  reopened: any; bytes: Uint8Array; PDFName: any; PDFDict: any;
}> {
  const { PDFDocument, PDFName, PDFDict } = await import('pdf-lib') as any;
  await applyPdfX(doc, ...args);
  const bytes = await doc.save();
  const reopened = await PDFDocument.load(bytes, { updateMetadata: false });
  return { reopened, bytes, PDFName, PDFDict };
}

/** The single OutputIntent dict of a reopened document, or null. */
function intentOf(doc: any, PDFName: any): { dict: any; count: number } | null {
  const arr = doc.catalog.lookup(PDFName.of('OutputIntents'));
  if (!arr) return null;
  const items = arr.asArray();
  return items.length ? { dict: doc.context.lookup(items[0]), count: items.length } : { dict: null, count: 0 };
}

// A PDFString decodes to its text; a PDFName stringifies with its leading slash,
// which is noise in an assertion.
const str = (v: any): string =>
  (v == null ? '' : String(v.decodeText ? v.decodeText() : v).replace(/^\//, ''));

/** Info-dict + XMP agreement on the conformance claim - they must never differ. */
function claimOf(doc: any, bytes: Uint8Array, PDFName: any): { info: boolean; xmp: boolean } {
  const info = Boolean(doc.getInfoDict().get(PDFName.of('GTS_PDFXVersion')));
  const xmp = new TextDecoder().decode(bytes).includes('<pdfxid:GTS_PDFXVersion>');
  return { info, xmp };
}

/** An eligible resolution around real (synthetic) press-profile bytes. */
function embedFor(opts: { paired?: boolean; bytes?: Uint8Array; components?: number } = {}): EmbedResolution {
  const bytes = opts.bytes ?? pressProfileBytes({ desc: 'Fixture Coated v1', charData: 'FOGRA51' });
  return opts.paired === false
    ? {
      bytes, components: opts.components ?? 4,
      identifier: 'Custom', registry: null, info: 'Fixture Coated v1',
      pairedCondition: null, evidence: null, name: 'fixture.icc', desc: 'Fixture Coated v1',
    }
    : {
      bytes, components: opts.components ?? 4,
      identifier: 'FOGRA51', registry: 'http://www.color.org', info: 'PSO Coated v3 (FOGRA51)',
      pairedCondition: 'fogra51', evidence: 'targ', name: 'PSOcoated_v3.icc', desc: 'PSO Coated v3',
    };
}

// ─── the embedded, paired case: a file that really is PDF/X-4 ─────────────────

test('a paired profile is embedded, and the reopened file proves it', async () => {
  const profile = pressProfileBytes({ desc: 'PSO Coated v3', charData: 'FOGRA51' });
  const { reopened, bytes, PDFName } = await roundTrip(
    await blankDoc(), {}, 'own', { embed: embedFor({ bytes: profile }) },
  );

  const intent = intentOf(reopened, PDFName)!;
  assert.equal(intent.count, 1, 'exactly one GTS_PDFX output intent');
  assert.equal(str(intent.dict.get(PDFName.of('S'))), 'GTS_PDFX');
  assert.equal(str(intent.dict.get(PDFName.of('Type'))), 'OutputIntent');
  assert.equal(str(intent.dict.get(PDFName.of('OutputConditionIdentifier'))), 'FOGRA51');
  assert.equal(str(intent.dict.get(PDFName.of('RegistryName'))), 'http://www.color.org');
  assert.match(str(intent.dict.get(PDFName.of('OutputCondition'))), /FOGRA51/);

  // /DestOutputProfile: a real stream, flate-compressed, /N = the profile's channels.
  const dest = reopened.context.lookup(intent.dict.get(PDFName.of('DestOutputProfile')));
  assert.ok(dest?.dict, '/DestOutputProfile must be a stream, not a name or a dict');
  assert.equal(str(dest.dict.get(PDFName.of('Filter'))), 'FlateDecode');
  assert.equal(Number(dest.dict.get(PDFName.of('N')).asNumber()), 4);

  // The bytes in the file ARE the profile that was handed in - the whole point.
  const inflated = new Uint8Array(inflateSync(Buffer.from(dest.contents)));
  assert.deepEqual(inflated, profile, 'the embedded profile must round-trip byte for byte');

  // …and the identity the file declares must be the identity of those bytes.
  const { parseIccProfile, iccCharacterization } = await import('@lolly/engine');
  const reparsed = parseIccProfile(inflated);
  assert.equal(reparsed?.deviceClass, 'prtr');
  assert.equal(reparsed?.dataColourSpace, 'CMYK');
  assert.equal(reparsed?.nChannels, 4, 'the /N written above is the profile’s real channel count');
  assert.equal(iccCharacterization(inflated), 'FOGRA51',
    'the embedded profile’s own targ names the condition the intent declares');

  const claim = claimOf(reopened, bytes, PDFName);
  assert.deepEqual(claim, { info: true, xmp: true }, 'an embedded, clean document may claim PDF/X-4');
  assert.equal(str(reopened.getInfoDict().get(PDFName.of('Trapped'))), 'False');
  assert.ok(reopened.getPage(0).node.get(PDFName.of('TrimBox')), 'every page carries a TrimBox');
});

test('an unpaired profile declares Custom and writes no RegistryName', async () => {
  const { reopened, bytes, PDFName } = await roundTrip(
    await blankDoc(), {}, 'own', { embed: embedFor({ paired: false }) },
  );
  const intent = intentOf(reopened, PDFName)!;
  assert.equal(str(intent.dict.get(PDFName.of('OutputConditionIdentifier'))), 'Custom');
  assert.equal(intent.dict.get(PDFName.of('RegistryName')), undefined,
    'a Custom identity names no registry, so the key must be absent - not an empty string');
  assert.equal(str(intent.dict.get(PDFName.of('Info'))), 'Fixture Coated v1',
    'the file declares the profile’s own description, which is what it can substantiate');
  assert.ok(reopened.context.lookup(intent.dict.get(PDFName.of('DestOutputProfile'))));
  // Still fully conformant: the condition IS the embedded profile.
  assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: true, xmp: true });
});

test('a 1-channel press profile writes /N 1, not a hard-coded 4', async () => {
  const gray = pressProfileBytes({ space: 'GRAY', desc: 'Fixture Gray' });
  const { reopened, PDFName } = await roundTrip(
    await blankDoc(), {}, 'own',
    { embed: { ...embedFor({ paired: false, bytes: gray, components: 1 }) } },
  );
  const dest = reopened.context.lookup(intentOf(reopened, PDFName)!.dict.get(PDFName.of('DestOutputProfile')));
  assert.equal(Number(dest.dict.get(PDFName.of('N')).asNumber()), 1);
});

// ─── the gate did not loosen ──────────────────────────────────────────────────

test('a registry-name condition writes the intent and claims nothing', async () => {
  // The honest tightening: naming FOGRA39 without embedding it was never PDF/X-4.
  // Everything else about the file - the intent, the boxes, the XMP - is unchanged.
  const { reopened, bytes, PDFName } = await roundTrip(await blankDoc(), {}, 'fogra39', {});
  const intent = intentOf(reopened, PDFName)!;
  assert.equal(intent.count, 1);
  assert.equal(str(intent.dict.get(PDFName.of('OutputConditionIdentifier'))), 'FOGRA39');
  assert.equal(intent.dict.get(PDFName.of('DestOutputProfile')), undefined, 'no bytes to embed');
  assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: false, xmp: false },
    'a named-only condition is not PDF/X-4 and must not say it is');
});

test('the sRGB intent still embeds its profile and still claims', async () => {
  const { reopened, bytes, PDFName } = await roundTrip(await blankDoc(), {}, 'srgb', {});
  const intent = intentOf(reopened, PDFName)!;
  assert.equal(str(intent.dict.get(PDFName.of('OutputConditionIdentifier'))), 'sRGB IEC61966-2.1');
  const dest = reopened.context.lookup(intent.dict.get(PDFName.of('DestOutputProfile')));
  assert.equal(Number(dest.dict.get(PDFName.of('N')).asNumber()), 3);
  assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: true, xmp: true });
});

test('an unmanaged DeviceRGB image blocks the claim EVEN WITH a profile embedded', async () => {
  // PDF/X's own colour-consistency rule: DeviceRGB content under a CMYK intent is a
  // violation, and embedding a CMYK profile does not cure it. This is the single
  // line of the gate that must never be relaxed for the embed path.
  const { PDFName, PDFRawStream } = await import('pdf-lib') as any;
  const doc = await blankDoc();
  const img = PDFRawStream.of(doc.context.obj({
    Type: 'XObject', Subtype: 'Image', Width: 1, Height: 1,
    ColorSpace: 'DeviceRGB', BitsPerComponent: 8,
  }), Uint8Array.from([255, 0, 0]));
  doc.context.register(img);

  const { reopened, bytes } = await roundTrip(doc, {}, 'own', { embed: embedFor() });
  const intent = intentOf(reopened, PDFName)!;
  assert.ok(reopened.context.lookup(intent.dict.get(PDFName.of('DestOutputProfile'))),
    'the intent and its profile are still written - a RIP wants them');
  assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: false, xmp: false },
    'unmanaged RGB under a CMYK intent cannot claim PDF/X-4');
});

test('a DeviceRGB transparency group blocks the claim', async () => {
  const { PDFName } = await import('pdf-lib') as any;
  const doc = await blankDoc();
  doc.getPage(0).node.set(PDFName.of('Group'), doc.context.obj({ Type: 'Group', S: 'Transparency', CS: 'DeviceRGB' }));
  const { reopened, bytes } = await roundTrip(doc, {}, 'own', { embed: embedFor() });
  assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: false, xmp: false });

  // A CMYK group is fine, and so is a group with no /CS (it inherits the page).
  const ok = await blankDoc();
  ok.getPage(0).node.set(PDFName.of('Group'), ok.context.obj({ Type: 'Group', S: 'Transparency', CS: 'DeviceCMYK' }));
  const second = await roundTrip(ok, {}, 'own', { embed: embedFor() });
  assert.deepEqual(claimOf(second.reopened, second.bytes, PDFName), { info: true, xmp: true });
});

test('a non-embedded font blocks the claim (the standard 14 are no exception)', async () => {
  // pdf-lib's StandardFonts write /Type1 /BaseFont /Helvetica with NO FontDescriptor
  // and no FontFile - which is exactly what drawPrintMarks uses for the provenance
  // labels today. Withholding the claim is the honest interim answer; drawing those
  // labels as paths is the fix, and is deliberately not part of this change.
  const { StandardFonts, PDFName } = await import('pdf-lib') as any;
  const doc = await blankDoc();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.getPage(0).drawText('Made with Lolly', { x: 20, y: 20, size: 8, font });

  const { reopened, bytes } = await roundTrip(doc, {}, 'own', { embed: embedFor() });
  assert.ok(reopened.context.lookup(intentOf(reopened, PDFName)!.dict.get(PDFName.of('DestOutputProfile'))));
  assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: false, xmp: false });
});

test('AES-256 has the last word: intent written, claim withheld', async () => {
  const { PDFName } = await import('pdf-lib') as any;
  const { reopened, bytes } = await roundTrip(
    await blankDoc(), { strongPassword: 'hunter2' }, 'own', { embed: embedFor() },
  );
  const intent = intentOf(reopened, PDFName)!;
  assert.ok(reopened.context.lookup(intent.dict.get(PDFName.of('DestOutputProfile'))),
    'the output intent survives - the caller encrypts after this pass');
  assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: false, xmp: false },
    'PDF/X-4 forbids encryption');
});

test('an unresolvable own profile writes NO intent and no claim', async () => {
  // A stale saved session or a hand-edited URL naming a profile this device cannot
  // use. Falling back to the default condition would re-declare something the user
  // never chose, so nothing is declared at all - and the export still succeeds.
  const logged: string[] = [];
  const { reopened, bytes, PDFName } = await roundTrip(
    await blankDoc(), {}, 'own', { embed: null, log: (_l, m) => logged.push(m) },
  );
  assert.equal(intentOf(reopened, PDFName), null, 'no OutputIntents array at all');
  assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: false, xmp: false });
  assert.equal(logged.length, 1, 'one line, not a lecture');
  assert.match(logged[0]!, /not on this device/);
  // The rest of the metadata set is still written, so the file is still a good PDF.
  assert.ok(reopened.getPage(0).node.get(PDFName.of('TrimBox')));
  assert.ok(reopened.catalog.get(PDFName.of('Metadata')));
});

test("intentKind 'none' / null: metadata only, as before", async () => {
  const { PDFName } = await import('pdf-lib') as any;
  for (const kind of ['none', null] as const) {
    const { reopened, bytes } = await roundTrip(await blankDoc(), {}, kind, {});
    assert.equal(intentOf(reopened, PDFName), null, String(kind));
    assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: false, xmp: false }, String(kind));
  }
});

test('one intent only - a second pass replaces rather than appends', async () => {
  const { PDFName } = await import('pdf-lib') as any;
  const doc = await blankDoc();
  await applyPdfX(doc, {}, 'fogra39', {});
  const { reopened } = await roundTrip(doc, {}, 'own', { embed: embedFor() });
  const intent = intentOf(reopened, PDFName)!;
  assert.equal(intent.count, 1, 'PDF/X allows exactly one GTS_PDFX intent');
  assert.equal(str(intent.dict.get(PDFName.of('OutputConditionIdentifier'))), 'FOGRA51');
});

test('an ordinary jsPDF export still claims PDF/X-4 exactly as it did before', async () => {
  // The non-regression that matters most: the RGB `pdf` path re-saves a jsPDF blob
  // and has always claimed X-4 (sRGB intent, profile embedded). Lolly outlines text
  // to vector paths on export, so a real document selects no font - and the new font
  // check must not take that claim away.
  const lib = await import('pdf-lib') as any;
  const { jsPDF } = await import('jspdf') as any;
  const doc = new jsPDF({ unit: 'pt', format: [200, 200] });
  doc.setFillColor(20, 40, 60);
  doc.rect(10, 10, 120, 60, 'f');
  const loaded = await lib.PDFDocument.load(new Uint8Array(doc.output('arraybuffer')), { updateMetadata: false });

  const { reopened, bytes, PDFName } = await roundTrip(loaded, {}, 'srgb', {});
  assert.equal(str(intentOf(reopened, PDFName)!.dict.get(PDFName.of('OutputConditionIdentifier'))), 'sRGB IEC61966-2.1');
  assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: true, xmp: true });
});

// ─── the individual checks, on documents rather than on specs ─────────────────

test('the document checks answer honestly on a bare document', async () => {
  const lib = await import('pdf-lib') as any;
  const doc = await blankDoc();
  assert.equal(hasDeviceRgbImage(doc, lib.PDFName), false);
  assert.equal(groupCsOk(doc, lib.PDFName), true);
  assert.equal(usedFontsEmbedded(doc, lib), true, 'no fonts at all is vacuously fine');
});

test('usedFontsEmbedded: a declared-but-unused standard font is not a violation', async () => {
  // The reason the check reads Tf operators rather than resource dicts. jsPDF
  // declares ALL FOURTEEN standard fonts in every page's /Resources - verified: 14
  // /Font dicts, none with a FontDescriptor, on a document containing one word - so
  // judging resources would withhold the claim from every Lolly PDF ever exported,
  // including the ones that are conformant because their text was outlined to paths.
  const lib = await import('pdf-lib') as any;
  const { jsPDF } = await import('jspdf') as any;

  const outlined = new jsPDF({ unit: 'pt', format: [200, 200] });
  outlined.setFillColor(0, 0, 0);
  outlined.rect(10, 10, 50, 20, 'f');                 // shapes only: no Tf anywhere
  const clean = await lib.PDFDocument.load(new Uint8Array(outlined.output('arraybuffer')), { updateMetadata: false });
  const declared = clean.getPage(0).node.Resources().lookup(lib.PDFName.of('Font'), lib.PDFDict);
  assert.ok(declared.keys().length >= 14, 'jsPDF really does declare the standard fonts unused');
  assert.equal(usedFontsEmbedded(clean, lib), true, 'declared but never selected - nothing to embed');

  // The same document with real text in a standard face DOES select one.
  const withText = new jsPDF({ unit: 'pt', format: [200, 200] });
  withText.text('hi', 10, 10);
  const dirty = await lib.PDFDocument.load(new Uint8Array(withText.output('arraybuffer')), { updateMetadata: false });
  assert.equal(usedFontsEmbedded(dirty, lib), false, 'a Tf on a non-embedded face is a violation');
});

test('usedFontsEmbedded: a real embedded face passes where Helvetica fails', async () => {
  const lib = await import('pdf-lib') as any;
  const { PDFName, PDFDocument } = lib;
  // A CIDFontType2 descendant with a FontFile2 - the shape an embedded TrueType
  // takes, and what the walker has to recognise through a /Type0 parent.
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  const file = doc.context.register(doc.context.flateStream(Uint8Array.from([0, 1, 0, 0])));
  const descriptor = doc.context.register(doc.context.obj({ Type: 'FontDescriptor', FontName: 'Fixture', FontFile2: file }));
  const cid = doc.context.register(doc.context.obj({
    Type: 'Font', Subtype: 'CIDFontType2', BaseFont: 'Fixture', FontDescriptor: descriptor,
  }));
  const type0 = doc.context.register(doc.context.obj({
    Type: 'Font', Subtype: 'Type0', BaseFont: 'Fixture', Encoding: 'Identity-H',
    DescendantFonts: [cid],
  }));
  // Selected by the content, so it is a font the file has to embed.
  page.node.setFontDictionary?.(doc.context.obj({ Fx: type0 }));
  const res = page.node.Resources();
  res.set(PDFName.of('Font'), doc.context.obj({ Fx: type0 }));
  page.node.set(PDFName.of('Contents'), doc.context.register(
    doc.context.stream(new TextEncoder().encode('BT /Fx 12 Tf 10 10 Td (hi) Tj ET')),
  ));
  assert.equal(usedFontsEmbedded(doc, lib), true);

  // Strip the file and the same graph must fail - the check reads /FontFile*, not
  // the presence of a descriptor.
  doc.context.lookup(descriptor).delete(PDFName.of('FontFile2'));
  assert.equal(usedFontsEmbedded(doc, lib), false);
});

// ─── the third face of the colour-consistency rule: shadings ──────────────────

test('a DeviceRGB shading blocks the claim EVEN WITH a profile embedded', async () => {
  // The vector form of a CSS gradient, built through the REAL export path: an opaque
  // linear-gradient becomes a jsPDF ShadingPattern whose /ColorSpace is /DeviceRGB.
  // It is a bare dict, not a content stream, so renderCmykPdf's rg/RG substitution
  // never converts it - and neither of the other two checks can see it, which is the
  // whole reason this one exists.
  const lib = await import('pdf-lib') as any;
  const { jsPDF } = await import('jspdf') as any;
  const { pdfGradientSpec, fillPdfShading } = await import('./export-pdf-vector.ts');

  const pdf = new jsPDF({ unit: 'pt', format: [200, 200] });
  const spec = pdfGradientSpec('linear-gradient(90deg, rgb(255,0,0), rgb(0,0,255))', 0, 0, 200, 200)!;
  assert.equal(spec.hasAlpha, false, 'an opaque gradient takes the true-vector path');
  assert.equal(fillPdfShading(pdf, spec, () => { pdf.rect(0, 0, 200, 200); }), true);
  const doc = await lib.PDFDocument.load(new Uint8Array(pdf.output('arraybuffer')), { updateMetadata: false });

  assert.equal(hasDeviceRgbImage(doc, lib.PDFName), false, 'no image XObject - the old veto is blind here');
  assert.equal(groupCsOk(doc, lib.PDFName), true, 'and so is the group check');
  assert.equal(shadingCsOk(doc, lib.PDFName), false, 'the shading itself is /DeviceRGB');

  const logged: string[] = [];
  const { reopened, bytes, PDFName } = await roundTrip(
    doc, {}, 'own', { embed: embedFor(), log: (_l, m) => logged.push(m) },
  );
  const intent = intentOf(reopened, PDFName)!;
  assert.ok(reopened.context.lookup(intent.dict.get(PDFName.of('DestOutputProfile'))),
    'the intent and its profile are still written - a RIP wants them');
  assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: false, xmp: false },
    'unmanaged RGB in a shading cannot claim PDF/X-4 either');
  assert.equal(logged.length, 1, 'one line, and it is the colour-consistency one');
  assert.match(logged[0]!, /unmanaged RGB/);

  // The same shading under the sRGB intent is not a violation at all.
  const rgbDoc = await lib.PDFDocument.load(new Uint8Array(pdf.output('arraybuffer')), { updateMetadata: false });
  const srgb = await roundTrip(rgbDoc, {}, 'srgb', {});
  assert.deepEqual(claimOf(srgb.reopened, srgb.bytes, PDFName), { info: true, xmp: true });
});

test('shadingCsOk: a CMYK shading passes, in a resource dict as well as standing alone', async () => {
  const lib = await import('pdf-lib') as any;
  const { PDFName } = lib;
  const shading = (cs: string) => ({ ShadingType: 2, ColorSpace: cs, Coords: [0, 0, 1, 0] });

  const good = await blankDoc();
  good.context.register(good.context.obj(shading('DeviceCMYK')));
  good.getPage(0).node.Resources().set(PDFName.of('Shading'), good.context.obj({ Sh0: shading('DeviceCMYK') }));
  assert.equal(shadingCsOk(good, PDFName), true);
  const claimed = await roundTrip(good, {}, 'own', { embed: embedFor() });
  assert.deepEqual(claimOf(claimed.reopened, claimed.bytes, PDFName), { info: true, xmp: true });

  // A DeviceRGB shading reached only through a page's /Shading resource dict.
  const viaResources = await blankDoc();
  viaResources.getPage(0).node.Resources().set(PDFName.of('Shading'), viaResources.context.obj({ Sh0: shading('DeviceRGB') }));
  assert.equal(shadingCsOk(viaResources, PDFName), false);

  // …and one reached through a /Pattern resource dict, which is how a fill uses it.
  const viaPattern = await blankDoc();
  const sh = viaPattern.context.register(viaPattern.context.obj(shading('DeviceRGB')));
  viaPattern.getPage(0).node.Resources().set(PDFName.of('Pattern'), viaPattern.context.obj({
    P0: { Type: 'Pattern', PatternType: 2, Shading: sh },
  }));
  assert.equal(shadingCsOk(viaPattern, PDFName), false);
});

// ─── untrusted ICC text in a PDF literal string ───────────────────────────────

test('a profile description with parens, backslashes or non-ASCII still produces a readable file', async () => {
  // The desc and the filename come out of a file the user loaded, and pdf-lib's
  // PDFString escapes nothing - an unbalanced paren used to terminate the literal
  // early and leave the catalog unparseable, and a byte over 0x7f used to be
  // truncated into a control character inside a value of record.
  const lib = await import('pdf-lib') as any;
  const { PDFName } = lib;
  const descs = [
    'Coated (FOGRA39) v2',
    'Coated :) v2',
    'Smile ) here',
    'ok(unbalanced',
    String.raw`C:\color\coated`,
    'Bogen gestrichen - Papiertyp 1 ü',
    '日本 コート紙',
  ];
  for (const desc of descs) {
    const { reopened, bytes } = await roundTrip(
      await blankDoc(), {}, 'own', { embed: { ...embedFor({ paired: false }), info: desc, desc } },
    );
    const intent = intentOf(reopened, PDFName);
    assert.ok(intent?.dict, `${desc}: the reopened catalog must still have its OutputIntents`);
    assert.equal(intent.dict.get(PDFName.of('OutputCondition')).decodeText(), desc,
      `${desc}: the description must round-trip exactly, not approximately`);
    assert.equal(intent.dict.get(PDFName.of('Info')).decodeText(), desc);
    assert.ok(reopened.context.lookup(intent.dict.get(PDFName.of('DestOutputProfile'))),
      `${desc}: and the profile after it must still parse as a stream`);
    assert.deepEqual(claimOf(reopened, bytes, PDFName), { info: true, xmp: true },
      `${desc}: an awkward name is not a conformance problem`);
  }
});
