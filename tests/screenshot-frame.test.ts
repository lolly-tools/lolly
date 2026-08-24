// SPDX-License-Identifier: MPL-2.0
/**
 * Screenshot Frame (community/screenshot-frame) - render contract.
 *
 * Loads the REAL tool from the community pack (manifest + template + hooks) and
 * drives it through the engine with the shared baseHost, whose asset bridge
 * resolves any id to an "asset:<id>" URL. So the assertions below check what the
 * tool actually renders, not a fixture of it.
 *
 * What is pinned here:
 *  - the picked screenshot reaches the <img> src;
 *  - each frame value marks the root with its own class and no other;
 *  - each window-button style emits its own glyph set;
 *  - the backdrop paints solid / gradient / nothing as asked;
 *  - an empty picture slot draws the placeholder screen instead of an <img>;
 *  - junk values never throw out of the hook, and no colour becomes a fetch;
 *  - the corner slider reaches every frame, not only the bare shot;
 *  - every example, template seed and preset overlay mounts and draws.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/screenshot-frame.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// Load from the SOURCE pack, not the gitignored tools/ profile view, so the
// suite is profile-independent: skip only when community/ is not checked out.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'screenshot-frame', 'tool.json')),
    'community/screenshot-frame/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('screenshot-frame', fetchFile);

async function render(state: Record<string, any>): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), state);
  return rt.getHydrated() as string;
}

const SHOT = { id: 'demo/screenshot' };

const FRAME_CLASSES = ['sf-frame--browser', 'sf-frame--phone', 'sf-frame--laptop', 'sf-frame--none'];

test('the picked screenshot reaches the img src', { skip: SKIP }, async () => {
  const html = await render({ image: SHOT });
  assert.match(html, /<img class="sf-img" src="asset:demo\/screenshot"/,
    'the resolved asset URL must be the img source');
  assert.ok(!html.includes('sf-ph-body'), 'the placeholder must not render alongside a real picture');
});

test('each frame marks the root with its own class and no other', { skip: SKIP }, async () => {
  for (const frame of ['browser', 'phone', 'laptop', 'none']) {
    const html = await render({ image: SHOT, frame });
    const want = `sf-frame--${frame}`;
    assert.ok(html.includes(want), `frame=${frame} did not render ${want}`);
    for (const other of FRAME_CLASSES) {
      if (other === want) continue;
      assert.ok(!html.includes(other), `frame=${frame} also rendered ${other}`);
    }
  }
});

test('a frame renders only its own furniture', { skip: SKIP }, async () => {
  const browser = await render({ image: SHOT, frame: 'browser', url: 'https://lolly.tools/gallery' });
  assert.ok(browser.includes('sf-titlebar'), 'the browser frame needs a title bar');
  assert.ok(browser.includes('lolly.tools/gallery'), 'the address pill shows the URL without its protocol');
  assert.ok(!browser.includes('https://'), 'the protocol must be stripped from the address pill');
  assert.ok(!browser.includes('sf-base'), 'a browser window has no laptop base');

  const phone = await render({ image: SHOT, frame: 'phone', title: 'Field notes' });
  assert.ok(phone.includes('sf-island'), 'the phone frame needs its island');
  assert.ok(phone.includes('Field notes'), 'the phone status row shows the title');
  assert.ok(!phone.includes('sf-titlebar'), 'a phone has no browser title bar');

  const laptop = await render({ image: SHOT, frame: 'laptop' });
  assert.ok(laptop.includes('sf-base'), 'the laptop frame needs its base plate');
  assert.ok(!laptop.includes('sf-titlebar'), 'a laptop frame has no browser title bar');

  const none = await render({ image: SHOT, frame: 'none' });
  assert.ok(!none.includes('sf-titlebar') && !none.includes('sf-base') && !none.includes('sf-island'),
    'frame=none is the bare padded shot');
});

test('each window-button style emits its own glyph set', { skip: SKIP }, async () => {
  const count = (html: string, cls: string) => html.split(`class="${cls}"`).length - 1;

  const cupertino = await render({ image: SHOT, frame: 'browser', windowStyle: 'cupertino' });
  assert.equal(count(cupertino, 'sf-dot'), 3, 'cupertino draws three dots');
  assert.equal(count(cupertino, 'sf-cap'), 0);
  assert.equal(count(cupertino, 'sf-close'), 0);
  assert.match(cupertino, /fill="#ff5f56"/, 'the dots carry explicit fills, never currentColor');

  const redmond = await render({ image: SHOT, frame: 'browser', windowStyle: 'redmond' });
  assert.equal(count(redmond, 'sf-cap'), 3, 'redmond draws three caption buttons');
  assert.equal(count(redmond, 'sf-dot'), 0);
  assert.equal(count(redmond, 'sf-close'), 0);

  const nuremberg = await render({ image: SHOT, frame: 'browser', windowStyle: 'nuremberg' });
  assert.equal(count(nuremberg, 'sf-close'), 1, 'nuremberg draws one round close button');
  assert.equal(count(nuremberg, 'sf-dot'), 0);
  assert.equal(count(nuremberg, 'sf-cap'), 0);

  // Every glyph names its own colour, so the SVG export path (which clones
  // inline svg verbatim, with no inherited paint) keeps them visible.
  assert.ok(!/stroke="currentColor"/.test(nuremberg + redmond + cupertino),
    'window-button glyphs must not rely on inherited colour');
});

test('the backdrop paints solid, gradient or nothing', { skip: SKIP }, async () => {
  const solid = await render({ image: SHOT, backdrop: 'solid', background: '#123456', color2: '#abcdef' });
  assert.match(solid, /class="sf-backdrop" style="background:#123456"/);
  assert.ok(!solid.includes('#abcdef'), 'a solid backdrop ignores the second colour');

  const gradient = await render({ image: SHOT, backdrop: 'gradient', background: '#123456', color2: '#abcdef' });
  assert.ok(gradient.includes('sf-backdrop'), 'a gradient backdrop still paints a layer');
  assert.ok(gradient.includes('#123456') && gradient.includes('#abcdef'),
    'a gradient uses both colours');
  assert.ok(gradient.includes('radial-gradient') && gradient.includes('linear-gradient'));

  const clear = await render({ image: SHOT, backdrop: 'transparent', background: '#123456' });
  assert.ok(!clear.includes('sf-backdrop'), 'a transparent backdrop paints no layer at all');
  assert.ok(!clear.includes('#123456'), 'a transparent backdrop drops the colour with it');

  // The export-bar No BG toggle clears the backdrop the same way the select does.
  const noBg = await render({ image: SHOT, backdrop: 'gradient', background: '#123456', transparentBg: true });
  assert.ok(!noBg.includes('sf-backdrop'), 'No BG must clear the backdrop whatever the select says');
});

test('an empty picture slot draws the placeholder screen, not a broken image', { skip: SKIP }, async () => {
  const html = await render({});
  assert.ok(!/<img/.test(html), 'no image element without a picked picture');
  assert.ok(html.includes('sf-ph-body') && html.includes('sf-ph-card'),
    'the placeholder screen must render in place of the picture');
  // The default state is still a designed frame, not an empty box.
  assert.ok(html.includes('sf-frame--browser') && html.includes('sf-backdrop'));
});

test('junk values never throw out of the hook', { skip: SKIP }, async () => {
  const junk: Array<Record<string, unknown>> = [
    { frame: 'spaceship', windowStyle: 'atlantis', backdrop: 'plaid' },
    { padding: 'lots', scale: 'big', radius: null, shadow: 'none' },
    { padding: '48', scale: '77', radius: '9', shadow: '20' },
    { background: 'url(javascript:alert(1))', color2: '<script>', url: 12345 },
    { frame: null, windowStyle: undefined, image: 'not-a-ref' },
  ];
  for (const state of junk) {
    const html = await render(state);
    assert.ok(html.includes('sf-root'), `junk state did not render: ${JSON.stringify(state)}`);
    assert.ok(!html.includes('sf-error'), `junk state surfaced an error note: ${JSON.stringify(state)}`);
    assert.ok(!html.includes('javascript:') && !html.includes('<script>'),
      'a colour value must never reach the style attribute as markup or a URL');
  }

  // url(//host/x.png) has no colon, so a character allowlist alone lets it
  // through and the render fetches a third party from a shared link.
  const remote = await render({ background: 'url(//example.invalid/x.png)', backdrop: 'solid' });
  assert.ok(!remote.includes('example.invalid') && !/url\s*\(/i.test(remote),
    'a colour must never become an external resource fetch');

  // Numeric strings still drive the geometry, they are not silently dropped.
  const numeric = await render({ padding: '48', scale: '77', radius: '9' });
  assert.ok(numeric.includes('padding:48px') && numeric.includes('--sf-scale:77') && numeric.includes('--sf-radius:9px'));
});

test('the corner radius reaches the frame, not only the bare shot', { skip: SKIP }, async () => {
  // The slider drove --sf-radius but the browser and laptop windows pinned
  // their own corner, so the control did nothing on three frames out of four.
  const css = await readFile(join(COMMUNITY, 'screenshot-frame', 'styles.css'), 'utf8');
  for (const sel of ['.sf-frame--browser .sf-window', '.sf-frame--laptop .sf-window']) {
    const block = css.slice(css.indexOf(sel));
    const radius = block.slice(0, block.indexOf('}')).match(/border-radius:([^;]+);/)?.[1] ?? '';
    assert.match(radius, /var\(--sf-radius/, `${sel} must take its corner from the slider`);
  }
});

// Every shipped starting point has to mount and draw. A seed that names a
// retired input or trips the hook would otherwise only show up in the gallery.
type Seed = { label: string; values: Record<string, unknown> };

function seeds(): Seed[] {
  const out: Seed[] = [];
  for (const ex of (tool.manifest.examples ?? []) as Array<{ label: string; values: Record<string, unknown> }>) {
    out.push({ label: `example ${ex.label}`, values: ex.values });
  }
  const dir = join(COMMUNITY, 'screenshot-frame', 'templates');
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const t = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    out.push({ label: `template ${t.id}`, values: t.values });
    for (const p of t.presets ?? []) {
      out.push({ label: `template ${t.id} preset ${p.id}`, values: { ...t.values, ...p.values } });
    }
  }
  return out;
}

test('every example, template and preset seed hydrates', { skip: SKIP }, async () => {
  const ids = new Set((tool.manifest.inputs as Array<{ id: string }>).map(i => i.id));
  const list = seeds();
  assert.ok(list.length >= 4 + 3, 'the seed sweep found nothing to check');

  for (const { label, values } of list) {
    for (const key of Object.keys(values)) {
      assert.ok(ids.has(key), `${label} seeds "${key}", which is not an input`);
    }
    const html = await render(values);
    assert.ok(html.includes('sf-root'), `${label} did not render`);
    assert.ok(!html.includes('sf-error'), `${label} surfaced a hook error`);
    // A seed must arrive at the frame it names, with real furniture in it.
    const frame = String(values.frame ?? 'browser');
    assert.ok(html.includes(`sf-frame--${frame}`), `${label} did not reach frame=${frame}`);
    assert.ok(html.includes('sf-shot'), `${label} rendered no screen`);
    if (values.backdrop !== 'transparent') {
      assert.ok(html.includes('sf-backdrop'), `${label} lost its backdrop`);
    }
  }
});
