// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-cuts tests - the contact sheet's DECISION surface (phase 2.5, section 4.6).
 *
 * WHAT THIS TIER CAN PROVE, and does:
 *   • midpoint sampling - `t_i = totalMs * (i + 0.5) / n`, strictly inside the
 *     sequence, never an endpoint (the whole point of the sampling rule);
 *   • N clamping at the BRIDGE, over hostile input, not just the engine's URL parse;
 *   • member naming + zero padding, i.e. that a downloaded sheet sorts into
 *     timeline order in a file manager;
 *   • the dispatch decision (`wantsCuts`): still-format ∧ sequence ∧ N > 1;
 *   • that the loop really moves the DOM playhead between renders, renders exactly
 *     N times, strips `cuts` from the member opts so a member cannot recurse, and
 *     RESTORES the artboard in a `finally` - including when a render throws;
 *   • that pdf takes the ONE-document-N-pages route and raster/svg the zip route.
 *
 * WHAT IT CANNOT, stated plainly rather than mocked into a false green: no pixel in
 * this file is real. jsdom has no layout, no rasteriser, no jsPDF canvas - so
 * "cut 4 actually SHOWS the boxes that are live at 4.5s" is a browser assertion and
 * lives in `tests/sequence-render.browser.test.ts` (case 10), gated on a real
 * Chromium exactly like the rest of that suite. The renderers here are injected
 * fakes; what is under test is the loop that drives them, not what they draw.
 *
 * Run directly:  node --test shells/web/src/bridge/sequence-cuts.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>');
// Node's own Blob is left in place - jsdom's has no `arrayBuffer()`, and the
// module reads member bytes through it.
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const {
  cutTimestamps, cutCount, cutMemberName, wantsCuts, renderSequenceCuts, MAX_CUTS, CUTS_FORMATS,
} = await import('./sequence-cuts.ts');
const { OFF_CLASS } = await import('./sequence-dom.ts');
type Opts = Parameters<typeof renderSequenceCuts>[2];

// ── fixtures ────────────────────────────────────────────────────────────────

/** A three-clip row over 3000ms, the shape sequence-studio's hook stamps. */
function stage(seqMs = 3000): HTMLElement {
  const root = dom.window.document.createElement('div');
  root.innerHTML = `
    <div class="artboard" data-sequence data-seq-ms="${seqMs}">
      <div class="lolly-box" data-box-id="a" data-t-start="0" data-t-dur="1000"
           data-t-lane="seq" style="left:0px;top:0px;width:100px;height:50px"></div>
      <div class="lolly-box" data-box-id="b" data-t-start="1000" data-t-dur="1000"
           data-t-lane="seq" style="left:0px;top:0px;width:100px;height:50px"></div>
      <div class="lolly-box" data-box-id="c" data-t-start="2000" data-t-dur="1000"
           data-t-lane="seq" style="left:0px;top:0px;width:100px;height:50px"></div>
    </div>`;
  return root;
}

/** Which box ids are ON SCREEN right now (the applier's only visible output). */
const live = (root: HTMLElement): string[] =>
  [...root.querySelectorAll<HTMLElement>('.lolly-box')]
    .filter((el) => !el.classList.contains(OFF_CLASS))
    .map((el) => el.getAttribute('data-box-id') as string);

interface Recorded {
  stills: { format: string; cuts: unknown; live: string[] }[];
  pages: number;
  pageLive: string[][];
  zipped: string[];
  pdfCalls: number;
}

function deps(root: HTMLElement, opts: { failOn?: number } = {}) {
  const rec: Recorded = { stills: [], pages: 0, pageLive: [], zipped: [], pdfCalls: 0 };
  return {
    rec,
    d: {
      async renderStill(_n: Element, format: string, o: Opts): Promise<Blob> {
        if (rec.stills.length === opts.failOn) throw new Error('rasteriser exploded');
        rec.stills.push({ format, cuts: o.cuts, live: live(root) });
        return new Blob([new Uint8Array([1, 2, 3])]) as unknown as Blob;
      },
      async renderPdfPages(pages: Element[], _o: Opts, prepare: (i: number) => void): Promise<Blob> {
        rec.pdfCalls++;
        rec.pages = pages.length;
        for (let i = 0; i < pages.length; i++) { prepare(i); rec.pageLive.push(live(root)); }
        return new Blob([new Uint8Array([37, 80, 68, 70])]) as unknown as Blob;
      },
      async packZip(members: { name: string; bytes: Uint8Array }[]): Promise<Blob> {
        rec.zipped = members.map((m) => m.name);
        return new Blob([new Uint8Array([80, 75])], { type: 'application/zip' }) as unknown as Blob;
      },
    },
  };
}

// ── the pure surface ────────────────────────────────────────────────────────

test('cutTimestamps samples MIDPOINTS, never the endpoints', () => {
  assert.deepEqual(cutTimestamps(3000, 6), [250, 750, 1250, 1750, 2250, 2750]);
  // A single cut is the middle of the sequence, not t=0 - the pure helper answers
  // "where would cut 1 of 1 be"; the exporter never calls it for the cuts=1 path,
  // which stays the untouched playhead render.
  assert.deepEqual(cutTimestamps(1000, 1), [500]);
  const t = cutTimestamps(4000, 8);
  assert.ok(t.every((v) => v > 0 && v < 4000), 'every sample is strictly inside the sequence');
  assert.ok(t.every((v, i) => i === 0 || v > (t[i - 1] as number)), 'strictly increasing');
  // Symmetric about the middle: t_i + t_(n-1-i) === totalMs, for every i.
  for (let i = 0; i < t.length; i++) {
    assert.equal((t[i] as number) + (t[t.length - 1 - i] as number), 4000);
  }
  // Endpoint sampling would have produced 0 and totalMs - the blank-card frames.
  assert.ok(!t.includes(0) && !t.includes(4000));
});

test('cutTimestamps degrades instead of throwing on a junk duration', () => {
  assert.deepEqual(cutTimestamps(0, 3), [0, 0, 0]);
  assert.deepEqual(cutTimestamps(Number.NaN, 2), [0, 0]);
  assert.deepEqual(cutTimestamps(-5, 2), [0, 0]);
  assert.equal(cutTimestamps(1000, 0).length, 1, 'a junk N still yields the single playhead cut');
});

test('cutCount clamps at the bridge, over anything a caller can pass', () => {
  for (const junk of [undefined, null, '', ' ', 'six', {}, [], Number.NaN, Infinity, -Infinity, 0, -4, 0.5]) {
    assert.equal(cutCount(junk), 1, `junk ${JSON.stringify(junk)} degrades to the playhead frame`);
  }
  assert.equal(cutCount(6), 6);
  assert.equal(cutCount('6'), 6, 'a numeric string (a raw URL param) is accepted');
  assert.equal(cutCount(6.9), 6, 'a fraction truncates');
  assert.equal(cutCount(1e9), MAX_CUTS, 'a hostile count clamps rather than falling back');
  assert.equal(cutCount(MAX_CUTS + 1), MAX_CUTS);
});

test('member names zero-pad so the sheet sorts into timeline order', () => {
  assert.equal(cutMemberName('poster.png', 'png', 0, 6), 'poster-01.png');
  assert.equal(cutMemberName('poster', 'png', 5, 6), 'poster-06.png');
  assert.equal(cutMemberName('poster', 'jpeg', 0, 6), 'poster-01.jpg', 'the jpeg token writes a .jpg file');
  assert.equal(cutMemberName('poster', 'svg', 11, 12), 'poster-12.svg');
  assert.equal(cutMemberName('', 'png', 0, 2), 'export-01.png');
  // The padding is wide enough for N, and lexicographic order === numeric order.
  const names = Array.from({ length: 12 }, (_, i) => cutMemberName('p', 'png', i, 12));
  assert.deepEqual([...names].sort(), names, '12 members still sort correctly as strings');
});

test('wantsCuts is the exact dispatch decision', () => {
  assert.equal(wantsCuts('png', 6, true), true);
  assert.equal(wantsCuts('pdf', 6, true), true);
  assert.equal(wantsCuts('png', 1, true), false, 'cuts=1 is the untouched single-still path');
  assert.equal(wantsCuts('png', undefined, true), false, 'absent is cuts=1');
  assert.equal(wantsCuts('png', 6, false), false, 'a non-sequence tool is unaffected');
  for (const f of ['mp4', 'webm', 'gif', 'apng', 'zip', 'json', 'csv', 'pptx', 'ico', 'html']) {
    assert.equal(wantsCuts(f, 6, true), false, `${f} ignores cuts`);
  }
  for (const f of ['png', 'jpg', 'jpeg', 'webp', 'svg', 'pdf']) assert.ok(CUTS_FORMATS.has(f));
});

// ── the run ─────────────────────────────────────────────────────────────────

test('a raster sheet renders N stills, each at its own playhead, and zips them', async () => {
  const root = stage();
  const { rec, d } = deps(root);
  const seen: [number, number][] = [];
  const blob = await renderSequenceCuts(root, 'png', {
    filename: 'sheet.png', cuts: 6, onProgress: (a, b) => seen.push([a, b]),
  } as Opts, d as never);

  assert.equal(blob.type, 'application/zip');
  assert.equal(rec.stills.length, 6, 'exactly N renders');
  assert.equal(rec.pdfCalls, 0, 'the raster path never touches the pdf renderer');
  // The DOM was genuinely at a different time for each: 6 cuts over three 1s clips
  // put two samples inside each clip, and each still sees only its own clip.
  assert.deepEqual(rec.stills.map((s) => s.live), [['a'], ['a'], ['b'], ['b'], ['c'], ['c']]);
  assert.deepEqual(rec.zipped,
    ['sheet-01.png', 'sheet-02.png', 'sheet-03.png', 'sheet-04.png', 'sheet-05.png', 'sheet-06.png']);
  assert.ok(rec.stills.every((s) => s.cuts === 1), 'a member can never re-enter the cuts path');
  assert.deepEqual(seen, [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]], 'progress is per cut');
});

test('a pdf sheet is ONE document of N pages, playhead advanced per page', async () => {
  const root = stage();
  const { rec, d } = deps(root);
  const blob = await renderSequenceCuts(root, 'pdf', { filename: 'sheet.pdf', cuts: 3 } as Opts, d as never);

  assert.equal(rec.pdfCalls, 1, 'one document, not three merged');
  assert.equal(rec.pages, 3);
  assert.equal(rec.stills.length, 0, 'the pdf path never goes through the still renderer');
  assert.deepEqual(rec.pageLive, [['a'], ['b'], ['c']], 'each page is a different frame');
  assert.ok(blob.size > 0);
});

test('the artboard is restored - after a clean run AND after a throw', async () => {
  const root = stage();
  const before = root.innerHTML;

  await renderSequenceCuts(root, 'png', { cuts: 4 } as Opts, deps(root).d as never);
  assert.deepEqual(live(root), ['a', 'b', 'c'], 'no box is left hidden by seq-off');
  assert.equal(root.innerHTML, before, 'the DOM is byte-identical to how it was found');

  await assert.rejects(
    () => renderSequenceCuts(root, 'png', { cuts: 4 } as Opts, deps(root, { failOn: 2 }).d as never),
    (e: Error & { code?: string }) => {
      // Coded through the sequence taxonomy rather than raw, so the UI has one
      // error surface for motion and stills alike.
      assert.equal(e.name, 'SequenceError');
      assert.equal(e.code, 'SEQ_DECODE_FAILED');
      assert.match(e.message, /contact sheet: rasteriser exploded/);
      return true;
    });
  assert.deepEqual(live(root), ['a', 'b', 'c'], 'a mid-run failure still restores every box');
  assert.equal(root.innerHTML, before);
});

test('a stage with no declared duration fails coded, before rendering anything', async () => {
  const root = stage();
  root.querySelector('[data-seq-ms]')?.removeAttribute('data-seq-ms');
  const { rec, d } = deps(root);
  await assert.rejects(
    () => renderSequenceCuts(root, 'png', { cuts: 4 } as Opts, d as never),
    /data-seq-ms/);
  assert.equal(rec.stills.length, 0);
});
