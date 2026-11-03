// SPDX-License-Identifier: MPL-2.0
/**
 * 3D Studio compatibility renders (plan 265, tasks A4 and A6).
 *
 * "live colour edits" runs everywhere Chromium is installed: a colour A edit reaches
 * STL models and words within one mount, without reading or shaping them again.
 *
 * "pushed renderer" renders the pinned value sets (tests/fixtures/studio3d/recipes) with
 * the pushed 3D Studio 0.4.0 (commit 05faef7a4, extracted with git archive into a
 * temporary folder) and with this checkout, in two pages of one browser, and compares
 * the RGBA bytes exactly. It needs that commit, so a shallow checkout (CI) skips it.
 *   STUDIO_SHOTS=<dir>        saves both renders of every set, plus a diff image when
 *                             they differ, and compat-summary.json.
 *   STUDIO_NATIVE=1           renders on the Metal backend instead of SwiftShader.
 *   STUDIO_COMPAT_SELF=1      compares the pushed renderer with a second copy of itself,
 *                             which shows whether a backend renders these sets repeatably.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { Page } from 'playwright';
import {
  type StudioFrame,
  type StudioHarness,
  type StudioValues,
  saveShot,
  startStudioHarness,
  studioSkip,
} from './helpers/studio3d-browser.ts';

const root = resolve(import.meta.dirname, '..');
const PINNED = '05faef7a4';
const MOUNT = 'shells/web/src/lib/studio3d/mount.ts';
const SIZE = 256;
const SAMPLES = 8;

interface ClockSize {
  width: number;
  height: number;
}

declare global {
  interface Window {
    /** Page helpers added by tests/studio3d-compat.browser.test.ts. */
    studioCompat?: {
      clock(time: number, seconds: number | undefined, size: ClockSize): StudioFrame;
      diff(width: number, height: number, a: number[], b: number[]): string;
    };
  }
}

/** Page code for both bundles: a clocked export frame, and a diff image of two frames. */
const COMPAT_SOURCE = `
window.studioCompat = {
  clock(time, seconds, size) {
    const canvas = studioCanvas();
    const was = canvas.__lollyFrameDriven === true;
    canvas.__lollyFrameDriven = true;
    try {
      canvas.__lollyFrameRender(time, seconds, size);
      return readFrame(container.querySelector('[data-lolly-studio]'), canvas);
    } finally {
      canvas.__lollyFrameDriven = was;
    }
  },
  diff(width, height, a, b) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);
    for (let i = 0; i < a.length; i += 4) {
      let delta = 0;
      for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(a[i + c] - b[i + c]));
      // Unchanged pixels show as a dim grey copy; changed ones as red, brighter when larger.
      const grey = Math.round((a[i] + a[i + 1] + a[i + 2]) / 12);
      image.data.set(delta ? [Math.min(255, 96 + delta * 4), 0, 0, 255] : [grey, grey, grey, 255], i);
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL();
  },
};
`;

interface Compared {
  changed: number;
  maxDelta: number;
}

function compare(a: StudioFrame, b: StudioFrame): Compared {
  if (a.width !== b.width || a.height !== b.height)
    return { changed: Math.max(a.width * a.height, b.width * b.height), maxDelta: 255 };
  let changed = 0,
    maxDelta = 0;
  for (let i = 0; i < a.pixels.length; i += 4) {
    let delta = 0;
    for (let c = 0; c < 4; c++)
      delta = Math.max(delta, Math.abs(a.pixels[i + c]! - b.pixels[i + c]!));
    if (delta) {
      changed++;
      maxDelta = Math.max(maxDelta, delta);
    }
  }
  return { changed, maxDelta };
}

function recipe(id: string): Promise<StudioValues> {
  return readFile(
    join(root, 'tests', 'fixtures', 'studio3d', 'recipes', `${id}.json`),
    'utf8'
  ).then((text) => {
    const parsed: { values: StudioValues } = JSON.parse(text);
    return { ...parsed.values, samples: SAMPLES };
  });
}

/**
 * The harness tetrahedron as binary STL with real facet normals. The /binary.stl fixture
 * writes zero normals, which three's STL loader keeps, and that used to render as a black
 * solid showing neither its colour nor its finish. The studio now computes the normals
 * from the triangles, which is why the `stl` set is a listed correction (CORRECTIONS
 * below); this set, whose file carries real normals, is unchanged by it.
 */
function litStl(): Uint8Array {
  const corners = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ] as const;
  const faces = [
    [0, 2, 1],
    [0, 1, 3],
    [0, 3, 2],
    [1, 2, 3],
  ] as const;
  const bytes = new Uint8Array(84 + faces.length * 50);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, faces.length, true);
  for (const [i, face] of faces.entries()) {
    const [a, b, c] = [corners[face[0]], corners[face[1]], corners[face[2]]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [
      u[1]! * v[2]! - u[2]! * v[1]!,
      u[2]! * v[0]! - u[0]! * v[2]!,
      u[0]! * v[1]! - u[1]! * v[0]!,
    ];
    const length = Math.hypot(n[0]!, n[1]!, n[2]!);
    const values = [...n.map((x) => x / length), ...a, ...b, ...c];
    for (const [j, x] of values.entries()) view.setFloat32(84 + i * 50 + j * 4, x, true);
  }
  return bytes;
}

const LIT_STL = { id: 'lit', url: '/lit.stl', name: 'lit.stl' };
const ROUTES = { '/lit.stl': litStl() };

describe('3D Studio live colour edits', { skip: studioSkip }, () => {
  let harness: StudioHarness | undefined;
  const studio = () => {
    if (!harness) throw new Error('The 3D Studio harness did not start.');
    return harness;
  };
  before(async () => {
    harness = await startStudioHarness({ size: SIZE, routes: ROUTES });
  });
  after(async () => {
    await harness?.close();
  });

  /** Mean red and green over the fully opaque pixels. */
  const tint = (frame: StudioFrame) => {
    let red = 0,
      green = 0,
      n = 0;
    for (let i = 0; i < frame.pixels.length; i += 4)
      if (frame.pixels[i + 3] === 255) {
        red += frame.pixels[i]!;
        green += frame.pixels[i + 1]!;
        n++;
      }
    return { red: red / Math.max(1, n), green: green / Math.max(1, n), n };
  };

  const recolour = async (page: Page, values: StudioValues) => {
    const first = await studio().render(page, { ...values, colorA: '#30ba78' });
    const shaped = await page.evaluate(() => window.shaped?.length ?? 0);
    const edited = await studio().render(page, { ...values, colorA: '#ff0000' });
    const shapedAfterEdit = await page.evaluate(() => window.shaped?.length ?? 0);
    await page.evaluate(() => window.studioTest!.destroy());
    const fresh = await studio().render(page, { ...values, colorA: '#ff0000' });
    for (const frame of [first, edited, fresh]) assert.equal(frame.state, 'ready', frame.info);
    let objectChanged = 0;
    for (let i = 0; i < first.pixels.length; i += 4)
      if (
        first.pixels[i + 3]! > 0 &&
        [0, 1, 2].some((c) => first.pixels[i + c] !== edited.pixels[i + c])
      )
        objectChanged++;
    return { first, edited, fresh, shaped, shapedAfterEdit, objectChanged };
  };

  it('recolours an STL model within one mount, without reading it again', async () => {
    const page = await studio().open();
    try {
      const run = await recolour(page, {
        source: 'model',
        modelAsset: LIT_STL,
        outputMode: 'object',
      });
      await saveShot('colour-stl-first.png', run.first.png);
      await saveShot('colour-stl-edited.png', run.edited.png);
      await saveShot('colour-stl-fresh.png', run.fresh.png);
      assert.ok(run.objectChanged > 100, `only ${run.objectChanged} object pixels changed`);
      assert.equal(run.edited.reused, true);
      assert.equal(run.edited.reads, run.first.reads, 'a colour edit does not read the model');
      assert.equal(run.fresh.reads, run.first.reads + 1);
      const tone = tint(run.edited);
      assert.ok(tone.n > 100 && tone.red > tone.green, JSON.stringify(tone));
      assert.deepEqual(compare(run.edited, run.fresh), { changed: 0, maxDelta: 0 });
    } finally {
      await page.close();
    }
  });

  it('recolours words within one mount, without shaping them again', async () => {
    const page = await studio().open();
    try {
      const run = await recolour(page, { source: 'text', words: 'Hi', outputMode: 'object' });
      await saveShot('colour-words-first.png', run.first.png);
      await saveShot('colour-words-edited.png', run.edited.png);
      await saveShot('colour-words-fresh.png', run.fresh.png);
      assert.ok(run.objectChanged > 100, `only ${run.objectChanged} object pixels changed`);
      assert.equal(run.edited.reused, true);
      assert.ok(run.shaped > 0);
      assert.equal(run.shapedAfterEdit, run.shaped, 'a colour edit does not shape the words again');
      const tone = tint(run.edited);
      assert.ok(tone.n > 100 && tone.red > tone.green, JSON.stringify(tone));
      assert.deepEqual(compare(run.edited, run.fresh), { changed: 0, maxDelta: 0 });
    } finally {
      await page.close();
    }
  });

  it('has no browser or shader errors', () => assert.deepEqual(studio().errors, []));
});

function hasCommit(commit: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const pushedSkip =
  studioSkip ||
  (!hasCommit(PINNED) &&
    `Commit ${PINNED} is not in this clone (shallow checkout); the compatibility render gate runs on a full clone`);

/**
 * Renders compared with the pushed renderer: [name, value set, values laid over it].
 * 03-defaults is the scene output.
 */
const SETS: [string, string, StudioValues?][] = [
  ['defaults', '03-defaults'],
  ['artwork', '03-artwork'],
  ['glb', '03-model-glb'],
  ['stl', '03-model-stl'],
  ['stl-lit', '03-model-stl', { modelAsset: LIT_STL }],
  ['custom-rig', '03-custom-rig'],
  ['pair', '03-pair'],
  ['custom-duck', '03-custom-duck'],
  ['depth-copies', '03-atmosphere'],
  ['depth-spheres', '04-atmosphere-spheres-0.5'],
  ['pedestal', '03-pedestal'],
  ['object-shadow', '03-output-object-shadow'],
  ['object', '03-output-object'],
  ['position-right', '03-position-right'],
  ['position-left', '03-position-left'],
  ['scale-max', '03-scale-max'],
  ['scale-min', '03-scale-min'],
  ['rotation-max', '03-rotation-max'],
  ['painted-environment', '04-env-desert-shown'],
  ['words', '04-text-front'],
];

/**
 * Sets a backend does not render repeatably, with the largest drift accepted and the
 * reason. Empty: SwiftShader and Metal render every set above byte for byte.
 */
const TOLERANCES: Record<string, { maxDelta: number; changedFraction: number; reason: string }> =
  {};

/**
 * Sets whose difference from the pushed renderer is an accepted correction, with the
 * decision that accepted it. A listed set must still differ.
 */
const CORRECTIONS: Record<string, string> = {
  stl:
    'Q14, accepted by Andy on 2026-09-17 with the milestone 2 hand-off: an STL whose facet normals are all zero rendered as a black solid, so the file showed neither its colour nor its finish. The studio now computes the normals from the triangles when the file carries none, and reports that in Source notes. The stl-lit set, whose file has real normals, is unchanged.',
  'painted-environment':
    'Q6, accepted by Andy on 2026-09-17: painted panoramas are no longer mirrored, so reflections and the crisp background agree with the lamps',
};

describe('3D Studio pushed renderer compatibility', { skip: pushedSkip }, () => {
  let harness: StudioHarness | undefined;
  let extracted: string | undefined;
  let pushed: Page | undefined;
  let current: Page | undefined;
  let backend = 'unknown';
  const self = Boolean(process.env.STUDIO_COMPAT_SELF);
  const summary: Record<string, Compared & { ms: number; info?: [string, string] }> = {};

  before(async () => {
    extracted = await mkdtemp(join(tmpdir(), 'lolly-studio-pushed-'));
    const archive = join(extracted, 'pushed.tar');
    execFileSync(
      'git',
      [
        'archive',
        '--format=tar',
        '-o',
        archive,
        PINNED,
        'shells/web/src',
        'engine/src',
        'packages/core/src',
      ],
      { cwd: root, stdio: 'ignore' }
    );
    execFileSync('tar', ['-xf', archive, '-C', extracted], { stdio: 'ignore' });
    await rm(archive);
    const spec = {
      resolveDir: extracted,
      mountModule: MOUNT,
      nodePaths: [join(root, 'node_modules'), join(root, 'shells', 'web', 'node_modules')],
      extraSource: COMPAT_SOURCE,
    };
    harness = await startStudioHarness({
      size: SIZE,
      routes: ROUTES,
      extraSource: COMPAT_SOURCE,
      bundles: self ? { pushed: spec, twin: spec } : { pushed: spec },
    });
    pushed = await harness.open('pushed');
    current = await harness.open(self ? 'twin' : undefined);
    backend = await harness.rendererName(current);
  });

  after(async () => {
    try {
      await harness?.close();
    } finally {
      if (extracted) await rm(extracted, { recursive: true, force: true });
      if (process.env.STUDIO_SHOTS && Object.keys(summary).length) {
        await mkdir(process.env.STUDIO_SHOTS, { recursive: true });
        await writeFile(
          join(process.env.STUDIO_SHOTS, 'compat-summary.json'),
          `${JSON.stringify({ backend, self, pinned: PINNED, size: SIZE, samples: SAMPLES, sets: summary }, null, 2)}\n`
        );
      }
      console.log(`compat backend: ${backend}${self ? ' (pushed against itself)' : ''}`);
    }
  });

  const pages = () => {
    if (!pushed || !current) throw new Error('The compatibility pages did not open.');
    return { pushed, current };
  };

  const check = async (name: string, frames: () => Promise<[StudioFrame, StudioFrame]>) => {
    const started = Date.now();
    const [was, now] = await frames();
    const result = compare(was, now);
    summary[name] = {
      ...result,
      ms: Date.now() - started,
      ...(was.info !== now.info ? { info: [was.info, now.info] as [string, string] } : {}),
    };
    await saveShot(`compat-${name}-pushed.png`, was.png);
    await saveShot(`compat-${name}-current.png`, now.png);
    if (result.changed)
      await saveShot(
        `compat-${name}-diff.png`,
        await pages().current.evaluate(
          ({ width, height, a, b }) => window.studioCompat!.diff(width, height, a, b),
          { width: was.width, height: was.height, a: was.pixels, b: now.pixels }
        )
      );
    console.log(
      `compat ${name}: ${result.changed ? `${result.changed} pixels differ, largest channel change ${result.maxDelta}` : 'identical'} (${Date.now() - started} ms)`
    );
    assert.equal(was.state, 'ready', `${name} (pushed): ${was.info}`);
    assert.equal(now.state, 'ready', `${name} (current): ${now.info}`);
    assert.deepEqual([now.width, now.height], [was.width, was.height]);
    const correction = CORRECTIONS[name];
    if (correction) {
      assert.ok(
        result.changed > 0,
        `${name} is listed as a correction (${correction}) but renders as before`
      );
      return;
    }
    const tolerance = TOLERANCES[name];
    if (tolerance) {
      assert.ok(
        result.maxDelta <= tolerance.maxDelta &&
          result.changed / (was.width * was.height) <= tolerance.changedFraction,
        `${name}: ${JSON.stringify(result)} is beyond its tolerance (${tolerance.reason})`
      );
      return;
    }
    assert.deepEqual(
      result,
      { changed: 0, maxDelta: 0 },
      `${name} differs from the pushed renderer`
    );
  };

  for (const [name, set, extra] of SETS)
    it(`renders ${name} (${set}) as the pushed renderer does`, async () => {
      const values = { ...(await recipe(set)), ...extra };
      const { pushed, current } = pages();
      await check(name, async () => [
        await harness!.render(pushed, values),
        await harness!.render(current, values),
      ]);
    });

  it('resamples an export at another size as the pushed renderer does', async () => {
    const values = await recipe('03-defaults');
    const size = { width: 512, height: 512 };
    const { pushed, current } = pages();
    await check('resampled-export', async () => {
      const frames: StudioFrame[] = [];
      for (const page of [pushed, current]) {
        await harness!.render(page, values);
        frames.push(
          await page.evaluate((size) => window.studioCompat!.clock(0, undefined, size), size)
        );
      }
      assert.deepEqual([frames[0]!.width, frames[0]!.height], [512, 512]);
      return [frames[0]!, frames[1]!];
    });
  });

  it('renders a clip frame as the pushed renderer does', async () => {
    const values = await recipe('04-video-samples');
    const size = { width: SIZE, height: SIZE };
    const { pushed, current } = pages();
    await check('clip-frame', async () => {
      const frames: StudioFrame[] = [];
      for (const page of [pushed, current]) {
        await harness!.render(page, values);
        frames.push(await page.evaluate((size) => window.studioCompat!.clock(0.25, 5, size), size));
      }
      return [frames[0]!, frames[1]!];
    });
  });

  it('has no browser or shader errors', () => assert.deepEqual(harness?.errors, []));
});
