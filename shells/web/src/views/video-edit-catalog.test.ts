// SPDX-License-Identifier: MPL-2.0
/**
 * The catalog side of the inline video Grade/Trim mode (plans/130) - a SOURCE
 * SCAN, for the reason views/read-text-job.test.ts states: mountCatalog is a
 * 5k-line view that is not headless-mountable, and the properties worth
 * protecting here are structural, not behavioural. Each of them is a bug that
 * has a name in the catalog map's risk list:
 *
 *   - the dispatch entry must sit ABOVE the unconditional closeDetails(), or the
 *     "inline mode" would tear its own detail context down before it mounted;
 *   - Escape must be intercepted with preventDefault (the <dialog> close-watcher
 *     only fires `cancel` when the keydown was NOT cancelled), or Escape closes
 *     the whole modal instead of backing out of the mode;
 *   - the modal's onClose must reap the handle: the mode holds its own decoding
 *     <video>, an AbortController and a rAF, none of which die with the DOM;
 *   - the takeover CSS must hide `.cat-details-nav` as well as the zoom stage -
 *     leaving the prev/next arrows live over the mode silently pages away
 *     mid-edit, which is documented in the stylesheet itself;
 *   - and the act/class names must not collide with "Trim margins", which is a
 *     LIVE, unrelated feature on still uploads (data-act="trim", .is-trimming).
 *
 * Run directly:
 *   node --test shells/web/src/views/video-edit-catalog.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// catalog is an orchestrator plus feature modules under ./catalog/ (2026-09-09 split)
const catDir = new URL('./catalog/', import.meta.url);
const catalog = [readFileSync(new URL('./catalog.ts', import.meta.url), 'utf8'), ...readdirSync(catDir).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(new URL(n, catDir), 'utf8'))].join('\n');
const css = readFileSync(new URL('../styles/parts/catalog.css', import.meta.url), 'utf8');

test('the vid-grade / vid-trim / vid-crop dispatch sits above the unconditional closeDetails()', () => {
  const dispatch = catalog.indexOf("if (act === 'vid-grade' || act === 'vid-trim' || act === 'vid-crop')");
  assert.ok(dispatch > 0, 'the inline entry exists, and crop is one of its tabs');
  // The anchor for "everything after here leaves this asset": the comment the
  // closeDetails() call carries in the click handler.
  const closes = catalog.indexOf("// The remaining actions leave this asset's detail context, so close first.");
  assert.ok(closes > 0, 'the close-first block is still marked by its comment');
  assert.ok(catalog.slice(closes, closes + 200).includes('closeDetails();'), 'and that comment still fronts the closeDetails() call');
  assert.ok(dispatch < closes, 'an inline mode never closes the modal it mounts into');
  assert.ok(
    /if \(act === 'vid-grade' \|\| act === 'vid-trim' \|\| act === 'vid-crop'\)[\s\S]{0,320}?enterInlineVideoEdit\(/.test(catalog),
    'and it routes to the inline entry, not the video-job dialog',
  );
});

test('vid-crop is an inline TAB now, not a modal - and matte/upscale still are modal', () => {
  // The dialog dispatch is the other branch; crop must not be in it, or the old
  // four-number form would open over the asset the box is meant to frame.
  const modal = /else if \(act === 'vid-matte'[^)]*\)/.exec(catalog)?.[0] ?? '';
  assert.ok(modal, 'the video-job dialog branch is still there for the model runs');
  assert.ok(!modal.includes('vid-crop'), 'vid-crop no longer opens the dialog');
  assert.match(modal, /act === 'vid-upscale'/, 'upscale stays modal');
  assert.ok(
    !/openVideoJobDialog[\s\S]{0,400}?op: 'crop'/.test(catalog),
    'and nothing in the catalog asks the dialog for a crop',
  );
  assert.match(catalog, /enterInlineVideoEdit\(act === 'vid-trim' \? 'trim' : act === 'vid-crop' \? 'crop' : 'grade'\)/, 'the act picks the tab the mode opens on');
});

test('the video-job dialog has no crop controls left to drift from the inline box', () => {
  const dialog = readFileSync(new URL('./video-job-dialog.ts', import.meta.url), 'utf8');
  assert.ok(!dialog.includes('cropControls'), 'the numeric X/Y/W/H fragment is gone');
  assert.ok(!dialog.includes('data-crop-x'), 'and so is its prefill');
  assert.ok(!/const isCrop/.test(dialog), 'and the op flag that gated them');
  // The op itself is still a VideoOp, so the exhaustive title Record keeps its entry -
  // that Record is what forces a new op to be named, not a list of this modal's surfaces.
  assert.match(dialog, /crop: \(\) => t\('Crop video'\)/, 'the title Record stays exhaustive');
  assert.ok(!/req\.crop = \{/.test(dialog), 'and buildRequest no longer assembles a crop request');
});

test('the mode gets its own Escape branch, with preventDefault and a busy() guard', () => {
  const branch = /if \((?:dt\.)?inlineVideoEdit\) \{[\s\S]{0,320}?\}/.exec(catalog)?.[0] ?? '';
  assert.ok(branch, 'the keydown handler answers the mode');
  assert.match(branch, /e\.preventDefault\(\)/, 'or Escape closes the whole details modal instead of the mode');
  assert.match(branch, /e\.stopPropagation\(\)/);
  assert.match(branch, /busy\(\)/, 'a committing Apply is never torn down mid-enqueue');
});

test("the modal's onClose reaps the mode, next to the other inline modes", () => {
  const reap = catalog.indexOf('inlineVideoEdit?.exit();');
  assert.ok(reap > 0, 'onClose stands the mode down');
  const retouchReap = catalog.indexOf('inlineRetouch?.exit();');
  assert.ok(retouchReap > 0 && Math.abs(reap - retouchReap) < 400, 'and it sits with the other reaps in onClose');
  assert.match(catalog, /(?:setCropModeActive\(false\)|cropModeActive = false);\s*\/\/ clear the attachZoom pause/, 'the attachZoom pause is still cleared there too');
});

test('the entry is guarded against a double-click and a stale dialog', () => {
  const entry = /async function enterInlineVideoEdit\([\s\S]*?\n {2,4}\}\n/.exec(catalog)?.[0] ?? '';
  assert.ok(entry, 'the entry function exists');
  assert.match(entry, /(?:setVideoEditEntering\(true\)|videoEditEntering = true);/, 'a synchronous in-flight flag spans the awaits');
  assert.match(entry, /detailsDialog !== dlg/, 'and a promise resolving after a page/close bails');
  assert.match(entry, /(?:setCropModeActive\(true\)|cropModeActive = true);/, 'attachZoom stands down while the mode owns the stage');
});

test('the action row offers both, and never collides with "Trim margins"', () => {
  assert.match(catalog, /data-act="vid-grade"[\s\S]{0,200}?Grade…/, 'Grade… is offered on a video');
  assert.match(catalog, /data-act="vid-trim"[\s\S]{0,200}?Trim…/, 'Trim… too');
  assert.match(catalog, /const canVideoGrade = videoDecodable && videoEncodable;/, 'gated on decode AND encode');
  assert.match(catalog, /const canVideoTrim = videoDecodable && videoEncodable;/);
  // The still-upload "Trim margins" keeps its own act, class and mode class.
  assert.match(catalog, /data-act="trim"[\s\S]{0,200}?Trim margins/, 'the unrelated margin trim is untouched');
  assert.ok(!/data-act="vid-trim"[\s\S]{0,400}?is-trimming/.test(catalog), 'the video mode never borrows .is-trimming');
});

test('the takeover CSS hides the zoom stage, the stage bar, the action row AND the paging arrows', () => {
  for (const sel of [
    '.cat-details-preview.is-video-editing .cat-zoom-stage',
    '.cat-details-preview.is-video-editing .cat-stage-bar',
    '.cat-details-preview.is-video-editing .cat-thumb',
    '.cat-details-preview.is-video-editing .cat-details-nav',
    '.cat-details.is-video-editing .cat-details-actions',
  ]) {
    assert.ok(css.includes(sel), `${sel} is in the takeover selector list`);
  }
  assert.ok(css.includes('.cat-vid-work'), 'and the mode carries its own layout rules');
});

test('the crop tab has box + handle rules in the mode\'s own namespace', () => {
  for (const sel of ['.cat-vid-crop {', '.cat-vid-crop-box {', '.cat-vid-crop-h {', '.cat-vid-crop-e {']) {
    assert.ok(css.includes(sel), `${sel} is styled`);
  }
  // Each corner and each edge gets a cursor, or a handle reads as decoration.
  for (const h of ['nw', 'ne', 'sw', 'se']) assert.ok(css.includes(`.cat-vid-crop-h[data-h="${h}"]`), `corner ${h}`);
  for (const h of ['n', 'e', 's', 'w']) assert.ok(css.includes(`.cat-vid-crop-e[data-h="${h}"]`), `edge ${h}`);
  // The still crop box's rules are shared with the image path; the video box has its
  // own so a change on one side can never silently move the other.
  assert.ok(css.includes('.cat-crop-box {'), 'the still crop box keeps its own rules');
});
