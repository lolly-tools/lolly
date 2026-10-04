// SPDX-License-Identifier: MPL-2.0
/**
 * `logo: auto` over a photograph (plan 291 M4): packages/node-shell/src/compose-photo-surface.ts
 * draws a slide's `under` rows and reads the light of the picture under a box, so the
 * engine can leave a mark off a photo where it would not read.
 *
 * Public: a generated picture and the lolly-start profile.
 * Run with: node --import ./tests/css-stub.mjs --test tests/compose-photo-surface.test.ts
 */
process.env.LOLLY_PROFILE ??= 'lolly-start';

import assert from 'node:assert/strict';
import test from 'node:test';

import { packPng } from '../engine/src/png.ts';
import { measureComposePhotos } from '../packages/node-shell/src/compose-photo-surface.ts';
import { composeDesign } from '../packages/node-shell/src/design-compose.ts';

/** A 300x200 picture: pale in its left third, dark elsewhere. */
function halfPale(): Uint8Array {
  const w = 300;
  const h = 200;
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const v = x < 100 ? 235 : 20;
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
      px[i + 3] = 255;
    }
  }
  return packPng(px, { width: w, height: h, channels: 4, depth: 8 });
}

const SIZE = { width: 1920, height: 1080 };
const photoRow = (over: Record<string, unknown> = {}) => ({ kind: 'image', image: 'photo:pale', x: 0, y: 0, w: 1920, h: 1080, fit: 'cover', ...over });
const spec = (under: unknown[]) => ({ slides: [{ archetype: 'title', under }] });

test('the light under a box is read from the picture as drawn: its fit, its flip and a scrim over it', async () => {
  const bytes = halfPale();
  const of = (key: string) => (key === 'photo:pale' ? bytes : null);
  const plain = await measureComposePhotos(spec([photoRow()]), SIZE, of, []);
  assert.ok(plain, 'a covering photo with bytes is measured');
  const left = plain.luminanceUnder(0, { x: 40, y: 40, w: 300, h: 120 })!;
  const right = plain.luminanceUnder(0, { x: 1500, y: 40, w: 300, h: 120 })!;
  assert.ok(left.low > 0.7, `the pale third reads light (${left.low})`);
  assert.ok(right.high < 0.05, `the rest reads dark (${right.high})`);
  // Flipped, the pale third is on the right.
  const flipped = await measureComposePhotos(spec([photoRow({ flipH: true })]), SIZE, of, []);
  assert.ok(flipped!.luminanceUnder(0, { x: 40, y: 40, w: 300, h: 120 })!.high < 0.05);
  assert.ok(flipped!.luminanceUnder(0, { x: 1500, y: 40, w: 300, h: 120 })!.low > 0.7);
  // A navy scrim at 60% over the photo darkens the pale part.
  const scrimmed = await measureComposePhotos(spec([photoRow(), { kind: 'box', x: 0, y: 0, w: 1920, h: 1080, bg: '#13294b99' }]), SIZE, of, []);
  assert.ok(scrimmed!.luminanceUnder(0, { x: 40, y: 40, w: 300, h: 120 })!.high < 0.35);
  // Unmeasured: another slide, a photo that covers too little, a picture with no bytes.
  assert.equal(plain.luminanceUnder(3, { x: 0, y: 0, w: 10, h: 10 }), null);
  assert.equal(await measureComposePhotos(spec([photoRow({ w: 400 })]), SIZE, of, []), null);
  assert.equal(await measureComposePhotos(spec([photoRow({ image: 'photo:missing' })]), SIZE, of, []), null);
});

test('a mark is judged by its own colours, and a mark that carries its own contrast is not judged against the picture', async () => {
  const bytes = halfPale();
  const measured = await measureComposePhotos(spec([photoRow()]), SIZE, () => bytes, ['lolly/logo/primary', 'not/a/mark']);
  assert.ok(measured);
  // lolly-start's mark sets green beside white, so it carries its own contrast and has no inks to judge.
  assert.equal(measured.inks['lolly/logo/primary'], undefined);
  assert.equal(measured.inks['not/a/mark'], undefined);
});

test('composeDesign takes picture bytes for placeholder keys and measures with them', async () => {
  const bytes = halfPale();
  const result = await composeDesign(spec([photoRow()]), { assets: { 'photo:pale': bytes } });
  // lolly-start's catalog master places its mark; with a self-contained mark the pick stands.
  assert.ok(!result.report.notes.some((n) => n.code === 'compose.logo.photo-contrast'));
  assert.equal(result.report.slides.length, 1);
});

test('lolly compose takes --asset=KEY=PATH (repeatable) and passes it on in the package hint', async () => {
  const { spawnSync } = await import('node:child_process');
  const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'lolly-compose-asset-'));
  try {
    await writeFile(join(dir, 'pale.png'), halfPale());
    await writeFile(join(dir, 'other.png'), halfPale());
    await writeFile(join(dir, 'spec.json'), JSON.stringify(spec([photoRow()])));
    const run = (args: string[]) => spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'compose', ...args], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 180_000,
      env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1' },
    });
    const ok = run([join(dir, 'spec.json'), `--asset=photo:pale=${join(dir, 'pale.png')}`, `--asset=photo:other=${join(dir, 'other.png')}`, `--output=${join(dir, 'deck.json')}`, '--json']);
    assert.equal(ok.status, 0, ok.stderr);
    const next = (JSON.parse(ok.stdout) as { result: { next: string[] } }).result.next.join(' ');
    assert.match(next, /--asset=photo:pale=/);
    assert.match(next, /--asset=photo:other=/);
    const bad = run([join(dir, 'spec.json'), '--asset=photo:pale']);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /--asset takes KEY=PATH/);
    const missing = run([join(dir, 'spec.json'), `--asset=photo:pale=${join(dir, 'nope.png')}`]);
    assert.equal(missing.status, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a row\'s opacity is a percent, as Design draws it: 50 is half, 100 or none is solid', async () => {
  const bytes = halfPale();
  const of = (key: string) => (key === 'photo:pale' ? bytes : null);
  const pale = { x: 40, y: 40, w: 300, h: 120 };
  const at = async (scrim: Record<string, unknown>, photo: Record<string, unknown> = {}) =>
    (await measureComposePhotos(spec([photoRow(photo), { kind: 'box', x: 0, y: 0, w: 1920, h: 1080, bg: '#000000', ...scrim }]), SIZE, of, []))!.luminanceUnder(0, pale)!;
  const solid = await at({});
  assert.ok(solid.high < 0.01, `an opaque black scrim hides the photo (${solid.high})`);
  assert.equal((await at({ opacity: 100 })).high, solid.high);
  const half = await at({ opacity: 50 });
  // Pale 235 under black at 50%: about 118 of 255, relative luminance about 0.18.
  assert.ok(half.low > 0.1 && half.high < 0.3, `opacity 50 lets half the photo through (${half.low} to ${half.high})`);
  const faint = await at({ opacity: 10 });
  assert.ok(faint.low > 0.6, `opacity 10 is almost invisible (${faint.low})`);
  // A photo at 50% over the slide's white reads lighter than the photo itself.
  const darkPart = { x: 1500, y: 40, w: 300, h: 120 };
  const photoHalf = (await measureComposePhotos(spec([photoRow({ opacity: 50 })]), SIZE, of, []))!.luminanceUnder(0, darkPart)!;
  assert.ok(photoHalf.low > 0.15, `a half-transparent photo over white is not read as solid dark (${photoHalf.low})`);
});

test('a scrim written as a token or a tinted linear gradient is drawn; one that cannot be drawn leaves the slide unmeasured and says why', async () => {
  const bytes = halfPale();
  const of = (key: string) => (key === 'photo:pale' ? bytes : null);
  const pale = { x: 40, y: 40, w: 300, h: 120 };
  const tokens: Record<string, string> = { '{color.brand.pine}': '#0c322c', '{color.semantic.surface}': '#1d1d1d' };
  const told: Array<[number, string]> = [];
  const opts = { resolveColour: (ref: string) => tokens[ref] ?? null, onUnmeasured: (i: number, why: string) => told.push([i, why]) };
  const scrim = (over: Record<string, unknown>) => spec([photoRow(), { kind: 'box', id: 'scrim', x: 0, y: 0, w: 1920, h: 1080, ...over }]);

  // A token fill: solid pine over the pale third reads dark.
  const token = await measureComposePhotos(scrim({ bg: '{color.brand.pine}' }), SIZE, of, [], opts);
  assert.ok(token!.luminanceUnder(0, pale)!.high < 0.05, 'a token scrim is drawn with its colour');
  // A linear gradient tinted by $tint: opaque at the top, clear at the bottom (0 deg points up).
  const tinted = await measureComposePhotos(scrim({ grad: 'lin_0_ffffff00-0_ffffffff-100', $tint: '{color.semantic.surface}' }), SIZE, of, [], opts);
  assert.ok(tinted!.luminanceUnder(0, { x: 40, y: 20, w: 300, h: 60 })!.high < 0.05, 'the opaque end of the tinted scrim darkens the photo');
  assert.ok(tinted!.luminanceUnder(0, { x: 40, y: 1000, w: 300, h: 60 })!.low > 0.6, 'the clear end leaves the photo');
  // A plain gradient with no tint is drawn as written, over the box's own bg.
  const plainGrad = await measureComposePhotos(scrim({ grad: 'lin_90_000000-0_000000-100' }), SIZE, of, [], opts);
  assert.ok(plainGrad!.luminanceUnder(0, pale)!.high < 0.01);
  assert.equal(told.length, 0, `nothing above is refused: ${JSON.stringify(told)}`);

  // Refused, so the bare photo is never judged: a token that does not resolve, a radial
  // gradient, an unresolved $tint, and a picture with a photo look.
  const refusals: Array<[unknown, RegExp]> = [
    [scrim({ bg: '{color.nope}' }), /\{color\.nope\} does not resolve/],
    [scrim({ grad: 'rad_0_000000-0_ffffff-100' }), /radial gradient/],
    [scrim({ grad: 'lin_0_ffffff00-0_ffffffff-100', $tint: '{color.nope}' }), /\$tint/],
    [spec([photoRow({ image: 'photo:pale?treatment=tone' })]), /photo look/],
  ];
  for (const [s, why] of refusals) {
    told.length = 0;
    assert.equal(await measureComposePhotos(s, SIZE, of, [], opts), null);
    assert.equal(told.length, 1);
    assert.equal(told[0]![0], 0);
    assert.match(told[0]![1], why);
  }
  // A slide whose logo is off, or not auto, is not judged at all.
  told.length = 0;
  assert.equal(await measureComposePhotos({ furniture: { logo: 'mono' }, slides: [{ archetype: 'title', under: [photoRow({ image: 'photo:pale?treatment=tone' })] }] }, SIZE, of, [], opts), null);
  assert.equal(told.length, 0);
});

test('composeDesign resolves an under row\'s token through the design system, and notes a slide it could not measure', async () => {
  const bytes = halfPale();
  const resolvable = await composeDesign(spec([photoRow(), { kind: 'box', x: 0, y: 0, w: 1920, h: 1080, bg: '{color.semantic.surface}', opacity: 40 }]), { assets: { 'photo:pale': bytes } });
  assert.ok(!resolvable.report.notes.some((n) => n.code === 'compose.logo.photo-unmeasured'), JSON.stringify(resolvable.report.notes));
  const unresolved = await composeDesign(spec([photoRow(), { kind: 'box', x: 0, y: 0, w: 1920, h: 1080, bg: '{color.not.a.token}' }]), { assets: { 'photo:pale': bytes } });
  const note = unresolved.report.notes.find((n) => n.code === 'compose.logo.photo-unmeasured');
  assert.ok(note, JSON.stringify(unresolved.report.notes));
  assert.match(note.message, /Slide 1: .*color\.not\.a\.token/);
});

test('a picture with a photo look is supplied by the source deck under its base key, with no compose.asset.needed', async () => {
  const { readFile } = await import('node:fs/promises');
  const deck = new Uint8Array(await readFile(new URL('./fixtures/rebrand/recreate.pptx', import.meta.url)));
  const source = { bytes: deck, name: 'recreate.pptx' };
  const { suggestCompose } = await import('../packages/node-shell/src/design-compose.ts');
  const suggested = await suggestCompose({ source });
  assert.ok(suggested.assets.length, 'the fixture deck has pictures');
  const key = suggested.assets[0]!.key;
  const looked = { slides: [{ archetype: 'title', under: [{ kind: 'image', image: `${key}?treatment=tone`, x: 0, y: 0, w: 960, h: 540, fit: 'cover' }] }] };
  const result = await composeDesign(looked, { source });
  assert.ok(!result.report.notes.some((n) => n.code === 'compose.asset.needed'), JSON.stringify(result.report.notes.filter((n) => n.code === 'compose.asset.needed')));
  assert.deepEqual(result.assets.map((a) => a.key), [key]);
  // With nothing to supply the picture, the hint gives the base key that --asset takes.
  const bare = await composeDesign({ slides: [{ archetype: 'title', under: [{ kind: 'image', image: 'photo:cover?treatment=tone', x: 0, y: 0, w: 400, h: 300 }] }] });
  const needed = bare.report.notes.filter((n) => n.code === 'compose.asset.needed');
  assert.equal(needed.length, 1);
  assert.match(needed[0]!.message, /^photo:cover is a picture placeholder.*--asset=photo:cover=<file>/);
});

test('a text slot whose ink does not read against the photograph under it is noted, and keeps its ink', async () => {
  const w = 160;
  const h = 90;
  const pale = new Uint8Array(w * h * 4).fill(235).map((v, i) => (i % 4 === 3 ? 255 : v));
  const bytes = packPng(pale, { width: w, height: h, channels: 4, depth: 8 });
  const deck = (theme: 'light' | 'dark') => ({ theme, slides: [{ archetype: 'title', slots: { title: 'Harbour lights' }, under: [photoRow({ image: 'photo:pale' })] }] });
  const dark = await composeDesign(deck('dark'), { assets: { 'photo:pale': bytes } });
  const note = dark.report.notes.find((n) => n.code === 'compose.text.photo-contrast');
  assert.ok(note, `a light title over a pale photo is noted: ${JSON.stringify(dark.report.notes.map((n) => n.code))}`);
  assert.match(note.message, /^Slide 1: s01\.title \(title\) is set in #[0-9a-f]{6} over the photograph.*short of 3:1\. Put a scrim/);
  const title = (dark.document.boxes as Array<Record<string, unknown>>).find((r) => r.id === 's01.title')!;
  assert.match(String(title.fg), /^#[0-9a-f]{6}$/i, 'the slot keeps the master\'s ink');
  // The same light ink over a dark photo reads, so nothing is noted.
  const darkPhoto = packPng(new Uint8Array(w * h * 4).fill(20).map((v, i) => (i % 4 === 3 ? 255 : v)), { width: w, height: h, channels: 4, depth: 8 });
  const reads = await composeDesign(deck('dark'), { assets: { 'photo:pale': darkPhoto } });
  assert.ok(!reads.report.notes.some((n) => n.code === 'compose.text.photo-contrast'), JSON.stringify(reads.report.notes));
});
