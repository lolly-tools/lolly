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
/** Records every render; `pages` page addresses answer, later positions find nothing. */
function recorder(
  over: Partial<{ formats: string[]; motion: boolean; pages: number; version: string }> = {}
) {
  const calls: Array<{ params: Record<string, string>; format: string }> = [];
  const renderer: Renderer = {
    async manifest() {
      return {
        ...manifest,
        version: over.version ?? manifest.version,
        render: { ...manifest.render, formats: over.formats ?? ['svg', 'png'] },
      } as never;
    },
    async render(_toolId, params, format) {
      calls.push({ params, format });
      const position = Number(params.s);
      if (params.s && /^\d+$/.test(params.s) && position > (over.pages ?? 0))
        throw usageError(`--s=${params.s} names no slide in this document.`, 'SLIDE_NOT_FOUND');
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
  await renderLearningSession(
    sessionBlock('slides', {
      shade: '#123456',
      __emoji: { emoji: 'twemoji-color@17.0.3', emojifx: 'snap' },
      __emojiAssets: [],
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
      e.exit === 3 && e.kind === 'LEARNING_RENDITION_UNAVAILABLE'
  );
  assert.equal(calls.length, 0);
});

test('files uploaded on the saving device are refused rather than dropped', async () => {
  const { renderer, calls } = recorder();
  for (const values of [
    { logo: 'user/7f3a9c' },
    { boxes: [{ kind: 'image', src: { source: 'user', id: 'user/photo', type: 'raster' } }] },
  ])
    await assert.rejects(
      renderLearningSession(sessionBlock('slides', values), renderer),
      (e: Error & { exit?: number; kind?: string }) =>
        e.exit === 3 && e.kind === 'LEARNING_DEVICE_FILE'
    );
  assert.equal(calls.length, 0);
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
