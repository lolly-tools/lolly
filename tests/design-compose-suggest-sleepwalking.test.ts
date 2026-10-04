// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 291 W6 acceptance for `lolly compose --suggest` on the Sleepwalking source deck
 * (private, gated).
 *
 * The source deck is an internal talk, so its path comes from the environment
 * (LOLLY_SUGGEST_SLEEPWALKING: the source .pptx), and the SUSE master from the suse
 * profile, so the brand must be checked out too. Read through `readContentInventory`
 * (its source and census, so the structure matcher runs), the suggestion must set the
 * cover and the closing over their full-bleed photographs, keep the two photo
 * statements full image, and turn the numbered question cards into a stacked list.
 * The suggestion must then compose with the SUSE master and leave no source string out.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import test from 'node:test';

import type { DesignComposeSpecV1 } from '../packages/core/src/index.ts';
import { suggestComposeSlides } from '../engine/src/design-compose-suggest.ts';
import { composeDesignSlides } from '../engine/src/design-compose.ts';
import { createTokenSet } from '../engine/src/index.ts';
import { readContentInventory } from '../packages/node-shell/src/content-inventory.ts';
import { readProfileBriefCatalog, readProfileTokenDocument } from '../packages/node-shell/src/design-brief.ts';

type Row = Record<string, unknown>;

const DECK = (process.env.LOLLY_SUGGEST_SLEEPWALKING ?? '').trim();
const PROFILE = 'suse';

const haveBrand = (): boolean => {
  try {
    return readProfileTokenDocument({ profile: PROFILE }) !== null && !!readProfileBriefCatalog({ profile: PROFILE })?.master;
  } catch {
    return false;
  }
};
const skip = !DECK || !existsSync(DECK)
  ? 'the private Sleepwalking source deck is not on this machine (set LOLLY_SUGGEST_SLEEPWALKING)'
  : haveBrand() ? false : 'brands/suse is not checked out, so the suse profile cannot be resolved here';

const STACKED = /^(?:flow-columns-\d+-1|numbered-rows|agenda)$/;

test('the Sleepwalking suggestion sets covers over their photographs, its statements over theirs, and the question cards as columns', { skip }, async () => {
  const master = readProfileBriefCatalog({ profile: PROFILE })!.master!;
  const read = await readContentInventory({ bytes: new Uint8Array(readFileSync(DECK)), name: basename(DECK) });
  const { spec, assets } = suggestComposeSlides({ inventory: read.inventory, source: read.source, census: read.census }, master);
  const at = (n: number) => spec.slides[n - 1]!;
  const photoKey = (n: number): string | undefined => {
    const photo = read.inventory.slides[n - 1]!.pictures.filter((p) => p.kind === 'photo').sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)[0];
    return photo ? `photo:${photo.sha256.slice(0, 12)}` : undefined;
  };

  assert.equal(at(1).archetype, 'title', 'slide 1 is the cover');
  assert.equal((at(1).slots?.title as Row | undefined)?.join, ': ', 'the cover heading\'s short first line is joined to the question, not set as an eyebrow');
  assert.equal((at(1).under?.[0] as Row | undefined)?.image, photoKey(1), 'over its photograph');
  assert.equal(at(16).archetype, 'closing-thanks', 'slide 16 is the closing');
  assert.equal((at(16).under?.[0] as Row | undefined)?.image, photoKey(16), 'over its photograph');
  // Plan 291 M4: a short line set large over a full-bleed photo is a statement over the photo.
  for (const n of [5, 6]) {
    assert.equal(at(n).archetype, 'main-point', `slide ${n} is a statement over its photograph`);
    assert.equal((at(n).under?.[0] as Row | undefined)?.image, photoKey(n));
  }
  // The counted question cards stay a row of columns, the counters left out.
  assert.equal(at(2).archetype, 'columns-3', 'slide 2 is three columns, not numbered cards');
  assert.ok(!STACKED.test(at(15).archetype), 'slide 15 is no numbered list either');
  // The cover's role line joins the name in the subtitle; the closing heading splits by size.
  assert.equal(Array.isArray((at(1).slots?.subtitle as Row | undefined)?.from), true);
  assert.equal(at(1).over, undefined);
  assert.equal((at(16).slots?.title as Row | undefined)?.para, 0);
  assert.deepEqual((at(16).slots?.subtitle as Row | undefined)?.para, [1, 2]);
  for (const s of spec.slides) assert.equal(typeof s.source, 'number');
  const keys = new Set(assets.map((a) => a.key));
  for (const n of [1, 5, 6, 16]) assert.ok(keys.has(photoKey(n)!), `slide ${n}'s photograph is in the asset list`);

  const tokens = readProfileTokenDocument({ profile: PROFILE })!;
  const resolve = createTokenSet(tokens.doc as never, { theme: 'light' }).resolve as (path: string) => string | undefined;
  const composed = composeDesignSlides(spec as DesignComposeSpecV1, { master, masterOrigin: 'catalog', resolveToken: resolve, inventory: read.inventory });
  assert.equal(composed.report.slides.length, 16);
  // Only the decorative counters of slides 2, 9 and 15 are left out (one edit per string), each declared as such.
  assert.deepEqual(composed.edits.map((e) => e.source).sort(), ['01', '02', '03', '04'], 'no other source string is changed or left out');
  for (const e of composed.edits) assert.match(e.reason, /Decorative numbering/);
});

test('the Sleepwalking 2x2 grid numbered 01 to 04 drops its counters, and the closing subtitle fits its slot', { skip }, async () => {
  const master = readProfileBriefCatalog({ profile: PROFILE })!.master!;
  const bytes = new Uint8Array(readFileSync(DECK));
  const read = await readContentInventory({ bytes, name: basename(DECK) });
  const { spec, reasons } = suggestComposeSlides({ inventory: read.inventory, source: read.source, census: read.census }, master);
  // Slide 9 ("Four Tests of Real Control"): a grid whose cells open 01 to 04 in reading order.
  const s9 = spec.slides[8]!;
  const plainOf = (id: unknown): string => read.inventory.slides[8]!.text.find((t) => t.objectId === id)?.plain.trim() ?? '';
  assert.match(s9.archetype, /grid/);
  const labels = (s9.cells ?? []).map((c) => plainOf((c.label as Row | undefined)?.from));
  assert.equal(labels.length, 4);
  for (const label of labels) assert.doesNotMatch(label, /^0?\d[.)]?$/, `a cell label is the cell's heading, not its counter (${JSON.stringify(labels)})`);
  assert.match(reasons[8]!.why, /decorative numbering/);
  // Slide 16: the offer under the closing question is one sentence broken by hand over
  // three lines; the two-line subtitle runs it into one line rather than clip the third.
  const subtitle = spec.slides[15]!.slots?.subtitle as Row | undefined;
  assert.deepEqual(subtitle?.para, [1, 2]);
  assert.equal(subtitle?.join, ' ');
  // Measured with the SUSE faces, as lolly compose does: nothing on slides 9 or 16 clips.
  process.env.LOLLY_PROFILE = PROFILE;
  const { composeDesign } = await import('../packages/node-shell/src/design-compose.ts');
  const composed = await composeDesign({ slides: [spec.slides[8], spec.slides[15]] }, { inventory: read.inventory });
  const clipped = composed.report.slides.flatMap((s) => (s.fit ?? []).filter((f) => f.overflow).map((f) => f.layerId));
  assert.deepEqual(clipped, [], `no slot clips: ${clipped.join(', ')}`);
  const rows = composed.document.boxes as Row[];
  assert.equal(rows.find((r) => r.id === 's16.subtitle')?.text, 'SUSE Offers AI for Infrastructure and Infrastructure for AI');
  assert.ok(!composed.report.notes.some((n) => n.code === 'compose.fit.unmeasured'), 'every slot was measured');
});
