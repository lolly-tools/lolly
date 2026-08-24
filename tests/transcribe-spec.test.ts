// SPDX-License-Identifier: MPL-2.0
/**
 * `render.transcribe` and the srt/vtt sibling formats (engine 1.150, plans/147
 * T1a) - the manifest half of "transcription is declared, not built".
 *
 * The shell behaviour lives with the shell (shells/web/src/views/
 * transcribe-control.test.ts). What is pinned HERE is the contract every shell
 * reads: the declaration validates, a typo does not, the two new formats are
 * loadable sibling text templates that export model-derived text, and a manifest
 * that says nothing about transcription is completely unaffected.
 *
 * Run with: node --test tests/transcribe-spec.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateManifest } from '../engine/src/validate.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

/** A minimal valid manifest; `render` is merged over the default block. */
function manifest(render: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'captions-fixture',
    name: 'Captions fixture',
    version: '1.0.0',
    engineVersion: '>=1.150.0',
    status: 'official',
    category: 'utility',
    render: { width: 1920, height: 1080, formats: ['png'], ...render },
    inputs: [
      { id: 'clip', type: 'asset', label: 'Clip' },
      { id: 'captions', type: 'longtext', label: 'Captions' },
      { id: 'autoCaption', type: 'boolean', label: 'Caption automatically', default: false },
    ],
    ...extra,
  };
}

const ok = (m: unknown): boolean => validateManifest(m).valid;
const why = (m: unknown): string => validateManifest(m).errors.map((e) => `${e.path} ${e.message}`).join('; ');

// ── The declaration ───────────────────────────────────────────────────────────

test('a full render.transcribe declaration validates', () => {
  const m = manifest({ transcribe: { source: 'clip', target: 'captions', format: 'srt', auto: 'autoCaption' } });
  assert.ok(ok(m), why(m));
});

test('source and target alone are enough - format defaults to srt', () => {
  const m = manifest({ transcribe: { source: 'clip', target: 'captions' } });
  assert.ok(ok(m), why(m));
});

test('a declaration missing either half is refused', () => {
  assert.equal(ok(manifest({ transcribe: { source: 'clip' } })), false, 'no target');
  assert.equal(ok(manifest({ transcribe: { target: 'captions' } })), false, 'no source');
  assert.equal(ok(manifest({ transcribe: {} })), false, 'neither');
});

test('an unknown format or a stray key is refused, not silently ignored', () => {
  assert.equal(ok(manifest({ transcribe: { source: 'clip', target: 'captions', format: 'ass' } })), false);
  assert.equal(ok(manifest({ transcribe: { source: 'clip', target: 'captions', model: 'whisper-large' } })), false);
});

test('every documented format value validates', () => {
  for (const format of ['srt', 'vtt', 'words']) {
    const m = manifest({ transcribe: { source: 'clip', target: 'captions', format } });
    assert.ok(ok(m), `${format}: ${why(m)}`);
  }
});

test('srt and vtt are declarable export formats', () => {
  const m = manifest({ formats: ['png', 'srt', 'vtt'] });
  assert.ok(ok(m), why(m));
});

// ── The sibling text templates ────────────────────────────────────────────────

/** An in-memory pack: the fixture tool with whatever files a case gives it. */
function fetchFileFor(files: Record<string, string>) {
  return async (path: string): Promise<string> => {
    const hit = files[path];
    if (hit == null) throw new Error(`not found: ${path}`);
    return hit;
  };
}

/** A wrapping export.render, like the CLI bridge: the engine hands the hydrated
 *  sibling-template text through opts.dataText, so the blob is the real export. */
function exportHost(): any {
  return baseHost({
    export: {
      render: async (_n: unknown, _f: string, opts: any) =>
        new Blob([opts.dataText ?? '<no-data>'], { type: opts.dataMime ?? 'text/plain' }),
    },
  });
}

const CUES = '1\n00:00:00,000 --> 00:00:00,900\nHello there.\n';

test('a tool with template.srt exports its hydrated text as text/plain', async () => {
  const files = {
    'captions-fixture/tool.json': JSON.stringify(manifest({
      formats: ['png', 'srt'],
      transcribe: { source: 'clip', target: 'captions' },
    })),
    'captions-fixture/template.html': '<div class="cap">{{captions}}</div>',
    'captions-fixture/template.srt': '{{captions}}',
  };
  const tool = await loadTool('captions-fixture', fetchFileFor(files));
  assert.equal(tool.textTemplates.srt, '{{captions}}', 'the loader fetched the sibling');
  const rt = await createRuntime(tool, exportHost(), { captions: CUES });
  const blob = await rt.export({} as never, 'srt', { embedMeta: false } as never);
  assert.equal(blob.type, 'text/plain');
  // Raw hydration: a cue block must survive verbatim, arrows and all.
  assert.equal(await blob.text(), CUES);
});

test('template.vtt exports as text/vtt', async () => {
  const files = {
    'captions-fixture/tool.json': JSON.stringify(manifest({ formats: ['png', 'vtt'] })),
    'captions-fixture/template.html': '<div>{{captions}}</div>',
    'captions-fixture/template.vtt': 'WEBVTT\n\n{{captions}}',
  };
  const tool = await loadTool('captions-fixture', fetchFileFor(files));
  const rt = await createRuntime(tool, exportHost(), { captions: '00:00:00.000 --> 00:00:00.900\nHello there.' });
  const blob = await rt.export({} as never, 'vtt', { embedMeta: false } as never);
  assert.equal(blob.type, 'text/vtt');
  assert.match(await blob.text(), /^WEBVTT\n\n00:00:00\.000 --> /);
});

// A host that cannot serve the sibling reports WHY (missing vs. failed to load);
// either way the export fails visibly rather than writing an empty file.
test('declaring srt with no template.srt fails the export loudly', async () => {
  const files = {
    'captions-fixture/tool.json': JSON.stringify(manifest({ formats: ['png', 'srt'] })),
    'captions-fixture/template.html': '<div>{{captions}}</div>',
  };
  const tool = await loadTool('captions-fixture', fetchFileFor(files));
  const rt = await createRuntime(tool, exportHost(), {});
  await assert.rejects(
    () => rt.export({} as never, 'srt', { embedMeta: false } as never),
    /template\.srt/,
  );
});

// ── An old manifest is untouched ──────────────────────────────────────────────

test('a manifest with no transcribe key loads and exports exactly as before', async () => {
  const files = {
    'captions-fixture/tool.json': JSON.stringify(manifest()),
    'captions-fixture/template.html': '<div>{{captions}}</div>',
  };
  const tool = await loadTool('captions-fixture', fetchFileFor(files));
  assert.equal(tool.manifest.render.transcribe, undefined);
  assert.deepEqual(tool.textTemplates, {}, 'no sibling text template was even looked for');
  const rt = await createRuntime(tool, baseHost(), { captions: 'typed by hand' });
  assert.match(rt.getHydrated() as string, /typed by hand/);
});
