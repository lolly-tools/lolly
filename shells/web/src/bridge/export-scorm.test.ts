// SPDX-License-Identifier: MPL-2.0
/**
 * SCORM packaging tests (plans/180 M-D1) - the shell half.
 *
 * The two renderers are INJECTED, so the whole packager runs headlessly: fake stills and
 * a fake film go in, a real zip comes out, and what is asserted is the package contract
 * an LMS actually checks - `imsmanifest.xml` at the ROOT listing every file, a launch page
 * that references nothing but relative paths, the adapter present, and the credentialed
 * media bytes byte-identical to what was handed in.
 *
 * That last one is the provenance rule (section 7) expressed as a test: a narration WAV
 * and the film that mixes it carry a C2PA manifest saying the voice is synthetic, and any
 * re-encode on the way into the zip would silently strip the claim.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/export-scorm.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';

import { buildScormPackage, scormNarrationCues } from './export-scorm.ts';
import type { ScormFilm, ScormPackage, ScormSlideInput, ScormStill } from './export-scorm.ts';

const dec = new TextDecoder();

/** A slide input with no real DOM behind it - the packager only ever hands `el` back to
 *  the injected still renderer, so a token is enough. */
function slide(tag: string, extra: Partial<ScormSlideInput> = {}): ScormSlideInput {
  return { el: { tag } as unknown as Element, ...extra };
}

/** Deterministic, recognisable bytes - so "verbatim" is checkable, not plausible. */
function bytes(seed: number, len = 64): Uint8Array {
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = (seed * 31 + i * 7) & 0xff;
  return out;
}

async function unzip(pkg: ScormPackage): Promise<Record<string, Uint8Array>> {
  return unzipSync(new Uint8Array(await pkg.blob.arrayBuffer()));
}

const svgStill = (i: number): ScormStill => ({ bytes: bytes(i + 1), ext: 'svg' });

test('the package has imsmanifest.xml at the root, listing every other file', async () => {
  const pkg = await buildScormPackage({
    title: 'Onboarding',
    slides: [slide('a'), slide('b'), slide('c')],
    renderStill: async (_el, i) => svgStill(i),
  });
  const files = await unzip(pkg);
  const names = Object.keys(files);

  // At the ROOT, not in a folder: every LMS looks at './'.
  assert.ok(names.includes('imsmanifest.xml'));
  assert.ok(names.includes('index.html'));
  assert.ok(names.includes('scorm/api.js'), 'the runtime adapter must be packaged');
  assert.deepEqual(
    names.filter((n) => n.startsWith('slides/')).sort(),
    ['slides/slide-1.svg', 'slides/slide-2.svg', 'slides/slide-3.svg'],
  );

  const manifest = dec.decode(files['imsmanifest.xml']!);
  for (const name of names) {
    if (name === 'imsmanifest.xml') continue;
    assert.ok(manifest.includes(`<file href="${name}"/>`), `manifest must list ${name}`);
  }
  // 1.2 is the default - the widest floor.
  assert.ok(manifest.includes('<schemaversion>1.2</schemaversion>'));
  assert.ok(manifest.includes('adlcp:scormtype="sco"'));
  assert.ok(manifest.includes('href="index.html"'));
  assert.equal(pkg.slideCount, 3);
  assert.equal(pkg.hasFilm, false);
});

test('the launch page references only relative URLs', async () => {
  const pkg = await buildScormPackage({
    title: 'Onboarding',
    slides: [slide('a', { notes: 'Say this', alt: 'Title slide' })],
    renderStill: async (_el, i) => svgStill(i),
    renderFilm: async () => ({ bytes: bytes(9, 128), ext: 'mp4', captionsVtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHi\n' }),
    fonts: [{ family: 'SUSE', bytes: new Uint8Array([0x77, 0x4f, 0x46, 0x32, 1, 2, 3, 4]), weight: 400 }],
  });
  const files = await unzip(pkg);
  const html = dec.decode(files['index.html']!);

  const refs = [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map((m) => m[1]!);
  assert.ok(refs.length >= 3, 'the page should reference the adapter, the still and the film');
  for (const ref of refs) {
    assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(ref), `absolute URL in the launch page: ${ref}`);
    assert.ok(!ref.startsWith('/') && !ref.startsWith('//'), `root-relative URL in the launch page: ${ref}`);
  }
  // The @font-face url() is the one reference that is not an attribute.
  const cssUrls = [...html.matchAll(/url\("([^"]*)"\)/g)].map((m) => m[1]!);
  assert.deepEqual(cssUrls, ['fonts/suse-400.woff2']);
  assert.ok(files['fonts/suse-400.woff2'], 'the woff2 file itself must be packaged');
  // The notes and the alt text ride the page, so a learner reads what was narrated.
  assert.ok(html.includes('Say this'));
  assert.ok(html.includes('Title slide'));
});

test('the film bytes reach the package verbatim, with its caption sidecar', async () => {
  const film: ScormFilm = { bytes: bytes(42, 512), ext: 'mp4', captionsVtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello\n' };
  const pkg = await buildScormPackage({
    title: 'Narrated deck',
    slides: [slide('a')],
    renderStill: async (_el, i) => svgStill(i),
    renderFilm: async () => film,
  });
  const files = await unzip(pkg);

  // Byte-identical: the credential inside those bytes is intact only if nothing re-encodes.
  assert.deepEqual(files['media/deck.mp4'], film.bytes);
  assert.equal(dec.decode(files['media/deck.vtt']!), film.captionsVtt);
  const html = dec.decode(files['index.html']!);
  assert.ok(html.includes('src="media/deck.mp4"'));
  assert.ok(html.includes('<track kind="captions" src="media/deck.vtt"'));
  // An LMS shows no credential UI, so the synthetic-voice line is visible on the page.
  assert.ok(/class="ai-voice"/.test(html));
  assert.ok(/AI-generated/i.test(html));
  assert.equal(pkg.hasFilm, true);
});

test('a still that will not render is dropped, and never reaches the manifest', async () => {
  const pkg = await buildScormPackage({
    title: 'Partly broken',
    slides: [slide('a'), slide('b'), slide('c')],
    renderStill: async (_el, i) => {
      if (i === 1) throw new Error('render failed');
      return svgStill(i);
    },
  });
  const files = await unzip(pkg);
  const manifest = dec.decode(files['imsmanifest.xml']!);
  const html = dec.decode(files['index.html']!);

  assert.equal(pkg.slideCount, 2);
  assert.ok(!files['slides/slide-2.svg'], 'the failed slide must not be packaged');
  assert.ok(!manifest.includes('slides/slide-2.svg'), 'the manifest must not name a file that is not there');
  assert.ok(!html.includes('slides/slide-2.svg'));
  assert.ok(files['slides/slide-1.svg'] && files['slides/slide-3.svg']);
});

test('a silent deck carries no media and makes no claim about a voice', async () => {
  const pkg = await buildScormPackage({
    title: 'Silent',
    slides: [slide('a')],
    renderStill: async (_el, i) => svgStill(i),
  });
  const files = await unzip(pkg);
  const html = dec.decode(files['index.html']!);
  assert.ok(!Object.keys(files).some((n) => n.startsWith('media/')));
  assert.ok(!html.includes('class="ai-voice"'));
  assert.ok(!html.includes('<video'));
});

test('SCORM 2004 4th Edition is the option, with its own namespaces', async () => {
  const pkg = await buildScormPackage({
    title: 'Onboarding',
    version: '2004',
    slides: [slide('a')],
    renderStill: async (_el, i) => svgStill(i),
  });
  const manifest = dec.decode((await unzip(pkg))['imsmanifest.xml']!);
  assert.ok(manifest.includes('<schemaversion>2004 4th Edition</schemaversion>'));
  assert.ok(manifest.includes('http://www.imsglobal.org/xsd/imscp_v1p1'));
  assert.ok(manifest.includes('adlcp:scormType="sco"'), '2004 spells scormType camelCase');
});

test('narration slices caption the film on the film clock, clamped to each slide', async () => {
  const cues = scormNarrationCues([
    // Slide 1: 0-5000 ms, clip starts 400 ms in.
    { words: [{ text: 'Hello.', start: 0, end: 0.8 }, { text: 'World.', start: 1, end: 1.6 }], startMs: 0, endMs: 5000, offsetMs: 400 },
    // Slide 2: 5000-6000 ms - a clip that outlasts its slide is TRIMMED, not spilled.
    { words: [{ text: 'Later.', start: 0, end: 4 }], startMs: 5000, endMs: 6000 },
  ]);
  assert.equal(cues.length, 3);
  assert.equal(cues[0]!.text, 'Hello.');
  assert.ok(Math.abs(cues[0]!.start - 0.4) < 1e-6, 'the lead-in offsets the first word');
  assert.ok(Math.abs(cues[1]!.end - 2.0) < 1e-6);
  assert.equal(cues[2]!.text, 'Later.');
  assert.ok(Math.abs(cues[2]!.start - 5.0) < 1e-6);
  assert.ok(Math.abs(cues[2]!.end - 6.0) < 1e-6, 'clamped to the slide window (T4)');
});

test('narration slices beat a ready-made VTT - they are the words we spoke', async () => {
  const pkg = await buildScormPackage({
    title: 'Narrated deck',
    slides: [slide('a')],
    renderStill: async (_el, i) => svgStill(i),
    renderFilm: async () => ({ bytes: bytes(7, 32), ext: 'mp4', captionsVtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nfrom the audio\n' }),
    narration: [{ words: [{ text: 'From', start: 0, end: 0.4 }, { text: 'the script.', start: 0.4, end: 1.2 }], startMs: 0, endMs: 4000 }],
  });
  const vtt = dec.decode((await unzip(pkg))['media/deck.vtt']!);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('From the script.'));
  assert.ok(!vtt.includes('from the audio'));
});

test('captions without a film are not packaged - there is nothing to caption', async () => {
  const pkg = await buildScormPackage({
    title: 'Silent',
    slides: [slide('a')],
    renderStill: async (_el, i) => svgStill(i),
    narration: [{ words: [{ text: 'Unused.', start: 0, end: 1 }], startMs: 0, endMs: 2000 }],
  });
  const files = await unzip(pkg);
  assert.ok(!files['media/deck.vtt']);
});

test('the caller language reaches the launch page, not just the <html lang>', async () => {
  // The engine has no i18n, so the page's words arrive as parameters or the package
  // ships English chrome under a `lang` that says otherwise (WCAG 3.1.1/3.1.2).
  const pkg = await buildScormPackage({
    title: 'Cursus',
    lang: 'nl',
    labels: { previous: 'Vorige', next: 'Volgende', slideOf: 'Dia {n} van {total}' },
    slides: [slide('a')],
    renderStill: async (_el, i) => svgStill(i),
  });
  const html = dec.decode((await unzip(pkg))['index.html']!);
  assert.ok(html.includes('<html lang="nl">'));
  assert.ok(html.includes('>Vorige</button>') && html.includes('>Volgende</button>'));
  assert.ok(html.includes('Dia {n} van {total}'), 'the live-region template too');
});
