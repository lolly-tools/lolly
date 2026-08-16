// SPDX-License-Identifier: MPL-2.0
/**
 * The soft-mask backdrop (/BC) and its colour space - shells/web/src/lib/pdf-objects.ts
 * (`groupColorSpace`, `backdropLuminosity`), plus the engine-level consequence of
 * getting the sign wrong.
 *
 * WHY this suite exists. PDF 32000-1 §11.6.5.2 composites a /Luminosity mask group
 * against a full-plane backdrop of /BC and takes the LUMINOSITY of the result: a black
 * backdrop (the default when /BC is absent) hides everything outside the group's /BBox,
 * a white one reveals it. /BC's components are in the GROUP's colour space, so the same
 * array means opposite things in an additive and a subtractive space - DeviceCMYK
 * `[0 0 0 0]` is WHITE, DeviceRGB `[0 0 0]` is BLACK.
 *
 * The import path used to reduce /BC to `Math.max(|component|)` and never read the
 * group's /Group /CS at all, so a CMYK white backdrop scored 0 = "black" and the mask
 * was applied: artwork outside a 100×100 bbox vanished from a 300×200 fill. That is the
 * UNSAFE direction, and it lands precisely on Illustrator/InDesign print PDFs, the only
 * producers that use CMYK group spaces (Chromium's print path never writes /BC at all,
 * which is why no audit fixture moves).
 *
 * Run with: node --test tests/pdf-smask-backdrop.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PDFArray, PDFContext, PDFDict, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import type { PDFObject } from 'pdf-lib';

import {
  backdropLuminosity, groupColorSpace, softMaskId, type SoftMaskIdRegistry,
} from '../shells/web/src/lib/pdf-objects.ts';
import { interpretPdfPage } from '../engine/src/pdf-map.ts';
import type { PdfNode, PdfSoftMaskDef } from '../engine/src/pdf-map.ts';

// ── in-memory PDF object builders (same shape a loaded document produces) ─────

const ctx = (): PDFContext => PDFContext.create();
const num = (v: number): PDFNumber => PDFNumber.of(v);
const name = (s: string): PDFName => PDFName.of(s);
const arr = (c: PDFContext, vals: PDFObject[]): PDFArray => {
  const a = PDFArray.withContext(c);
  for (const v of vals) a.push(v);
  return a;
};
const dict = (c: PDFContext, entries: Record<string, PDFObject>): PDFDict => {
  const d = PDFDict.withContext(c);
  for (const [k, v] of Object.entries(entries)) d.set(name(k), v);
  return d;
};
/** A transparency-group form XObject (a soft mask's /G) with the given /Group /CS. */
const groupForm = (c: PDFContext, cs?: PDFObject, resources?: PDFObject): PDFRawStream => {
  const group: Record<string, PDFObject> = { S: name('Transparency') };
  if (cs) group.CS = cs;
  const d: Record<string, PDFObject> = { Subtype: name('Form'), Group: dict(c, group) };
  if (resources) d.Resources = resources;
  return PDFRawStream.of(dict(c, d), new TextEncoder().encode('0 0 100 100 re f'));
};

// ── groupColorSpace: /G → /Group /CS ─────────────────────────────────────────

test('groupColorSpace: inline device names', () => {
  const c = ctx();
  for (const n of ['DeviceRGB', 'DeviceCMYK', 'DeviceGray']) {
    assert.equal(groupColorSpace(c, groupForm(c, name(n))), n);
  }
});

test('groupColorSpace: CIE spaces arrive as arrays and keep their head name', () => {
  const c = ctx();
  assert.equal(groupColorSpace(c, groupForm(c, arr(c, [name('CalRGB'), dict(c, {})]))), 'CalRGB');
  assert.equal(groupColorSpace(c, groupForm(c, arr(c, [name('Lab'), dict(c, {})]))), 'Lab');
});

test('groupColorSpace: ICCBased resolves to a device space by /N', () => {
  const c = ctx();
  const icc = (n: number): PDFArray =>
    arr(c, [name('ICCBased'), PDFRawStream.of(dict(c, { N: num(n) }), new Uint8Array())]);
  assert.equal(groupColorSpace(c, groupForm(c, icc(4))), 'DeviceCMYK');
  assert.equal(groupColorSpace(c, groupForm(c, icc(3))), 'DeviceRGB');
  assert.equal(groupColorSpace(c, groupForm(c, icc(1))), 'DeviceGray');
});

test('groupColorSpace: a bare non-device name resolves through the form’s own /Resources', () => {
  // §8.6.3 - Illustrator writes `/CS /CS0` and defines CS0 in the form's resources.
  const c = ctx();
  const res = dict(c, {
    ColorSpace: dict(c, {
      CS0: arr(c, [name('ICCBased'), PDFRawStream.of(dict(c, { N: num(4) }), new Uint8Array())]),
    }),
  });
  assert.equal(groupColorSpace(c, groupForm(c, name('CS0'), res)), 'DeviceCMYK');
  // Unresolvable name → null, so the caller refuses instead of guessing.
  assert.equal(groupColorSpace(c, groupForm(c, name('CS9'), res)), null);
  assert.equal(groupColorSpace(c, groupForm(c, name('CS0'))), null);
});

test('groupColorSpace: absent /Group or /CS is null, never a throw', () => {
  const c = ctx();
  assert.equal(groupColorSpace(c, groupForm(c)), null);
  assert.equal(groupColorSpace(c, PDFRawStream.of(dict(c, {}), new Uint8Array())), null);
  assert.equal(groupColorSpace(c, undefined), null);
  assert.equal(groupColorSpace(c, num(7)), null);
});

// ── backdropLuminosity: the sign of /BC ──────────────────────────────────────

test('DeviceCMYK is SUBTRACTIVE: all-zero is white (reveal), not black', () => {
  // THE defect. The old reduction scored this 0 = black = "safe to apply the mask",
  // which hides every part of the masked paint that falls outside the group /BBox.
  assert.equal(backdropLuminosity('DeviceCMYK', [0, 0, 0, 0]), 1);
  // …and the converse: CMYK black really is black, so the mask can be evaluated.
  assert.equal(backdropLuminosity('DeviceCMYK', [0, 0, 0, 1]), 0);
  // Rich black via the process inks alone.
  assert.equal(backdropLuminosity('DeviceCMYK', [1, 1, 1, 0]), 0);
  // A mid grey lands between, and out-of-range components clamp (§10.4.2.1's
  // R = 1 − min(1, C + K) is a clamp by construction).
  const mid = backdropLuminosity('DeviceCMYK', [0, 0, 0, 0.5]);
  assert.ok(mid !== null && Math.abs(mid - 0.5) < 1e-9, String(mid));
  assert.equal(backdropLuminosity('DeviceCMYK', [0, 0, 0, 4]), 0);
  assert.equal(backdropLuminosity('DeviceCMYK', [-3, -3, -3, -3]), 1);
});

test('additive spaces: all-zero is black (the expressible default)', () => {
  assert.equal(backdropLuminosity('DeviceRGB', [0, 0, 0]), 0);
  assert.equal(backdropLuminosity('CalRGB', [0, 0, 0]), 0);
  assert.equal(backdropLuminosity('DeviceGray', [0]), 0);
  assert.equal(backdropLuminosity('CalGray', [0]), 0);
  assert.equal(backdropLuminosity('Lab', [0, 0, 0]), 0);
  // …and white is white.
  assert.equal(backdropLuminosity('DeviceRGB', [1, 1, 1]), 1);
  assert.equal(backdropLuminosity('DeviceGray', [1]), 1);
  assert.equal(backdropLuminosity('Lab', [100, -20, 40]), 1);
});

test('additive: §11.6.5.2’s own luma weights, not a max-magnitude', () => {
  // Pure blue is DARK (0.11), which `Math.max(|v|)` scored as a fully white backdrop.
  const blue = backdropLuminosity('DeviceRGB', [0, 0, 1]);
  assert.ok(blue !== null && Math.abs(blue - 0.11) < 1e-9, String(blue));
  const green = backdropLuminosity('DeviceRGB', [0, 1, 0]);
  assert.ok(green !== null && Math.abs(green - 0.59) < 1e-9, String(green));
  const gray = backdropLuminosity('DeviceGray', [0.25]);
  assert.ok(gray !== null && Math.abs(gray - 0.25) < 1e-9, String(gray));
});

test('unconvertible or malformed → null, i.e. refuse the mask (the safe direction)', () => {
  for (const cs of [null, 'Separation', 'DeviceN', 'Indexed', 'Pattern', 'DeviceGrey', '']) {
    assert.equal(backdropLuminosity(cs, [0, 0, 0, 0]), null, String(cs));
  }
  // Component count must agree with the space (Table 144: n = the CS's component count).
  assert.equal(backdropLuminosity('DeviceRGB', [0, 0]), null);
  assert.equal(backdropLuminosity('DeviceRGB', [0, 0, 0, 0]), null);
  assert.equal(backdropLuminosity('DeviceCMYK', [0, 0, 0]), null);
  assert.equal(backdropLuminosity('DeviceGray', []), null);
  // Hostile numbers never propagate into the engine's `> 0.004` comparison.
  assert.equal(backdropLuminosity('DeviceRGB', [NaN, 0, 0]), null);
  assert.equal(backdropLuminosity('DeviceGray', [Infinity]), null);
});

// ── softMaskId: the mask, not the group, is the unit of identity ─────────────

const reg = (): SoftMaskIdRegistry => ({ groups: new Map(), ids: new Map() });

test('softMaskId: one /G shared by an /Alpha and a /Luminosity mask → TWO ids', () => {
  // The collision. Keyed on /G alone both dicts were `sm0`, and the engine's
  // (id, base transform) memo then handed the second the first's evaluation - the
  // /Alpha mask silently rendering with luminance semantics and no mask-type="alpha".
  const r = reg();
  const g = { blurGroup: true };
  const lum = softMaskId(r, g, 'Luminosity', false);
  const alpha = softMaskId(r, g, 'Alpha', false);
  assert.notEqual(lum, alpha);
  // …and each is stable on re-lookup.
  assert.equal(softMaskId(r, g, 'Luminosity', false), lum);
  assert.equal(softMaskId(r, g, 'Alpha', false), alpha);
});

test('softMaskId: /TR and /BC also distinguish two dicts over one group', () => {
  const r = reg();
  const g = {};
  const plain = softMaskId(r, g, 'Luminosity', false);
  assert.notEqual(softMaskId(r, g, 'Luminosity', true), plain);
  assert.notEqual(softMaskId(r, g, 'Luminosity', false, 1), plain);
  assert.notEqual(softMaskId(r, g, 'Luminosity', false, 1), softMaskId(r, g, 'Luminosity', false, 0));
  // An explicit black /BC and an absent one render identically but are still distinct
  // entries - cheap, and it keeps the key a pure function of the dict.
  assert.equal(softMaskId(r, g, 'Luminosity', false, 0.5), softMaskId(r, g, 'Luminosity', false, 0.50001));
});

test('softMaskId: identical dicts over one group collapse to ONE id', () => {
  // Chromium names the same shadow ExtGState dozens of times per page; each extra id
  // would be another full <mask> def (and another copy of its blur raster) in the SVG.
  const r = reg();
  const g = {};
  for (let i = 0; i < 50; i++) assert.equal(softMaskId(r, g, 'Luminosity', false), 'sm0');
  assert.equal(r.ids.size, 1);
  // Distinct groups never share.
  assert.notEqual(softMaskId(r, {}, 'Luminosity', false), 'sm0');
});

// ── the consequence, through the real interpreter ────────────────────────────
//
// A 300×200 fill masked by a group whose /BBox is only 100×100. With a black backdrop
// the mask is honoured and two thirds of the fill are correctly hidden; with a white
// backdrop the mask must be REFUSED, because a userSpaceOnUse <mask> cannot express a
// region that reveals out to infinity - and the fallback (no mask) keeps the artwork.

const MASK_GROUP = {
  subtype: 'Luminosity' as const,
  // A raster, so the group is not foldable to a constant and a real <mask> is emitted.
  content: 'q 100 0 0 100 0 0 cm /X4 Do Q',
  resources: { xobjects: { X4: { kind: 'image' as const, imageKey: 'm0' } } },
  bbox: [0, 0, 100, 100],
};
const PAGE = 'q 1 0 0 rg /G7 gs 0 0 300 200 re f Q';

function runPage(def: PdfSoftMaskDef): { nodes: PdfNode[]; warns: string[] } {
  const warns: string[] = [];
  const nodes = interpretPdfPage({
    content: PAGE, width: 300, height: 200,
    extgstates: { G7: { smask: def } },
    onWarn: (code, detail) => warns.push(detail ? `${code}|${detail}` : code),
  });
  return { nodes, warns };
}

test('backdrop 0 (black) → the mask is applied and clips the fill to the bbox', () => {
  const { nodes, warns } = runPage({ id: 'sm0', ...MASK_GROUP, backdrop: 0 });
  assert.ok(warns.includes('smask.group.applied|sm0'), warns.join(','));
  const m = nodes[0]?._softMask;
  assert.ok(m, 'mask reached the node');
  assert.equal(Math.round(m.w), 100);
  assert.equal(Math.round(m.h), 100);
});

test('backdrop 1 (white) → refused, and the 300×200 fill survives unmasked', () => {
  // This is what a DeviceCMYK `/BC [0 0 0 0]` must now produce. Before the colour
  // space was read it produced backdrop 0 - the case above - and the fill was hidden
  // everywhere outside a 100×100 box.
  const { nodes, warns } = runPage({ id: 'sm0', ...MASK_GROUP, backdrop: 1 });
  assert.ok(warns.includes('smask.group.unevaluated|bc'), warns.join(','));
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]!._softMask, undefined);
  assert.ok(Math.round(nodes[0]!.w) === 300 && Math.round(nodes[0]!.h) === 200, JSON.stringify(nodes[0]));
});
