// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly learning build` with saved tool sessions as sources.
 *
 * The first test renders a session through the real CLI path (Tier A, no browser) and
 * checks that the course packages the same bytes a direct `lolly <tool>` render gives.
 * The rest use a recording renderer to pin the page fan-out, the motion boundary and
 * every refusal, without starting a render.
 *
 * Hermetic like tests/reproducibility-rebuild.test.ts: a self-contained fixture repo
 * with LOLLY_ROOT pinned before the first import of the render path.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import type { LearningBlock, LearningModule } from '../packages/core/src/learning-v1.ts';
import { newLearningModule } from '../engine/src/learning/module.ts';

const root = await mkdtemp(join(tmpdir(), 'lolly-learning-cli-test-'));
after(() => rm(root, { recursive: true, force: true }));

const TOOL_ID = 'vector-mark';
const manifest = {
  id: TOOL_ID,
  name: TOOL_ID,
  version: '1.0.0',
  engineVersion: '^1.0.0',
  status: 'community',
  render: { width: 120, height: 80, formats: ['svg', 'png'] },
  inputs: [{ id: 'shade', type: 'color', label: 'Shade', default: '#3cb44b' }],
};
await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(
  join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({ version: '1', tools: [{ id: TOOL_ID }] })
);
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));
await mkdir(join(root, 'tools', TOOL_ID), { recursive: true });
await writeFile(join(root, 'tools', TOOL_ID, 'tool.json'), JSON.stringify(manifest));
await writeFile(
  join(root, 'tools', TOOL_ID, 'template.html'),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">' +
    '<rect x="4" y="4" width="112" height="72" fill="{{shade}}"/></svg>'
);

process.env.LOLLY_ROOT = root;
const { learningCli, renderLearningSession } = await import('../shells/cli/src/learning.ts');
const { runToolCli } = await import('../shells/cli/src/run.ts');
const { usageError } = await import('../shells/cli/src/exit-codes.ts');
// As the CLI entry does: the loader's unsigned-catalog notice is not payload.
(await import('../shells/cli/src/output.ts')).keepConsoleOffStdout();
type Renderer = import('../shells/cli/src/learning.ts').LearningSessionRenderer;

let seq = 0;
async function writeModule(module: LearningModule): Promise<string> {
  const dir = join(root, `module-${seq++}`);
  await mkdir(dir);
  const path = join(dir, 'module.json');
  await writeFile(path, JSON.stringify(module));
  return path;
}
function courseWith(block: LearningBlock): LearningModule {
  return {
    ...newLearningModule('session-course', 'Session course'),
    lessons: [{ id: 'lesson-one', title: 'Lesson one', required: true, blocks: [block] }],
  };
}
function sessionBlock(
  kind: LearningBlock['kind'],
  values: Record<string, unknown>,
  extra: Partial<NonNullable<LearningBlock['source']>> = {}
): LearningBlock {
  return {
    id: 'visual',
    kind,
    description: 'A rendered visual',
    source: { kind: 'session', toolId: TOOL_ID, toolVersion: '1.0.0', values, ...extra },
  };
}
async function quietly<T>(run: () => Promise<T>): Promise<{ result: T; stdout: string }> {
  const write = process.stdout.write;
  let stdout = '';
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    const done = rest.find((r) => typeof r === 'function') as (() => void) | undefined;
    done?.();
    return true;
  }) as typeof process.stdout.write;
  try {
    return { result: await run(), stdout };
  } finally {
    process.stdout.write = write;
  }
}

const png = (n: number) => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, n]);
const mp4 = () => new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
/** The fixture tool plus a logo picker and Design-shaped layers, for the recording renderer. */
const recordedInputs = [
  ...manifest.inputs,
  { id: 'logo', type: 'asset', label: 'Logo' },
  {
    id: 'boxes',
    type: 'blocks',
    label: 'Layers',
    fields: [
      { id: 'id', type: 'text', label: 'Id' },
      { id: 'kind', type: 'text', label: 'Kind' },
      { id: 'w', type: 'number', label: 'Width' },
      { id: 'h', type: 'number', label: 'Height' },
      { id: 'image', type: 'asset', label: 'Image' },
      { id: 'hidden', type: 'boolean', label: 'Hidden' },
    ],
  },
];
/** Records every render; `pages` page addresses answer, later positions find nothing. */
function recorder(
  over: Partial<{
    formats: string[];
    motion: boolean;
    pages: number;
    version: string;
    exitCode: number;
  }> = {}
) {
  const calls: Array<{ params: Record<string, string>; format: string }> = [];
  const renderer: Renderer = {
    async manifest() {
      return {
        ...manifest,
        inputs: recordedInputs,
        version: over.version ?? manifest.version,
        render: { ...manifest.render, formats: over.formats ?? ['svg', 'png'] },
      } as never;
    },
    async render(_toolId, params, format) {
      calls.push({ params, format });
      const position = Number(params.s);
      if (params.s && /^\d+$/.test(params.s) && position > (over.pages ?? 0))
        throw usageError(`--s=${params.s} names no slide in this document.`, 'SLIDE_NOT_FOUND');
      // As a real render does when its Rights block ends in a remaining decision.
      if (over.exitCode) process.exitCode = over.exitCode;
      return format === 'mp4' ? mp4() : png(calls.length);
    },
    async motionAvailable() {
      return over.motion ?? false;
    },
  };
  return { renderer, calls };
}

test('a saved session packages the same image a direct CLI render gives', async () => {
  const input = await writeModule(
    courseWith(
      sessionBlock('slides', { shade: '#123456', __export_width: 240, __export_height: 160 })
    )
  );
  const output = join(root, 'course.zip');
  const { stdout } = await quietly(() =>
    learningCli(['build', input], { format: 'static', output }, true)
  );
  const envelope = JSON.parse(stdout);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.result.renderedSessions, 1);

  const files = unzipSync(new Uint8Array(await readFile(output)));
  const content = JSON.parse(strFromU8(files['content.json']!));
  const [file] = content.lessons[0].blocks[0].files;
  assert.equal(file.mime, 'image/png');

  const direct = join(root, 'direct.png');
  await runToolCli({
    toolId: TOOL_ID,
    params: { shade: '#123456', width: '240', height: '160', 'no-provenance': '1' },
    outputPath: direct,
    format: 'png',
  });
  assert.deepEqual(files[file.path], new Uint8Array(await readFile(direct)));
});

test('each page of a paged session becomes one still at its own size, without provenance', async () => {
  const { renderer, calls } = recorder({ pages: 3 });
  const parts = await renderLearningSession(
    sessionBlock('slides', { shade: '#123456', __export_width: 640, __export_height: 360 }),
    renderer
  );
  assert.equal(parts.length, 3);
  assert.ok(parts.every((p) => p.mime === 'image/png'));
  assert.deepEqual(
    calls.map((c) => c.params.s),
    ['1', '2', '3', '4']
  );
  for (const { params, format } of calls) {
    assert.equal(format, 'png');
    assert.equal(params['no-provenance'], '1');
    assert.equal(params.shade, '#123456');
    assert.equal(params.width, undefined, 'a page keeps its authored size');
  }
});

test('the emoji set a session was drawn with reaches the render', async () => {
  const { renderer, calls } = recorder({ pages: 0 });
  // The web shell saves the set it installed on the device beside the choice. The CLI
  // takes the set from its own catalog, so these device refs are not a reason to stop.
  const pack = `user/emoji/${'3f'.repeat(32)}`;
  await renderLearningSession(
    sessionBlock('slides', {
      shade: '#123456',
      __emoji: { emoji: 'twemoji-color@17.0.3', emojifx: 'snap' },
      __emojiAssets: [
        {
          source: 'user',
          id: pack,
          type: 'data',
          format: 'json',
          pin: { version: '3f'.repeat(32), format: 'json' },
        },
      ],
      __emojiUsage: [
        { packId: 'twemoji-color', version: '17.0.3', checksum: 'sha256-x', assetId: pack },
      ],
    }),
    renderer
  );
  assert.equal(calls.at(-1)!.params.emoji, 'twemoji-color@17.0.3');
  assert.equal(calls.at(-1)!.params.emojifx, 'snap');
  assert.equal(calls.at(-1)!.params.emojistyle, undefined);
});

test('a session without pages renders once at its saved export size', async () => {
  const { renderer, calls } = recorder({ pages: 0 });
  const parts = await renderLearningSession(
    sessionBlock('slides', { shade: '#123456', __export_width: 640, __export_height: 360 }),
    renderer
  );
  assert.equal(parts.length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]!.params.s, undefined);
  assert.equal(calls[1]!.params.width, '640');
  assert.equal(calls[1]!.params.height, '360');
});

test('a page selection renders only the named frames, in order', async () => {
  const { renderer, calls } = recorder();
  const parts = await renderLearningSession(
    sessionBlock('slides', { shade: '#123456' }, { pageIds: ['frame-b', 'frame-a'] }),
    renderer
  );
  assert.equal(parts.length, 2);
  assert.deepEqual(
    calls.map((c) => c.params.s),
    ['frame-b', 'frame-a']
  );
  await assert.rejects(
    renderLearningSession(
      sessionBlock('slides', { shade: '#123456' }, { pageIds: ['2'] }),
      renderer
    ),
    (e: Error & { exit?: number }) => e.exit === 2 && /frame id/.test(e.message)
  );
  await assert.rejects(
    renderLearningSession(
      sessionBlock('video', { shade: '#123456' }, { pageIds: ['frame-a'] }),
      recorder({ formats: ['png', 'mp4'], motion: true }).renderer
    ),
    (e: Error & { exit?: number }) => e.exit === 2 && /still pages/.test(e.message)
  );
});

test('motion fails explicitly when no capable renderer is installed', async () => {
  const { renderer, calls } = recorder({ formats: ['png', 'mp4'], motion: false });
  await assert.rejects(
    renderLearningSession(sessionBlock('video', { shade: '#123456' }, { motion: true }), renderer),
    (e: Error & { exit?: number; kind?: string }) =>
      e.exit === 3 &&
      e.kind === 'MOTION_RENDERER_UNAVAILABLE' &&
      /lolly install-browser/.test(e.message)
  );
  assert.equal(calls.length, 0, 'nothing was rendered');
});

test('motion renders at the shared frame size when a capable renderer is installed', async () => {
  const frames = [
    { id: 'a', kind: 'frame', w: 1280, h: 720 },
    { id: 'b', kind: 'frame', w: 1280, h: 720 },
    { id: 'c', kind: 'frame', w: 300, h: 300, hidden: true },
  ];
  const { renderer, calls } = recorder({ formats: ['png', 'mp4'], motion: true });
  const [part] = await renderLearningSession(
    sessionBlock(
      'video',
      { boxes: frames, __export_unit: 'mm', __export_dpi: 300 },
      { motion: true }
    ),
    renderer
  );
  assert.equal(part!.mime, 'video/mp4');
  assert.equal(calls[0]!.format, 'mp4');
  assert.equal(calls[0]!.params.width, '1280');
  assert.equal(calls[0]!.params.height, '720');
  assert.equal(calls[0]!.params.unit, undefined);
  assert.equal(calls[0]!.params.dpi, undefined);

  frames[1]!.w = 640;
  await assert.rejects(
    renderLearningSession(sessionBlock('video', { boxes: frames }), renderer),
    /equally sized frames/
  );
});

test('a tool without the chosen rendition is refused before rendering', async () => {
  const { renderer, calls } = recorder({ formats: ['svg'] });
  await assert.rejects(
    renderLearningSession(sessionBlock('slides', { shade: '#123456' }), renderer),
    (e: Error & { exit?: number; kind?: string }) =>
      e.exit === 2 && e.kind === 'LEARNING_NO_RENDITION'
  );
  assert.equal(calls.length, 0);
});

test('a rendition this CLI cannot package is refused before rendering', async () => {
  const { renderer, calls } = recorder({ formats: ['opus'] });
  await assert.rejects(
    renderLearningSession(sessionBlock('audio', { shade: '#123456' }), renderer),
    (e: Error & { exit?: number; kind?: string }) =>
      e.exit === 3 && e.kind === 'LEARNING_FORMAT_UNAVAILABLE' && /opus/.test(e.message)
  );
  assert.equal(calls.length, 0);
});

test('files uploaded on the saving device are refused rather than dropped', async () => {
  const { renderer, calls } = recorder();
  for (const values of [
    { logo: 'user/7f3a9c' },
    { logo: { source: 'user', id: 'user/7f3a9c', type: 'raster', format: 'png' } },
    {
      boxes: [
        { id: 'a', kind: 'image', image: { source: 'user', id: 'user/photo', type: 'raster' } },
      ],
    },
  ])
    await assert.rejects(
      renderLearningSession(sessionBlock('slides', values), renderer),
      (e: Error & { exit?: number; kind?: string }) =>
        e.exit === 2 && e.kind === 'LEARNING_DEVICE_FILE'
    );
  assert.equal(calls.length, 0);
});

test('only values the render reads are checked for device files', async () => {
  const { renderer, calls } = recorder({ pages: 0 });
  await renderLearningSession(
    sessionBlock('slides', {
      shade: '#123456',
      logo: { source: 'library', id: 'lolly/logo/primary', type: 'vector', format: 'svg' },
      // A layer's undeclared keys and the session's own metadata are never rendered.
      boxes: [{ id: 'a', kind: 'text', note: 'user/scratch' }],
      __thumbnail: { source: 'user', id: 'user/thumb' },
    }),
    renderer
  );
  assert.equal(calls.at(-1)!.params.logo, 'lolly/logo/primary');
});

test('an asset path outside the module is refused and nothing is read', async () => {
  const outside = join(root, 'outside');
  await mkdir(outside, { recursive: true });
  const secret = join(outside, 'secret.svg');
  await writeFile(secret, '<svg xmlns="http://www.w3.org/2000/svg"><!-- PRIVATE --></svg>');
  const { renderer, calls } = recorder();
  const ids = [secret, '../outside/secret.svg', './secret.svg', '~/secret.svg', 'a/../../x.png'];
  // A bare name the render would find in the working directory is a local file too.
  if (existsSync('package.json')) ids.push('package.json');
  for (const id of ids)
    await assert.rejects(
      renderLearningSession(
        sessionBlock('slides', { logo: { source: 'library', id, type: 'vector' } }),
        renderer
      ),
      (e: Error & { exit?: number; kind?: string }) =>
        e.exit === 2 && e.kind === 'LEARNING_LOCAL_PATH' && /local file source/.test(e.message),
      id
    );
  assert.equal(calls.length, 0, 'nothing was rendered, so no file was read');

  const input = await writeModule(
    courseWith(sessionBlock('slides', { logo: { source: 'library', id: secret } }))
  );
  const output = join(root, 'local-path.zip');
  await assert.rejects(
    quietly(() => learningCli(['build', input], { format: 'static', output }, false, renderer)),
    (e: Error & { exit?: number; kind?: string }) =>
      e.exit === 2 && e.kind === 'LEARNING_LOCAL_PATH' && e.message.startsWith('Lesson one: ')
  );
  assert.equal(existsSync(output), false);
});

test('a render that leaves a rights decision makes the build exit 4 with ok false', async () => {
  const input = await writeModule(courseWith(sessionBlock('slides', { shade: '#123456' })));
  const output = join(root, 'rights.zip');
  const before = process.exitCode;
  try {
    const { stdout } = await quietly(() =>
      learningCli(
        ['build', input],
        { format: 'static', output },
        true,
        recorder({ pages: 0, exitCode: 4 }).renderer
      )
    );
    const envelope = JSON.parse(stdout);
    assert.equal(envelope.ok, false);
    assert.deepEqual(envelope.result.rightsDecisionsRequired, ['visual']);
    assert.equal(process.exitCode, 4);
    assert.equal(existsSync(output), true, 'the package is written, as a single render is');
  } finally {
    process.exitCode = before;
  }

  const clean = join(root, 'rights-clean.zip');
  const { stdout } = await quietly(() =>
    learningCli(['build', input], { format: 'static', output: clean }, true, recorder().renderer)
  );
  assert.equal(JSON.parse(stdout).ok, true);
  assert.deepEqual(JSON.parse(stdout).result.rightsDecisionsRequired, []);
  assert.equal(process.exitCode, before);
});

test('a failed source keeps its exit code and lesson title, and writes no package', async () => {
  const input = await writeModule(courseWith(sessionBlock('video', { shade: '#123456' })));
  const output = join(root, 'refused.zip');
  await assert.rejects(
    quietly(() =>
      learningCli(
        ['build', input],
        { format: 'scorm12', output },
        false,
        recorder({ formats: ['mp4'] }).renderer
      )
    ),
    (e: Error & { exit?: number; kind?: string }) =>
      e.exit === 3 &&
      e.kind === 'MOTION_RENDERER_UNAVAILABLE' &&
      e.message.startsWith('Lesson one: ')
  );
  assert.equal(existsSync(output), false);
});
