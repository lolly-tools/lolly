// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly smoke` - the catalog-wide render gate.
 *
 * Renders EVERY tool in the active profile's catalog at manifest defaults, each to its
 * first Node-native format (NODE_FORMATS - DOM-free, browser-free), and exits non-zero
 * if any render fails. assertRenderOk is already wired inside the CLI write path, so a
 * hooks.js regression that would ship a blank tool surfaces here as that tool's ✗ - 
 * this is the CI job that keeps the gallery from ever shipping a tool that renders
 * blank. Budget rules: renders run sequentially, never launch a browser, never
 * download one.
 *
 * Format choice per tool:
 *   1. the first declared format that is Node-native (svg/emf/eps/dxf + data formats
 *      + html) → the normal runToolCli path, same as a user's `--export=`;
 *   2. no Node-native format declared at all (browser-only tools: pptx/raster/video
 *      first) → an inline hydrate + export-html render. runToolCli refuses `--export=`
 *      of an undeclared format, but html still exercises load → hydrate → hooks →
 *      assertRenderOk, which is what smoke is for (the established headless fallback).
 *
 * Three outcomes, not two. A tool whose first Node-native format is svg but whose
 * template is an HTML layout has no browser-free vector path, and smoke may not launch
 * the tier that does - that lands in its OWN `~` bucket (rendered as html, hooks
 * checked), never as a ✓ for the format it could not produce. It does not fail the gate,
 * because it is a statement about smoke's budget, not about the tool.
 *
 * Tools that legitimately cannot render headlessly are SKIPPED with a reason, never
 * failed: tools gated on a live-capture capability (camera/microphone/screen/capture -
 * browser-only by definition). Everything else is strict: a hook error is a real failure.
 *
 * The transform lane. A transform tool (hooks.exportFile: file in, bytes out) has
 * nothing to render at defaults, so it runs once over a small committed fixture chosen
 * by the file types its input accepts (TRANSFORM_FIXTURES), through the same runToolCli
 * transform path a user's `lolly <tool> --source=<file>` takes. It passes when the
 * output is non-empty and its magic bytes are one of the formats the tool declares. A
 * tool whose input accepts no fixture type, or whose hook asks for the browser tier or
 * a model this host lacks, is skipped with that reason: smoke never launches a browser,
 * and a skip is never counted as a pass. The fixtures live in the source checkout's
 * tests/fixtures, so an installed CLI with no checkout skips every transform and says so.
 */

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRuntime, loadTool, parseUrlState } from '@lolly/engine';
import { NODE_FORMATS } from '@lolly-tools/node-shell/raster';
import { needsBrowserTier } from '@lolly-tools/node-shell/browser-tier';
import { EXIT, exitCodeFor } from './exit-codes.ts';
import { checkTransformOutput } from './transform-output.ts';
import { assertRenderOk } from '@lolly-tools/node-shell/render-integrity';
import {
  catalogFile, readToolManifest, readToolText,
} from '@lolly-tools/node-shell/content-roots';

/** Capabilities that only a live browser/device session can fulfil - the CLI host has
 *  no camera, mic, screen, or page-capture Chromium (smoke never launches a browser). */
const LIVE_CAPTURE_CAPS = ['capture', 'camera', 'microphone', 'screen'];

/** The slice of tool.json smoke reasons about (kept structural, like run.ts). */
export interface SmokeManifest {
  id: string;
  status?: string;
  capabilities?: string[];
  hooks?: Record<string, unknown> | null;
  render: { formats: string[] };
  inputs?: Array<{ id: string; type: string; accept?: string | string[]; showIf?: unknown }>;
}

export { checkTransformOutput, transformOutputKind } from './transform-output.ts';

/** One committed file the transform lane feeds a tool, matched against its `accept`. */
export interface TransformFixture {
  /** The container the file holds (also the name used for it in the report). */
  kind: string;
  ext: string;
  mime: string;
  /** Absolute path of the committed file. */
  path: string;
}

/**
 * The source checkout this module runs from, or null. tests/fixtures is resolved from
 * the module, not from LOLLY_ROOT, so a content-root override cannot move it. A bundled
 * CLI (npm package, Tauri sidecar) is not in a checkout, and three steps up from its
 * bundle is an unrelated directory, so the checkout is confirmed by its own files first.
 */
const CHECKOUT: string | null = (() => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  return existsSync(join(root, 'pnpm-workspace.yaml')) && existsSync(join(root, 'shells', 'cli', 'src', 'smoke.ts'))
    ? root
    : null;
})();

/**
 * The files the transform lane runs tools over, smallest committed one per container.
 * A tool is matched in the order its own `accept` list names types, so a tool that
 * lists JPEG before PNG and has no JPEG fixture gets the PNG, not the PDF it also takes.
 * Empty outside a source checkout.
 */
export const TRANSFORM_FIXTURES: readonly TransformFixture[] = CHECKOUT
  ? [
      { kind: 'pptx', ext: '.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', path: join(CHECKOUT, 'tests', 'fixtures', 'rebrand', 'simple.pptx') },
      { kind: 'pdf', ext: '.pdf', mime: 'application/pdf', path: join(CHECKOUT, 'tests', 'fixtures', 'rebrand', 'flattened.pdf') },
      { kind: 'png', ext: '.png', mime: 'image/png', path: join(CHECKOUT, 'tests', 'fixtures', 'public-journeys', 'welcome.png') },
      { kind: 'svg', ext: '.svg', mime: 'image/svg+xml', path: join(CHECKOUT, 'tests', 'fixtures', 'public-journeys', 'welcome.svg') },
      { kind: 'ttf', ext: '.ttf', mime: 'font/ttf', path: join(CHECKOUT, 'tests', 'fixtures', 'text-composition', 'fonts', 'notosanshebrew', 'NotoSansHebrew[wdth,wght].ttf') },
    ]
  : [];

/**
 * The fewest inputs a transform needs beyond its file, for the tools whose defaults
 * cannot produce a file. Each entry says why. A tool not listed runs on its fixture and
 * its manifest defaults alone.
 */
export const TRANSFORM_PARAMS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // A PDF is signed only once a signature exists: one drawn stroke. The credential seal
  // is off because the fixture PDF uses a cross-reference stream, which the C2PA PDF
  // embed cannot attach to; the seal is covered by the sign tool's own tests.
  sign: { signatureInk: 'M10 10 L100 40 L180 20', seal: 'false' },
  // No file input: the hook transforms the text in `body`, which is empty by default,
  // and the default operation returns it unchanged, so upper case proves a change.
  'text-helper': { body: 'Lolly smoke sample', operation: 'upper' },
};

/**
 * What a transform must have done, for the tools whose output format has no magic
 * bytes to check. Returns an error sentence, or null when the output is right.
 */
export const TRANSFORM_EXPECT: Readonly<Record<string, (bytes: Uint8Array) => string | null>> = {
  'text-helper': bytes => {
    const text = new TextDecoder().decode(bytes);
    return text === 'LOLLY SMOKE SAMPLE' ? null : `expected the upper-case sample text, got "${text.slice(0, 40)}"`;
  },
};

/** True when one `accept` token (".pdf", "application/pdf", "image/*") admits a fixture. */
function acceptsFixture(token: string, fixture: TransformFixture): boolean {
  const t = token.trim().toLowerCase();
  if (!t) return false;
  if (t.startsWith('.')) return t === fixture.ext;
  if (t.endsWith('/*')) return fixture.mime.startsWith(t.slice(0, -1));
  return t === fixture.mime;
}

/**
 * The fixture a transform tool runs over: the first `accept` token, in the tool's own
 * order, that a committed fixture satisfies. null when nothing fits, which the lane
 * reports as a skip.
 */
export function pickTransformFixture(
  accept: string | string[] | undefined,
  fixtures: readonly TransformFixture[] = TRANSFORM_FIXTURES,
): TransformFixture | null {
  const tokens = (Array.isArray(accept) ? accept : (accept ?? '').split(',')).map(t => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const hit = fixtures.find(f => acceptsFixture(token, f));
    if (hit) return hit;
  }
  return null;
}

/**
 * Why a transform tool cannot run in the lane, or its fixture when it can. Skips: a
 * forced format it does not declare; a file input shown only for some settings (its
 * default run reads no file); no fixture its input accepts; the fixture missing; and a
 * forced format its default fixture is not. A transform writes the container of its
 * input, so a forced `svg` runs only the tools whose own first fixture is an SVG,
 * rather than steering a tool onto an input its default run never takes.
 */
export function transformPlan(
  manifest: SmokeManifest,
  forcedFormat?: string,
  fixtures: readonly TransformFixture[] = TRANSFORM_FIXTURES,
): { fixture: TransformFixture | null; inputId: string | null } | { skip: string } {
  const forced = forcedFormat?.toLowerCase();
  if (forced && !manifest.render.formats.some(f => f.toLowerCase() === forced)) {
    return { skip: `does not declare "${forcedFormat}"` };
  }
  const files = (manifest.inputs ?? []).filter(i => i.type === 'file');
  const fileIn = files.find(i => !i.showIf);
  if (!fileIn && files.length) {
    return { skip: `its file input "${files[0]!.id}" is shown only for some settings, so its default run reads no file` };
  }
  // No file input (text-helper): the hook transforms the tool's own inputs, at defaults.
  if (!fileIn) return { fixture: null, inputId: null };
  if (!fixtures.length) return { skip: 'transform fixtures ship only with a source checkout' };
  const fixture = pickTransformFixture(fileIn.accept, fixtures);
  if (!fixture) {
    const accept = Array.isArray(fileIn.accept) ? fileIn.accept.join(', ') : (fileIn.accept ?? '');
    return { skip: `transform tool with no committed fixture for its input (accepts ${accept || 'unspecified'})` };
  }
  if (!existsSync(fixture.path)) return { skip: `transform fixture ${basename(fixture.path)} is not on disk` };
  if (forced && fixture.kind !== forced) {
    return { skip: `runs over a ${fixture.kind} fixture, so it writes ${fixture.kind}, not "${forcedFormat}"` };
  }
  return { fixture, inputId: fileIn.id };
}

/**
 * The first declared format smoke can render without a browser (declared spelling
 * preserved - some tools say 'jpeg', none respell NODE_FORMATS, but stay tolerant).
 * null → no Node-native format at all → the caller uses the inline html fallback.
 */
export function pickSmokeFormat(formats: string[]): string | null {
  return formats.find(f => NODE_FORMATS.includes(f.toLowerCase())) ?? null;
}

/** Why a tool is skipped rather than rendered - or null when it must render (strict). */
export function skipReason(manifest: SmokeManifest, forcedFormat?: string): string | null {
  const caps = (manifest.capabilities ?? []).filter(c => LIVE_CAPTURE_CAPS.includes(c));
  if (caps.length) return `needs ${caps.join('+')} - no headless support`;
  // A transform's forced-format check lives in transformPlan, beside its fixture choice.
  if (isTransform(manifest)) return null;
  if (forcedFormat && !manifest.render.formats.some(f => f.toLowerCase() === forcedFormat.toLowerCase())) {
    return `does not declare "${forcedFormat}"`;
  }
  return null;
}

/** A transform tool: its output comes from hooks.exportFile, not from a render. */
export function isTransform(manifest: SmokeManifest): boolean {
  return !!manifest.hooks && 'exportFile' in manifest.hooks;
}

interface SmokeArgs {
  /** --only=id,id - smoke just these catalog tool ids. */
  only?: string;
  /** --format=svg - force one Node-native format for every tool that declares it. */
  format?: string;
  /** Row/summary sink (stdout by default) - injectable so tests don't garble TAP. */
  out?: (line: string) => void;
  /** --json: the section 5.2 envelope on stdout; the progress table moves to stderr. */
  json?: boolean;
  /** The transform lane's files (TRANSFORM_FIXTURES by default); tests inject their own. */
  fixtures?: readonly TransformFixture[];
}

/** One tool's outcome, as `smoke --json` reports it. */
export interface SmokeRecord {
  id: string;
  /** `ok` rendered · `failed` did not · `skipped` never attempted · `layout` rendered
   *  as html because it has no browser-free path to its own first native format. */
  outcome: 'ok' | 'failed' | 'skipped' | 'layout';
  format?: string;
  bytes?: number;
  ms?: number;
  /** Why it was skipped, or what went wrong. */
  reason?: string;
  /** `transform` when the tool ran over a fixture file; absent for the render lane. */
  lane?: 'transform';
  /** The fixture file a transform ran over (its base name). */
  fixture?: string;
  /** false when a transform passed on length alone: none of its declared formats has
   *  magic bytes to read, and no TRANSFORM_EXPECT check covers it. */
  checked?: false;
}

/** Run the gate. Returns the process exit code: 0 all ok, 1 any ✗, 2 bad invocation. */
export async function smokeCli({ only, format, out, json = false, fixtures = TRANSFORM_FIXTURES }: SmokeArgs = {}): Promise<number> {
  // With --json the envelope owns stdout, so the progress table becomes a diagnostic
  // and moves to stderr. Same table, same rows; only the stream changes.
  const print = out ?? ((line: string) => (json ? process.stderr : process.stdout).write(line));
  const records: SmokeRecord[] = [];
  const fail = async (message: string, kind: string): Promise<number> => {
    process.stderr.write(message);
    if (json) {
      const { emitError } = await import('./envelope.ts');
      await emitError(Object.assign(new Error(message.trim()), { exit: 2, kind }));
    }
    return 2;
  };

  if (format && !NODE_FORMATS.includes(format.toLowerCase())) {
    return fail(`smoke is browser-free - --format must be one of: ${NODE_FORMATS.join(', ')}\n`, 'BAD_FLAG_VALUE');
  }

  const index = JSON.parse(await readFile(catalogFile('tools/index.json'), 'utf8')) as {
    tools: Array<{ id: string }>;
  };
  let ids = index.tools.map(t => t.id);
  if (only) {
    const want = only.split(',').map(s => s.trim()).filter(Boolean);
    const unknown = want.filter(id => !ids.includes(id));
    if (unknown.length) {
      return fail(`Unknown tool id(s): ${unknown.join(', ')}. Run \`lolly\` to list tools.\n`, 'UNKNOWN_TOOL');
    }
    ids = want;
  }

  const outDir = await mkdtemp(join(tmpdir(), 'lolly-smoke-'));
  const idWidth = ids.reduce((w, id) => Math.max(w, id.length), 4);
  const started = Date.now();
  let ok = 0;
  let failed = 0;
  let skipped = 0;
  /** Rendered as html because the tool has no browser-free path to its own first
   *  Node-native format. Its own bucket: not a pass for that format, not a bug. */
  let layout = 0;

  for (const id of ids) {
    const manifest = readToolManifest(id) as SmokeManifest;

    const reason = skipReason(manifest, format);
    if (reason) {
      skipped++;
      records.push({ id, outcome: 'skipped', reason });
      print(`– ${id.padEnd(idWidth)} ${'-'.padEnd(9)} skipped: ${reason}\n`);
      continue;
    }

    if (isTransform(manifest)) {
      const outcome = await runTransformLane(manifest, format, outDir, fixtures);
      records.push(outcome.record);
      if (outcome.record.outcome === 'ok') ok++;
      else if (outcome.record.outcome === 'failed') failed++;
      else skipped++;
      print(transformLine(outcome.record, idWidth));
      if (outcome.record.outcome === 'failed' && outcome.log) {
        print(outcome.log.split('\n').map(l => `    ${l}`).join('\n') + '\n');
      }
      continue;
    }

    // Forced format is validated as declared by skipReason above; keep the declared spelling.
    const fmt = format
      ? manifest.render.formats.find(f => f.toLowerCase() === format.toLowerCase())!
      : pickSmokeFormat(manifest.render.formats);
    const outputPath = join(outDir, `${id}.${fmt ?? 'html'}`);

    // Buffer the render's own logging (runToolCli progress lines, hook console noise) so
    // the table stays a table; replay it indented only when the render fails.
    const t0 = Date.now();
    const capture = captureStdio();
    try {
      if (fmt) {
        // Lazy import: runToolCli drags in jsdom + the full bridge; a --format typo or
        // an all-skipped run shouldn't pay for it.
        const { runToolCli } = await import('./run.ts');
        // PROVENANCE OFF, deliberately (contract section 12 O2). A render carries Content
        // Credentials and the Imprint by default, and both embed a fresh timestamp:
        // smoke is a CI gate that renders the whole catalog and compares nothing but
        // "did bytes arrive", so signing every one of them would buy nothing, cost a
        // key operation per tool, and make the run's output undiffable. The decision is
        // recorded, not implicit: machine paths default to a bare render.
        await runToolCli({ toolId: id, params: { 'no-provenance': '1' }, outputPath, format: fmt });
      } else {
        await renderHtmlHeadless(id, outputPath);
      }
      capture.restore();

      // The requested file, at the requested path, or it did not pass.
      if (!existsSync(outputPath)) {
        throw new Error(`no ${fmt ?? 'html'} was written (the render produced no file at the requested path)`);
      }
      const bytes = (await stat(outputPath)).size;
      ok++;
      records.push({ id, outcome: 'ok', format: fmt ?? 'html', bytes, ms: Date.now() - t0 });
      print(`✓ ${id.padEnd(idWidth)} ${(fmt ?? 'html').padEnd(9)} ${bytes.toLocaleString()} B  ${Date.now() - t0}ms\n`);
    } catch (e) {
      capture.restore();
      // FORMAT_UNAVAILABLE: an HTML-layout tool whose first Node-native format is svg. It
      // has no browser-free vector path, and smoke's budget rule forbids launching the
      // render tier that does - so this says nothing about whether the tool renders.
      //
      // What it must NOT do is what it did before: the old code accepted runToolCli's
      // silent svg→html substitution and printed `✓ filter-halftone svg->html 761 B`, so
      // a fallback scored identically to a real vector render and the gate was worthless
      // for exactly the tools it most needed to cover. Now the HTML render is smoke's own
      // deliberate choice (renderHtmlHeadless - still load → hydrate → hooks →
      // assertRenderOk, which is what smoke is for) and it is reported in its OWN bucket,
      // never as a ✓. A hook failure inside that render is still a hard ✗ below.
      if ((e as { code?: string }).code === 'FORMAT_UNAVAILABLE') {
        const htmlPath = outputPath.replace(/\.[^./\\]+$/, '') + '.html';
        const retry = captureStdio();
        try {
          await renderHtmlHeadless(id, htmlPath);
          retry.restore();
          layout++;
          const bytes = (await stat(htmlPath)).size;
          records.push({
            id, outcome: 'layout', format: 'html', bytes, ms: Date.now() - t0,
            reason: `no browser-free ${fmt}; rendered as html, hooks ok`,
          });
          print(`~ ${id.padEnd(idWidth)} ${`${fmt}:html`.padEnd(9)} ${bytes.toLocaleString()} B  ${Date.now() - t0}ms  (layout tool: no browser-free ${fmt}; hooks ok)\n`);
          continue;
        } catch (inner) {
          retry.restore();
          e = inner;
        }
      }
      failed++;
      const msg = ((e as Error).message ?? String(e)).split('\n')[0];
      records.push({ id, outcome: 'failed', format: fmt ?? 'html', ms: Date.now() - t0, reason: msg });
      print(`✗ ${id.padEnd(idWidth)} ${(fmt ?? 'html').padEnd(9)} ${msg}\n`);
      const log = capture.text().trim();
      if (log) print(log.split('\n').map(l => `    ${l}`).join('\n') + '\n');
    }
  }

  const elapsed = Date.now() - started;
  print(
    `\nsmoke: ${ok} ✓  ${failed} ✗  ${layout} ~ (layout tools rendered as html)  ${skipped} skipped  ` +
    `(${ids.length} tools, ${(elapsed / 1000).toFixed(1)}s) - outputs in ${outDir}\n`,
  );
  const exit = failed ? 1 : 0;
  if (json) {
    const { emitResult } = await import('./envelope.ts');
    await emitResult({
      tools: records,
      summary: { total: ids.length, ok, failed, layout, skipped, ms: elapsed },
      outDir,
      ...(format ? { forcedFormat: format } : {}),
    }, exit);
  }
  return exit;
}

/** The table row for one transform-lane outcome, in the render lane's columns. */
function transformLine(r: SmokeRecord, idWidth: number): string {
  const from = r.fixture ? ` (transform over ${r.fixture})` : ' (transform)';
  if (r.outcome === 'skipped') return `– ${r.id.padEnd(idWidth)} ${'-'.padEnd(9)} skipped: ${r.reason}\n`;
  if (r.outcome === 'failed') return `✗ ${r.id.padEnd(idWidth)} ${(r.format ?? '-').padEnd(9)} ${r.reason}${from}\n`;
  const unverified = r.checked === false ? ' (bytes not verifiable)' : '';
  return `✓ ${r.id.padEnd(idWidth)} ${(r.format ?? '-').padEnd(9)} ${(r.bytes ?? 0).toLocaleString()} B  ${r.ms}ms${from}${unverified}\n`;
}

/**
 * Run one transform tool over its fixture through runToolCli's transform path, with
 * the browser tier switched off. A hook that asks for the browser tier, or a failure
 * this host classifies as unavailable here (a missing model, an absent capability), is
 * a skip with that reason; every other error and every output that fails the magic-byte
 * check is a failure, and a rejected output is kept as `<id>.rejected` for a look.
 */
async function runTransformLane(
  manifest: SmokeManifest,
  format: string | undefined,
  outDir: string,
  fixtures: readonly TransformFixture[],
): Promise<{ record: SmokeRecord; log?: string }> {
  const id = manifest.id;
  const plan = transformPlan(manifest, format, fixtures);
  if ('skip' in plan) return { record: { id, outcome: 'skipped', lane: 'transform', reason: plan.skip } };
  const fixture = plan.fixture ? basename(plan.fixture.path) : undefined;
  const params: Record<string, string> = { ...(TRANSFORM_PARAMS[id] ?? {}), 'no-provenance': '1' };
  if (plan.fixture && plan.inputId) params[plan.inputId] = plan.fixture.path;
  // Written under a neutral name first: the transform path converts a font container
  // to match a .ttf/.otf/.woff name, and the lane checks the bytes the tool produced.
  const rawPath = join(outDir, `${id}.out`);
  const t0 = Date.now();
  const capture = captureStdio();
  try {
    const { runToolCli } = await import('./run.ts');
    await runToolCli({ toolId: id, params, outputPath: rawPath, browserTier: false });
    capture.restore();
    if (!existsSync(rawPath)) throw new Error('no file was written (the transform produced no file at the requested path)');
    const bytes = new Uint8Array(await readFile(rawPath));
    // Checked against every declared format: the tool did nothing wrong when it wrote
    // one of them, and a forced format has already chosen a fixture of that kind.
    const check = checkTransformOutput(bytes, manifest.render.formats);
    const expect = TRANSFORM_EXPECT[id];
    const problem = 'error' in check ? check.error : expect ? expect(bytes) : null;
    if (problem) {
      const rejected = join(outDir, `${id}.rejected`);
      await rename(rawPath, rejected);
      throw new Error(`${problem}; the output is kept as ${basename(rejected)}`);
    }
    const kind = 'kind' in check ? check.kind : 'bin';
    const checked = 'kind' in check && (check.checked || !!expect);
    await rename(rawPath, join(outDir, `${id}.${kind}`));
    return {
      record: {
        id, outcome: 'ok', lane: 'transform', format: kind, bytes: bytes.length, ms: Date.now() - t0,
        ...(fixture ? { fixture } : {}), ...(checked ? {} : { checked: false as const }),
      },
    };
  } catch (e) {
    capture.restore();
    const msg = ((e as Error).message ?? String(e)).split('\n')[0]!;
    if (needsBrowserTier(e) || exitCodeFor(e) === EXIT.UNAVAILABLE_HERE) {
      return { record: { id, outcome: 'skipped', lane: 'transform', reason: `needs a tier smoke does not run: ${msg}`, ...(fixture ? { fixture } : {}) } };
    }
    return {
      record: { id, outcome: 'failed', lane: 'transform', ms: Date.now() - t0, reason: msg, ...(fixture ? { fixture } : {}) },
      log: capture.text().trim(),
    };
  }
}

/**
 * The html fallback for tools with NO Node-native format (their formats start pptx/
 * raster/video, and they don't declare html, so runToolCli's declared-format check
 * refuses it). Same primitives as run.ts - jsdom + the CLI bridge + brand vars +
 * hydrate + export - ending in the same assertRenderOk, so a hook failure is still ✗.
 */
async function renderHtmlHeadless(toolId: string, outputPath: string): Promise<void> {
  const jsdom = await import('jsdom');
  const { quietVirtualConsole } = await import('./run.ts');
  const dom = new jsdom.JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>', {
    virtualConsole: quietVirtualConsole(jsdom),
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;

  const fetchFile = readToolText;
  const tool = await loadTool(toolId, fetchFile);
  const { createCliBridge, applyBrandVars } = await import('./bridge.ts');
  // Same per-tool host.net gate as run.ts - a network-capable tool's onInit fetch
  // must pass/fail here exactly as it would on a real CLI render.
  const host = await createCliBridge({ dom, profile: {}, networkAllowlist: tool.manifest.network?.allowlist });
  const { values } = parseUrlState('', tool.manifest);
  const runtime = await createRuntime(tool, host, values);

  const canvas = dom.window.document.getElementById('canvas')!;
  await applyBrandVars(canvas, host);
  canvas.innerHTML = runtime.getHydrated();

  // Portable HTML embeds fonts and prepares browser-owned presentation state.
  // Smoke only snapshots its hydrated page; browser export tests cover that file.
  // Keep onInit failures strict through the same integrity check below.
  let blob: Blob;
  if (tool.manifest.render.portable) {
    await runtime.applyEmojiToDom(canvas);
    blob = await host.export.render(canvas, 'html', {});
  } else {
    blob = await runtime.export(canvas, 'html', {});
  }
  const buf = Buffer.from(await blob.arrayBuffer());
  assertRenderOk({ hookErrors: runtime.hookErrors, format: 'html', bytes: buf });
  await writeFile(outputPath, buf);
}

/** Swap stdout/stderr writes for a buffer during one render (restore is idempotent). */
function captureStdio(): { text(): string; restore(): void } {
  const origErr = process.stderr.write.bind(process.stderr);
  const origOut = process.stdout.write.bind(process.stdout);
  let buf = '';
  const sink = (chunk: unknown): boolean => {
    buf += typeof chunk === 'string' ? chunk : String(chunk);
    return true;
  };
  process.stderr.write = sink as typeof process.stderr.write;
  process.stdout.write = sink as typeof process.stdout.write;
  return {
    text: () => buf,
    restore: () => {
      process.stderr.write = origErr;
      process.stdout.write = origOut;
    },
  };
}
