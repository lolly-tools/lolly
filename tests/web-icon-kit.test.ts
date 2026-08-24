// SPDX-License-Identifier: MPL-2.0
/**
 * Web Icon Maker (community/web-icon) - the app-identity kit contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine. Two promises are guarded here:
 *
 *  1. The PWA manifest the tool writes is valid JSON whose `icons` name exactly
 *     the files the kit ships - so an installed app can never point at a missing
 *     icon. The maskable / monochrome toggles gate both halves together.
 *  2. `?export=zip` is owned by the tool's exportStill hook: one nested render
 *     per member (variant + pixel size), packed into an archive the engine's own
 *     `readZip` can read back, CRCs and all. Every other format declines and
 *     takes the normal render path untouched.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/web-icon-kit.test.ts
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { readZip } from '../engine/src/zip.ts';
import { baseHost } from './helpers/host.ts';

// web-icon ships in the PUBLIC community pack. Load from the SOURCE pack, not the
// gitignored tools/ profile view, so the suite is profile-independent: skip only
// when community/ isn't checked out (a clone without submodules); with it present,
// a missing tool dir means a rename/delete and must FAIL loudly.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'web-icon', 'tool.json')),
    'community/web-icon/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('web-icon', fetchFile);

type ComposeCall = { format: string; width: number; height: number; variant: unknown; showGrid: unknown };

// A host whose compose bridge records what the kit asked for and answers with
// recognisable bytes, so a zip member can be traced back to its render.
function makeHost(calls: ComposeCall[] = [], opts: { compose?: boolean } = {}) {
  const renders: Array<{ node: unknown; format: string; opts: any }> = [];
  const host = baseHost({
    export: {
      render: async (node: unknown, format: string, opts: any = {}) => {
        renders.push({ node, format, opts });
        return new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' });
      },
    },
    ...(opts.compose === false ? {} : {
      compose: {
        render: async (spec: any) => {
          calls.push({
            format: spec.format, width: spec.width, height: spec.height,
            variant: spec.inputs?.variant, showGrid: spec.inputs?.showGrid,
          });
          const body = `${spec.format}:${spec.width}x${spec.height}:${spec.inputs?.variant}`;
          return { url: 'data:application/octet-stream;base64,' + Buffer.from(body).toString('base64') };
        },
      },
    }),
  });
  return { host, renders };
}

const mount = (state: any, host: any) => createRuntime(tool, host, state);

const manifestOf = async (state: any, host: any = makeHost().host) => {
  const rt = await mount(state, host);
  // webManifest is a hook extra; render it raw (triple-stache bypasses escaping).
  return JSON.parse(rt.getHydratedString('{{{webManifest}}}') as string);
};

const kitFilesOf = async (state: any) => {
  const rt = await mount(state, makeHost().host);
  return JSON.parse(rt.getHydratedString('{{{kitFilesJson}}}') as string) as string[];
};

describe('web-icon: the PWA manifest', { skip: SKIP }, () => {
  test('is valid JSON naming the app and every icon the kit ships', async () => {
    const m = await manifestOf({ appName: 'Field Notes', appShortName: 'Notes', background: '#0c322c' });
    assert.equal(m.name, 'Field Notes');
    assert.equal(m.short_name, 'Notes');
    assert.equal(m.start_url, '/');
    assert.equal(m.display, 'standalone');
    assert.equal(m.theme_color, '#0c322c');
    assert.equal(m.background_color, '#0c322c');

    const files = await kitFilesOf({ appName: 'Field Notes', background: '#0c322c' });
    for (const icon of m.icons) {
      assert.ok(files.includes(icon.src), `manifest names ${icon.src}, which the kit does not ship`);
    }
    assert.deepEqual(
      m.icons.filter((i: any) => i.purpose === 'any').map((i: any) => i.src),
      ['icon.svg', 'icon-192.png', 'icon-512.png'],
    );
    // The two sizes a browser wants before it offers to install.
    for (const size of ['192x192', '512x512']) {
      assert.ok(m.icons.some((i: any) => i.sizes === size && i.type === 'image/png'),
        `no ${size} PNG icon in the manifest`);
    }
    assert.ok(files.includes('manifest.json'), 'manifest.json is itself a kit file');
    assert.ok(files.includes('social-card.png'), 'the social card is a kit file');
    // The card is a link preview, not an app icon - it must not be advertised as one.
    assert.ok(!m.icons.some((i: any) => i.src === 'social-card.png'));
  });

  test('falls back to the icon label when no app name is set', async () => {
    const m = await manifestOf({ appName: '', appShortName: '', text: 'ab' });
    assert.equal(m.name, 'AB');
    assert.equal(m.short_name, 'AB');
  });

  test('omits the colours it cannot resolve rather than writing an alias', async () => {
    // No token bridge on this host, so the `{color.semantic.*}` default survives
    // as a literal - writing it into a manifest would give browsers a junk colour.
    const m = await manifestOf({});
    assert.equal('theme_color' in m, false);
    assert.equal('background_color' in m, false);
  });

  test('writes only colours a browser can read', async () => {
    // A browser reads theme_color straight off the manifest, so a near-miss is
    // junk, not a fallback: #12345 and #1234567 are not hex colours at all.
    for (const junk of ['#12345', '#1234567', '#0c322', 'not a colour', 'rgb(a(1)']) {
      const m = await manifestOf({ background: junk });
      assert.equal('theme_color' in m, false, `${junk} was written into the manifest`);
    }
    for (const ok of ['#fff', '#0c322c', '#0c322cff', 'rgb(12 50 44)']) {
      const m = await manifestOf({ background: ok });
      assert.equal(m.theme_color, ok, `${ok} should survive into the manifest`);
    }
  });

  test('the maskable and monochrome toggles gate their entries and their files', async () => {
    const on = await manifestOf({ maskable: true, monochrome: true });
    assert.deepEqual(
      on.icons.filter((i: any) => i.purpose !== 'any').map((i: any) => [i.src, i.purpose]),
      [['icon-maskable-512.png', 'maskable'], ['icon-monochrome-512.png', 'monochrome']],
    );

    const off = await manifestOf({ maskable: false, monochrome: false });
    assert.equal(off.icons.every((i: any) => i.purpose === 'any'), true);

    const files = await kitFilesOf({ maskable: false, monochrome: false });
    assert.equal(files.includes('icon-maskable-512.png'), false);
    assert.equal(files.includes('icon-monochrome-512.png'), false);
    assert.deepEqual(files, ['favicon.ico', 'icon.svg', 'icon-192.png', 'icon-512.png', 'social-card.png', 'manifest.json']);
  });
});

describe('web-icon: the kit zip', { skip: SKIP }, () => {
  test('packs one render per member plus the manifest, readable by readZip', async () => {
    const calls: ComposeCall[] = [];
    const { host } = makeHost(calls);
    const rt = await mount({ appName: 'Field Notes', appShortName: 'Notes', background: '#0c322c' }, host);

    const blob = await rt.export({} as any, 'zip', {});
    assert.equal(blob.type, 'application/zip');
    // readZip verifies every CRC-32 and the central directory, so this is the
    // container check as well as the contents check.
    const entries = readZip(new Uint8Array(await blob.arrayBuffer()));
    assert.deepEqual(entries.map(e => e.name), [
      'favicon.ico', 'icon.svg', 'icon-192.png', 'icon-512.png',
      'icon-maskable-512.png', 'icon-monochrome-512.png', 'social-card.png', 'manifest.json',
    ]);

    // Each member is the render it claims to be: format, pixel size and face.
    assert.deepEqual(calls, [
      { format: 'ico', width: 512, height: 512, variant: 'icon', showGrid: false },
      { format: 'svg', width: 512, height: 512, variant: 'icon', showGrid: false },
      { format: 'png', width: 192, height: 192, variant: 'icon', showGrid: false },
      { format: 'png', width: 512, height: 512, variant: 'icon', showGrid: false },
      { format: 'png', width: 512, height: 512, variant: 'maskable', showGrid: false },
      { format: 'png', width: 512, height: 512, variant: 'monochrome', showGrid: false },
      { format: 'png', width: 1200, height: 630, variant: 'og', showGrid: false },
    ]);
    const text = (name: string) =>
      new TextDecoder().decode(entries.find(e => e.name === name)!.bytes);
    assert.equal(text('icon-maskable-512.png'), 'png:512x512:maskable');
    assert.equal(text('social-card.png'), 'png:1200x630:og');

    const manifest = JSON.parse(text('manifest.json'));
    assert.equal(manifest.name, 'Field Notes');
    for (const icon of manifest.icons) {
      assert.ok(entries.some(e => e.name === icon.src), `${icon.src} is named but not packed`);
    }
  });

  test('the toggles drop their members from the archive too', async () => {
    const calls: ComposeCall[] = [];
    const { host } = makeHost(calls);
    const rt = await mount({ maskable: false, monochrome: false }, host);
    const entries = readZip(new Uint8Array(await (await rt.export({} as any, 'zip', {})).arrayBuffer()));
    assert.deepEqual(entries.map(e => e.name), [
      'favicon.ico', 'icon.svg', 'icon-192.png', 'icon-512.png', 'social-card.png', 'manifest.json',
    ]);
    assert.equal(calls.length, 5);
  });

  test('every other format declines and takes the normal render path', async () => {
    const calls: ComposeCall[] = [];
    const { host, renders } = makeHost(calls);
    const rt = await mount({}, host);
    for (const format of ['png', 'svg', 'ico']) await rt.export({} as any, format, {});
    assert.deepEqual(renders.map(r => r.format), ['png', 'svg', 'ico']);
    assert.equal(calls.length, 0, 'a plain export must not trigger a nested render');
  });

  test('refuses a password rather than handing back an unlocked archive', async () => {
    const { host } = makeHost();
    const rt = await mount({}, host);
    await assert.rejects(() => rt.export({} as any, 'zip', { password: 'hunter2' } as any), /cannot be password protected/);
    await assert.rejects(() => rt.export({} as any, 'zip', { strongPassword: 'hunter2' } as any), /cannot be password protected/);
  });

  test('a lone social-card export leaves the square icon box behind', async () => {
    // The variant picker doubles as "export just this face", and the tool's own
    // render box is the 512 square every icon needs - the one shape a link
    // preview cannot use. A card asked for at that square default comes out at
    // the same 1200x630 the kit packs.
    const { host, renders } = makeHost();
    const og = await mount({ variant: 'og' }, host);
    await og.export({} as any, 'png', { width: 512, height: 512 } as any);
    await og.export({} as any, 'png', {} as any);
    assert.deepEqual(renders.map(r => [r.opts.width, r.opts.height]), [[1200, 630], [1200, 630]]);

    // A size the user actually chose is their framing, and so is a physical one.
    await og.export({} as any, 'png', { width: 800, height: 400 } as any);
    await og.export({} as any, 'png', { width: 100, height: 100, unit: 'mm' } as any);
    assert.deepEqual(renders.slice(2).map(r => [r.opts.width, r.opts.height]), [[800, 400], [100, 100]]);

    // Every other face keeps the square box it asked for.
    const { host: h2, renders: r2 } = makeHost();
    const icon = await mount({}, h2);
    await icon.export({} as any, 'png', { width: 512, height: 512 } as any);
    assert.deepEqual(r2.map(r => [r.opts.width, r.opts.height]), [[512, 512]]);
  });

  test('says so when the shell cannot render nested tools', async () => {
    const { host } = makeHost([], { compose: false });
    const rt = await mount({}, host);
    await assert.rejects(() => rt.export({} as any, 'zip', {}), /nested renders are unavailable/);
  });
});

// The hydrated output carries the tool's whole stylesheet, which names every
// face's classes. Only the markup after it says which face actually rendered.
const markupOf = (rt: any): string => (rt.getHydrated() as string).split('</style>')[1]!;
// The tile as the export sees it: the 16/32 px chips are an editor aid the export
// bridge detaches, so they must not decide any of these assertions.
const tileOf = (rt: any): string => markupOf(rt).split('favx-preview')[0]!;

describe('web-icon: the canvas faces', { skip: SKIP }, () => {
  test('the icon face is the default and carries none of the new markup', async () => {
    const rt = await mount({}, makeHost().host);
    assert.match(markupOf(rt), /data-variant="icon"/);
    assert.equal(markupOf(rt).includes('favx-og-name'), false);
    assert.equal(markupOf(rt).includes('<feColorMatrix'), false);
  });

  test('the monochrome face fills the art with the label colour, alpha kept', async () => {
    const rt = await mount({ variant: 'monochrome', image: { id: 'logo' }, color: '#3366cc' }, makeHost().host);
    const tile = tileOf(rt);
    assert.match(markupOf(rt), /data-variant="monochrome"/);
    // Colour matrix: RGB replaced by the constant, alpha row left as the source's.
    assert.match(tile, /values="0 0 0 0 0\.2 0 0 0 0 0\.4 0 0 0 0 0\.8 0 0 0 1 0"/);
    assert.match(tile, /<image href="asset:logo"[^>]*filter="url\(#favx-mono-ink\)"/);
    assert.equal(tile.includes('<img src="asset:logo"'), false, 'the plain image is replaced, not layered under');
  });

  test('an unresolvable colour paints the fallback, not the raw token alias', async () => {
    // No token bridge on this host, so both colour defaults arrive as the literal
    // `{color.semantic.*}`. A custom property set to that is invalid, which makes
    // every declaration reading it paint NOTHING - so the hook substitutes, and
    // the label ink and the monochrome matrix must substitute the SAME colour.
    const rt = await mount({ variant: 'monochrome', image: { id: 'logo' } }, makeHost().host);
    const markup = markupOf(rt);
    assert.equal(markup.includes('{color.semantic.'), false, 'a raw token alias reached the style attribute');
    assert.match(markup, /--fg:#ffffff;/);
    assert.match(markup, /--tile-bg:#0c322c;/);
    assert.match(tileOf(rt), /values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/);
  });

  test('an 8-digit hex ink keeps its channels instead of collapsing to the fallback', async () => {
    // #rrggbbaa is a colour CSS accepts and a token can flatten to. The matrix
    // takes the RGB; the alpha belongs to the source image, never to the ink.
    const rt = await mount({ variant: 'monochrome', image: { id: 'logo' }, color: '#3366cc80' }, makeHost().host);
    assert.match(tileOf(rt), /values="0 0 0 0 0\.2 0 0 0 0 0\.4 0 0 0 0 0\.8 0 0 0 1 0"/);
  });

  test('the social card shows the app name beside the icon', async () => {
    const rt = await mount({ variant: 'og', appName: 'Field Notes', appShortName: 'Notes' }, makeHost().host);
    const markup = markupOf(rt);
    assert.match(markup, /data-variant="og"/);
    assert.match(markup, /favx-og-name">Field Notes</);
    assert.match(markup, /favx-og-sub">Notes</);
  });

});

// The stylesheet, and the rules that make up the social-card face. Geometry is a
// browser's job, so these assert the two CSS facts a headless run CAN check - and
// both are facts a renderer would only reveal at a size nobody tests at.
const css = SKIP ? '' : (await readFile(join(COMMUNITY, 'web-icon', 'template.html'), 'utf8'))
  .split('</style>')[0]!
  .replace(/\/\*[\s\S]*?\*\//g, ''); // comments carry selectors and prose - never rules
const ogBlock = () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(m => ({ sel: m[1]!.trim(), body: m[2]! }));
  const of = (sel: string) => rules.filter(r => r.sel === sel).map(r => r.body).join(' ');
  return {
    stage: of('.favx-stage[data-variant="og"]'),
    tile: of('.favx-stage[data-variant="og"] .favx-tile'),
    rounded: of('.favx-stage[data-variant="og"] .favx-tile.shape-rounded'),
  };
};

describe('web-icon: the social card measures the render box, not the window', { skip: SKIP }, () => {
  test('no container-query unit sits on the stage\'s own box', () => {
    // An element is never its OWN query container: a cqh written here resolves
    // against the stage's nearest ANCESTOR container, and there is none, so it
    // falls back to the viewport - the card would inset itself by a share of the
    // browser window and export differently on every screen.
    const stage = ogBlock().stage;
    assert.ok(stage.trim(), 'the og stage rule vanished');
    for (const prop of ['padding', 'gap', 'margin', 'width', 'height', 'font-size', 'border-radius']) {
      const m = new RegExp(`(^|;)\\s*${prop}[^;]*cq`, 'i').exec(stage);
      assert.equal(m, null, `${prop} on the og stage is in cq units, which resolve against the viewport`);
    }
    // The inset still exists - moved onto the children, which DO resolve against
    // the stage because they are descendants of it.
    assert.match(ogBlock().tile, /margin:\s*10cqh 0 10cqh 10cqh/);
    assert.match(css, /\.favx-og\s*\{[^}]*margin:\s*10cqh 10cqh 10cqh 8cqh/);
  });

  test('the card is not painted the colour of the icon tile standing on it', () => {
    // Both were --tile-bg, so the tile was exactly the colour of the card behind
    // it and the icon disappeared into it. The card takes the ink colour and the
    // text the tile colour - a pair the brand already guarantees contrasts.
    const og = ogBlock();
    assert.match(og.stage, /background:\s*var\(--fg\)/);
    assert.equal(/background:\s*var\(--tile-bg\)/.test(og.stage), false);
    assert.match(css, /\.favx-og\s*\{[^}]*color:\s*var\(--tile-bg\)/);
  });

  test('the tile corner is restated against the tile, not the 1200x630 stage', () => {
    // .favx-tile carries container-type itself, so its base 20cqmin radius
    // resolves against the STAGE. That equals the tile on the square faces; here
    // cqmin is 630 while the tile is 62cqh, which rounds a third of it away.
    const [, tileCqh] = /width:\s*([\d.]+)cqh/.exec(ogBlock().tile) ?? [];
    const [, baseRadius] = /\.favx-tile\.shape-rounded\s*\{\s*border-radius:\s*([\d.]+)cqmin/.exec(css) ?? [];
    const [, ogRadius] = /border-radius:\s*([\d.]+)cqh/.exec(ogBlock().rounded) ?? [];
    assert.ok(tileCqh && baseRadius && ogRadius, 'the og tile size or either radius rule is missing');
    assert.equal(Number(ogRadius), Number(tileCqh) * Number(baseRadius) / 100,
      'the og radius is no longer the same fraction of the tile as every other face');
  });
});

describe('web-icon: seeds', { skip: SKIP }, () => {
  test('every example and template seed hydrates with no hook error', async () => {
    const seeds: Array<{ label: string; values: any }> = [{ label: 'defaults', values: {} }];
    for (const [i, ex] of ((tool.manifest.examples ?? []) as any[]).entries()) {
      seeds.push({ label: `example ${i}`, values: ex.values ?? ex.inputs ?? {} });
    }
    for (const t of (tool.templates ?? []) as any[]) {
      seeds.push({ label: `template ${t.id}`, values: t.values ?? {} });
      for (const p of (t.presets ?? []) as any[]) {
        seeds.push({ label: `preset ${t.id}/${p.id}`, values: { ...(t.values ?? {}), ...(p.values ?? {}) } });
      }
    }
    // Plus every face, which is what the kit renders whether or not seeds exist.
    for (const variant of ['icon', 'maskable', 'monochrome', 'og']) {
      seeds.push({ label: `face ${variant}`, values: { variant, image: { id: 'logo' } } });
    }
    for (const seed of seeds) {
      const warnings: string[] = [];
      const host = baseHost({
        compose: makeHost().host.compose,
        log: (level: string, msg: string) => { if (level !== 'debug') warnings.push(`${level}: ${msg}`); },
      });
      const rt = await createRuntime(tool, host, seed.values);
      assert.ok((rt.getHydrated() as string).includes('favx-tile'), `${seed.label} rendered no tile`);
      assert.deepEqual(warnings, [], `${seed.label} logged: ${warnings.join('; ')}`);
    }
  });
});
