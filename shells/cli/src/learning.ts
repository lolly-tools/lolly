// SPDX-License-Identifier: MPL-2.0
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { LearningBlock, LearningTarget } from '@lolly-tools/core/learning-v1';
import { parseLearningModule, checkLearningModule } from '../../../engine/src/learning/module.ts';
import { compileLearningModule, type LearningBytes } from '../../../engine/src/learning/compile.ts';
import {
  learningRenditions,
  type LearningRenderable,
} from '../../../engine/src/learning/delivery.ts';
import { buildLearningPackage } from '../../../packages/learning-player/src/package.ts';
import type { sessionToParams } from './rebuild.ts';
import { emitResult } from './envelope.ts';
import { CliError, errorKind, exitCodeFor, unavailableHere, usageError } from './exit-codes.ts';
import { note, writeOut } from './output.ts';

const mimes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  txt: 'text/plain',
};

/** The same bound the module schema puts on a source's page selection. */
const MAX_PAGES = 200;

export type LearningSessionManifest = Parameters<typeof sessionToParams>[0] &
  LearningRenderable & { id: string; version?: string };

/** How a saved tool session becomes files. Tests replace it; the CLI uses its normal tool render path. */
export interface LearningSessionRenderer {
  /** The installed tool's manifest. Throws when the tool is not installed. */
  manifest(toolId: string): Promise<LearningSessionManifest>;
  /** Render one file through the tool and return its bytes. */
  render(toolId: string, params: Record<string, string>, format: string): Promise<Uint8Array>;
  /** Whether a renderer that can record motion is reachable here. */
  motionAvailable(): Promise<boolean>;
}

export const cliSessionRenderer: LearningSessionRenderer = {
  async manifest(toolId) {
    const { loadToolOrThrow, readToolFile } = await import('./run.ts');
    return (await loadToolOrThrow(toolId, readToolFile)).manifest as LearningSessionManifest;
  },
  async render(toolId, params, format) {
    const { runToolCli } = await import('./run.ts');
    const dir = await mkdtemp(join(tmpdir(), 'lolly-learning-'));
    try {
      const output = join(dir, `render.${format}`);
      await runToolCli({ toolId, params, outputPath: output, format });
      return new Uint8Array(await readFile(output));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  async motionAvailable() {
    const { browserInstalled } = await import('@lolly-tools/node-shell/browsers');
    return browserInstalled();
  },
};

/** Files uploaded on the device that saved a session. Their bytes never travel in the module. */
function deviceOnlyFiles(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (/^user\/\S+$/.test(value)) found.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) deviceOnlyFiles(item, found);
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.source === 'user' && typeof record.id === 'string') found.add(record.id);
    for (const item of Object.values(record)) deviceOnlyFiles(item, found);
  }
  return found;
}

const kindLabel: Record<LearningBlock['kind'], string> = {
  text: 'text',
  quiz: 'a quiz',
  image: 'an image',
  slides: 'still pages',
  video: 'a video',
  audio: 'audio',
  resource: 'a downloadable resource',
};
const exportFirst = 'export a finished file and reference it as an asset source';

/**
 * Render a saved tool session the way the web shell does: the tool's declared rendition
 * for the block, each page of a paged document on its own, and no provenance marks.
 * Anything this installation cannot reproduce exactly is refused with the reason.
 */
export async function renderLearningSession(
  block: LearningBlock,
  renderer: LearningSessionRenderer = cliSessionRenderer
): Promise<LearningBytes[]> {
  const source = block.source;
  if (source?.kind !== 'session' || !source.toolId || !source.values)
    throw usageError('This content has no saved tool session to render.');
  const { toolId, values } = source;
  const manifest = await renderer.manifest(toolId);
  if (source.toolVersion && manifest.version && String(manifest.version) !== source.toolVersion)
    note(
      `The session was saved with ${toolId} ${source.toolVersion}. Rendering it with the installed ${manifest.version}.`
    );
  const rendition = learningRenditions(manifest).find((r) => r.kind === block.kind);
  if (!rendition)
    throw unavailableHere(
      `"${toolId}" cannot export ${kindLabel[block.kind]}. Choose another rendition in the editor, or ${exportFirst}.`,
      'LEARNING_RENDITION_UNAVAILABLE'
    );
  const mime = mimes[rendition.format];
  if (!mime)
    throw unavailableHere(
      `The CLI cannot package ${rendition.format} output from "${toolId}". Choose another rendition in the editor, or ${exportFirst}.`,
      'LEARNING_RENDITION_UNAVAILABLE'
    );
  const local = deviceOnlyFiles(values).size;
  if (local)
    throw unavailableHere(
      `This session uses ${local === 1 ? 'a file' : `${local} files`} uploaded on the device that saved it, and the CLI cannot read ${local === 1 ? 'that file' : 'those files'}. On that device, ${exportFirst}.`,
      'LEARNING_DEVICE_FILE'
    );
  if (source.pageIds?.length && block.kind !== 'slides')
    throw usageError(
      'A page selection applies only to still pages. Remove pageIds from this source.'
    );
  if (block.kind === 'video' && !(await renderer.motionAvailable()))
    throw unavailableHere(
      `Rendering motion needs the browser renderer, which is not installed here. Run \`lolly install-browser\` or set LOLLY_BROWSER_CHANNEL=chrome, or ${exportFirst}.`,
      'MOTION_RENDERER_UNAVAILABLE'
    );

  const { sessionToParams } = await import('./rebuild.ts');
  const { params } = sessionToParams(manifest, values);
  // The emoji set a session was drawn with travels as the same reserved params a link uses.
  const emoji = values.__emoji;
  if (emoji && typeof emoji === 'object' && !Array.isArray(emoji))
    for (const key of ['emoji', 'emojifx', 'emojistyle']) {
      const value = (emoji as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) params[key] = value.trim();
    }
  const render = async (extra: Record<string, string>, base = params): Promise<LearningBytes> => ({
    bytes: await renderer.render(
      toolId,
      { ...base, ...extra, 'no-provenance': '1' },
      rendition.format
    ),
    mime,
  });

  if (block.kind === 'slides') {
    // A page keeps its own authored size, so the saved export size applies only to a
    // document without pages.
    const { width: _w, height: _h, unit: _u, dpi: _d, ...pageParams } = params;
    if (source.pageIds?.length) {
      const pages: LearningBytes[] = [];
      for (const id of source.pageIds) {
        if (/^\d+$/.test(id) || id.includes('.'))
          throw usageError(
            `"${id}" cannot be read as a frame id. Use the frame's own id in pageIds.`
          );
        pages.push(await render({ s: id }, pageParams));
      }
      return pages;
    }
    const pages: LearningBytes[] = [];
    for (let position = 1; position <= MAX_PAGES + 1; position++) {
      let page: LearningBytes;
      try {
        page = await render({ s: String(position) }, pageParams);
      } catch (error) {
        if (errorKind(error) !== 'SLIDE_NOT_FOUND') throw error;
        break;
      }
      if (position > MAX_PAGES)
        throw usageError(
          `This session renders more than ${MAX_PAGES} pages. Choose pages with pageIds, or split the document.`
        );
      pages.push(page);
    }
    return pages.length ? pages : [await render({})];
  }

  if (block.kind === 'video' && Array.isArray(values.boxes)) {
    const frames = values.boxes.filter(
      (box): box is Record<string, unknown> =>
        !!box && typeof box === 'object' && box.kind === 'frame' && !box.hidden
    );
    const frame = frames[0];
    if (frame && frames.some((f) => f.w !== frame.w || f.h !== frame.h))
      throw usageError(`Use equally sized frames for a course video, or ${exportFirst}.`);
    if (
      frame &&
      typeof frame.w === 'number' &&
      typeof frame.h === 'number' &&
      frame.w > 0 &&
      frame.h > 0
    ) {
      const { unit: _u, dpi: _d, ...pixelParams } = params;
      return [await render({ width: String(frame.w), height: String(frame.h) }, pixelParams)];
    }
  }
  return [await render({})];
}

async function readLocalAsset(root: string, block: LearningBlock): Promise<LearningBytes[]> {
  const asset = block.source?.asset;
  if (block.source?.kind !== 'asset' || !asset)
    throw usageError(
      'Add a source for this content: a saved tool session, or a relative local file path in source.asset.url.'
    );
  if (!asset.url || isAbsolute(asset.url) || /^[a-z]+:/i.test(asset.url))
    throw usageError('Learning assets must use relative local paths beside the module document.');
  const path = await realpath(resolve(root, asset.url));
  const inside = relative(root, path);
  if (inside.startsWith('..') || isAbsolute(inside))
    throw usageError('A learning asset resolves outside the module directory.');
  const mime = mimes[asset.format];
  if (!mime) throw usageError(`Unsupported learning asset format: ${asset.format}`);
  return [{ bytes: await readFile(path), mime }];
}

/** Local file packaging uses the same compiler and player as the web shell. */
export async function learningCli(
  args: string[],
  flags: Record<string, string>,
  json: boolean,
  renderer: LearningSessionRenderer = cliSessionRenderer
): Promise<void> {
  const [action, input] = args;
  if (!input || !['check', 'build'].includes(action || ''))
    throw usageError(
      'Usage: lolly learning check module.json | lolly learning build module.json --format=scorm12 --output=course.zip'
    );
  const module = parseLearningModule(JSON.parse(await readFile(input, 'utf8')));
  const findings = checkLearningModule(module);
  if (action === 'check') {
    if (json)
      await emitResult(
        { moduleId: module.id, findings },
        findings.some((f) => f.severity === 'error') ? 2 : 0
      );
    else
      await writeOut(
        findings.map((f) => `${f.severity}: ${f.message}`).join('\n') +
          (findings.length ? '\n' : 'Module structure is ready.\n')
      );
    if (findings.some((f) => f.severity === 'error')) process.exitCode = 2;
    return;
  }
  const target = flags.format || 'scorm12';
  if (!['static', 'scorm12', 'scorm2004', 'tincan', 'cmi5'].includes(target) || !flags.output)
    throw usageError(
      'Choose --format=static|scorm12|scorm2004|tincan|cmi5 and --output=course.zip.'
    );
  const root = await realpath(dirname(resolve(input)));
  let sessions = 0;
  // The compiler prefixes a source failure with its lesson title as a plain Error, so
  // the original is kept to give the CLI its exit code and stable kind.
  let failure: unknown;
  const compiled = await compileLearningModule(
    module,
    randomUUID(),
    async (block) => {
      try {
        if (block.source?.kind !== 'session') return await readLocalAsset(root, block);
        const files = await renderLearningSession(block, renderer);
        sessions++;
        return files;
      } catch (error) {
        failure = error;
        throw error;
      }
    },
    async (bytes) => createHash('sha256').update(bytes).digest('hex'),
    note
  ).catch((error: unknown) => {
    if (failure === undefined || !(error instanceof Error)) throw error;
    throw new CliError(error.message, exitCodeFor(failure), errorKind(failure));
  });
  const bytes = buildLearningPackage(compiled, target as LearningTarget);
  await writeFile(flags.output, bytes, { flag: 'wx' });
  const result = {
    output: flags.output,
    releaseId: compiled.content.releaseId,
    target,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    renderedSessions: sessions,
  };
  if (json) await emitResult(result);
  else
    await writeOut(
      `Created ${result.output} (${result.bytes} bytes${sessions ? `, ${sessions} saved ${sessions === 1 ? 'session' : 'sessions'} rendered` : ''}). ${target === 'static' ? 'Upload the extracted files to your website and test the course.' : 'Test this version in your LMS before assigning learners.'}\n`
    );
}
