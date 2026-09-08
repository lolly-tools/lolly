// SPDX-License-Identifier: MPL-2.0
/**
 * CLI runner - the working implementation.
 *
 * Loads a tool from disk, runs the engine against a jsdom DOM, and writes the
 * exported file. This is the SAME engine path the web shell uses; only the
 * host bridge implementation differs. That's the URL-mode-as-CLI principle - 
 * CLI is just a different transport, not a different render engine.
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve, basename, extname } from 'node:path';

import { createNodeHookExecutor } from '@lolly-tools/node-shell/hook-worker';
import { loadTool, createRuntime, annotateTemplate, parseUrlState, serializeUrlState, serializeHdr, expandQuery, frameFilterApplies, embedC2pa, C2PA_FORMATS, c2paDefaultOn, imprintDefaultOn, isImprintFormat, IMPRINT_FORMATS, normalizeLang, parseDataRows, parseTableText, hasEncryptedState, unpackEncrypted, ENC_PARAM, RESERVED, parseRateCard, isRateCardError, validateRateCard, sfntKind, storeZip, readXlsx, listXlsxSheets, rowsToCsv } from '@lolly/engine';
import { createHash } from 'node:crypto';
import type { Lang } from '@lolly/engine';
import type { InputValue } from '../../../engine/src/inputs.ts';
// NODE_FORMATS: the DOM-free/raster format split, shared with the TUI. Everything not
// in it - raster, pdf, video - is produced by raster.ts (resvg fast path, else the
// scoped Chromium).
import { NODE_FORMATS, DEEP_FORMATS, pxDims, matchedExportFormat, canCarryPrintPrep, printPrepRefusal } from '@lolly-tools/node-shell/raster';
import { wantsNativeHdrStill } from './raster.ts';
import { buildExportC2paOpts } from '@lolly-tools/node-shell/c2pa-opts';
// The enrolled signing identity (key + x5chain) - type only here; the module itself is
// imported lazily in the render path so a run without --sign-key never loads it.
import type { SigningIdentity } from '@lolly-tools/node-shell/signing-identity';
import { repoRoot } from '@lolly-tools/node-shell/repo-root';
// Fail loud: never write a degenerate file + exit 0 when the render silently failed.
import { assertRenderOk } from '@lolly-tools/node-shell/render-integrity';
// Fail loud, part two: refuse bytes that are demonstrably not the requested container
// (headless Chromium has no AV1 encoder, so an --export=avif used to write PNG).
import { assertFormatBytes, sniffFormat, formatAllows } from '@lolly-tools/node-shell/format-sniff';
import { needsBrowserTier } from '@lolly-tools/node-shell/browser-tier';
import { cleanControlChars } from '@lolly-tools/node-shell/verdict-report';
// url-shot: capture a live page via the scoped Chromium (shared with the TUI).
import { captureUrl, captureParamsFrom } from '@lolly-tools/node-shell/url-capture';
import { createCliBridge, applyBrandVars, CLI_CAPABILITIES } from './bridge.ts';
// The `s=` still-export frame filter (plan 112 section 10) - the engine resolves the
// address, this reads the rendered pages. Same meaning as the web shell's fan-out.
import { pickFramePage } from './frame-page.ts';
import { isOn } from './args.ts';
import type { Profile, ExportOpts } from '@lolly-tools/core/host-v1';
import { note, warn, writeOut, isStrict } from './output.ts';
import { usageError, unavailableHere, refused, authError } from './exit-codes.ts';

/**
 * LOLLY_HOOK_WORKER=1 runs every tool's hooks.js in a `worker_threads` Worker
 * (the same protocol as the web shell's hook Worker) instead of this process's
 * realm. Off by default while the catalog is being field-verified; the
 * `isolate` manifest flag is the per-tool switch, written into the manifest
 * (scripts/tool-isolation.ts) once a tool renders identically both ways.
 */
let nodeHookExecutor: ReturnType<typeof createNodeHookExecutor> | null = null;
function hookExecutorOpts(): { hookExecutor?: ReturnType<typeof createNodeHookExecutor> } | undefined {
  if (process.env.LOLLY_HOOK_WORKER !== '1') return undefined;
  nodeHookExecutor ??= createNodeHookExecutor();
  return { hookExecutor: nodeHookExecutor };
}

const REPO_ROOT = repoRoot();

interface RunToolCliArgs {
  toolId: string;
  params: Record<string, string>;
  /** Flags that appeared MORE THAN ONCE on the command line, with every value - how a
   *  `multiple` file input collects `--files=a --files=b`. Merged into the query below
   *  (each value appended) so parseUrlState builds the input's array. `params` still
   *  carries the last value for every single-valued reader. */
  repeated?: Record<string, string[]>;
  outputPath?: string;
  format?: string;
  /** --share/--link: print a shareable lolly.tools URL for the inputs instead of rendering. */
  share?: boolean;
  /** --verify: for a transform tool, print a per-file line saying the tool's own
   *  export checks ran and none failed. A failed check throws (exit 1) either way. */
  verify?: boolean;
  /** --html-fallback: OPT IN to receiving an HTML artifact when the requested format
   *  cannot be produced here. Off by default - silently substituting the format was
   *  the single worst defect in this shell (see the export section below). */
  htmlFallback?: boolean;
  /** --text=outline|live (contract section 1.3/section 6a). svg outlines text by
   *  default; 'live' keeps editable `<text>` and accepts that the recipient needs
   *  the font. emf INVERTS the default: live GDI text records (editable in
   *  Office / Google Drawings, per-run outline fallback), with `--text=outline`
   *  forcing the old text-as-paths output. wmf/eps/dxf are always outlined. */
  text?: 'outline' | 'live';
  /** The installed binary rejects unknown argv flags. Programmatic callers keep
   * the historical warning default; pasted links may name tolerated URL keys. */
  rejectUnknown?: boolean;
  toleratedUnknown?: ReadonlySet<string>;
  /** Where the tool's files come from. Defaults to the active profile's `tools/` view;
   *  `validate --rebuild` overrides it so a `.lolly` that carries its own tool renders
   *  against THAT copy rather than whatever this checkout happens to hold. */
  fetchFile?: (path: string) => Promise<string>;
}

/**
 * The capabilities THIS shell fulfils, as a set (contract B11). A tool manifest that
 * requires anything outside it is refused rather than rendered as a placeholder.
 */
const PROVIDED = new Set<string>(CLI_CAPABILITIES);

/**
 * Refuse a tool whose manifest requires a capability this shell cannot provide.
 *
 * Before this, `lolly screencap --export=png` produced a 639 KB PNG of the tool's
 * empty-state placeholder and exited 0 - a plausible file that is not the thing anyone
 * asked for. Exit 3 (UNAVAILABLE_HERE), not 1: a screen recorder is not broken, it is
 * in the wrong room.
 */
export function unmetCapabilities(manifest: { capabilities?: readonly string[] }): string[] {
  return (manifest.capabilities ?? []).filter(c => !PROVIDED.has(c));
}

export function assertCapabilities(manifest: { id: string; capabilities?: readonly string[] }): void {
  const missing = unmetCapabilities(manifest);
  if (!missing.length) return;
  throw unavailableHere(
    `"${manifest.id}" needs ${missing.map(c => `"${c}"`).join(' + ')}, which the CLI cannot provide. ` +
    `This shell offers ${[...PROVIDED].join(', ')}. Run the tool in the web shell or the desktop app; ` +
    'nothing was rendered, because a render here would be the tool\'s empty placeholder under the name you asked for.',
    'CAPABILITY_UNAVAILABLE',
  );
}

/**
 * Does this failure mean "the Node host can't do this, a real browser can"?
 *
 * Re-exported, not implemented here: the canonical version lives in
 * `@lolly-tools/node-shell/browser-tier` so this shell, the TUI and the MCP server's
 * transform path answer the question identically. The MCP copy had drifted to the old
 * prose-only regex, which meant `convert-image` escalated on the CLI and failed hard
 * over MCP. Kept as a named export from this module because the existing tests and
 * call sites import it from here.
 */
export { needsBrowserTier };

/** ExportOpts plus the two CLI-local extensions run.ts threads to the bridge:
 *  the PDF open-password and the `hdr=` dials (the canonical HostV1 ExportOpts
 *  carries neither - the web shell extends it the same way). */
type CliExportOpts = ExportOpts & {
  password?: string;
  /** The resolved Imprint decision, forwarded to the DOM-free bridge for the one
   *  raster it produces there (BMP). Vector/data DOM-free formats ignore it. */
  imprint?: boolean;
  /** `--text=outline|live` - vector text-as-paths, and its opt-out (contract section 6a). */
  text?: 'outline' | 'live';
  /** Reported per run the svg branch could not outline (see the bridge). */
  onTextFallback?: (run: { text: string; reason: string }) => void;
  hdr?: { targets?: readonly string[]; peakNits?: number; reach?: number; lift?: number; richness?: number };
};

/** Brand semantic slots offered to the HDR view transform as boost targets. The
 *  bright, saturated end of the brand - a brand's `surface`/`text`/`muted` are the
 *  page, not the thing that should glow. Mirrors what the web export panel sends as
 *  `palette` (its brand primaries), not the full var set applyBrandVars writes. */
const BRAND_HDR_SLOTS = ['primary', 'secondary'] as const;

/**
 * A jsdom virtual console that does not shout about jsdom being jsdom.
 *
 * Every `filter-*` run printed a ten-frame stack trace ending in a stray `undefined`
 * for a render that SUCCEEDED: the tools feature-detect canvas by calling getContext,
 * jsdom answers with a "Not implemented" jsdomError, and jsdom's default console sink
 * dumps it. The detection then works exactly as designed and the export escalates to
 * the tier that can raster. Printing a stack trace for a designed code path trains
 * people to ignore this shell's stderr, which is the last thing it can afford.
 *
 * So: "Not implemented: X" is collapsed to one line naming X (printed once per feature),
 * every OTHER jsdomError still prints in full, and the tool's own console output is
 * forwarded untouched. Set DEBUG to get the raw traces back.
 */
export function quietVirtualConsole(jsdom: typeof import('jsdom')): InstanceType<typeof jsdom.VirtualConsole> {
  const vc = new jsdom.VirtualConsole();
  const seen = new Set<string>();
  vc.on('jsdomError', (err: Error) => {
    const notImplemented = /^Not implemented:\s*(.+)$/.exec(firstLine(err.message));
    if (notImplemented && !process.env.DEBUG) {
      const what = notImplemented[1]!;
      if (seen.has(what)) return;
      seen.add(what);
      process.stderr.write(`Note: jsdom has no ${what} - the tool's own feature detection handles this.\n`);
      return;
    }
    process.stderr.write(`[jsdom] ${process.env.DEBUG ? (err.stack ?? err.message) : firstLine(err.message)}\n`);
  });
  // The tool's own console.* still reaches the operator (a hook's warning is real
  // information); only jsdom's internal complaints are filtered above.
  for (const level of ['error', 'warn', 'info', 'log', 'debug'] as const) {
    vc.on(level, (...args: unknown[]) => {
      if (level === 'debug' && !process.env.DEBUG) return;
      process.stderr.write(`[${level}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`);
    });
  }
  return vc;
}

export async function runToolCli({ toolId, params, repeated = {}, outputPath, format, share, verify, htmlFallback, text, rejectUnknown = false, toleratedUnknown, fetchFile: fetchFileOverride }: RunToolCliArgs): Promise<void> {
  // Lazy import - jsdom is heavy and we only need it when actually rendering.
  const jsdom = await import('jsdom');
  const dom = new jsdom.JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>', {
    virtualConsole: quietVirtualConsole(jsdom),
  });
  // Expose enough globals for the engine + Handlebars to work happily.
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  // …and a REAL 2D canvas behind them when @napi-rs/canvas is installed (plan 183
  // WS4). jsdom answers getContext('2d') with "Not implemented", so every tool that
  // rebuilds pixels rather than describing them - the redact utility's raster
  // repaint and its own re-decode verification gate - failed here and escalated to
  // the browser tier. Those hooks predate host.raster and reach for document /
  // Image / createImageBitmap directly, and a tool ships as DATA from another
  // repository, so the fix is to make this realm's answer TRUE rather than to
  // rewrite them. It installs nothing that already works, and returns false
  // (changing nothing) on a lean install, which keeps the honest refusal.
  const { installNodeCanvas } = await import('@lolly-tools/node-shell/canvas');
  installNodeCanvas(dom.window as unknown as { HTMLCanvasElement?: { prototype: Record<string, unknown> } });

  const fetchFile = fetchFileOverride ?? readToolFile;

  // --lang=xx selects the tool's manifest translation sidecar, if it ships one
  // (engine/src/loader.ts's applyManifestI18n) - the CLI is URL mode under a
  // different transport, so this is the same `lang` reserved param, read
  // directly rather than through parseUrlState (which treats it as reserved
  // and never surfaces it in `values`).
  const tool = await loadToolOrThrow(toolId, fetchFile, { lang: normalizeLang(params.lang) ?? undefined });
  // Annotate the template as the web shell does (plans/222): the paint markers it
  // adds let a colour input bound to a brand token bind the exported shape to that
  // token even on this DOM-free path. Harmless otherwise - the data attributes have
  // no visual effect and every other shell already annotates. The content markers
  // (`<!-- ci:id -->…<!-- /ci:id -->`) are only for the web shell's DOM-to-control
  // mapping; its export walker drops comment nodes, so on this string-serialised path
  // we strip them here rather than let them reach the exported file.
  tool.template = annotateTemplate(tool.template, tool.manifest.inputs.map((i) => i.id))
    .replace(/<!-- \/?ci:[^ ]+ -->/g, '');

  // Refuse before rendering anything: a tool that needs a camera/mic/screen/clipboard
  // has no honest headless render, and the placeholder it used to emit looked like a
  // real answer (contract B11).
  assertCapabilities(tool.manifest);

  // Reserved params this shell cannot honour: refuse the ones whose absence would
  // change the physical artefact, warn about the rest (contract B6).
  checkReservedParams(params);
  // A reserved flag that shadows one of THIS tool's declared inputs never reaches the
  // input - say so, and name the escape hatch (contract B7).
  warnShadowedInputs(params, tool.manifest);

  // --user-profile=path.json pre-fills bindToProfile inputs from the user's profile
  // (the bridge serves it via host.profile.get). Note the NAME: `--profile` is the
  // press condition, matching URL mode's reserved `profile` param exactly (contract
  // B1) - one word cannot mean two things.
  const profile = await readProfile(params['user-profile']);

  // Warn about flags this tool has no use for. The docs promise flags are validated
  // against the manifest; they were simply swallowed, so a typo (`--urll=…`) rendered
  // defaults with no hint that the value went nowhere.
  warnUnknownFlags(params, tool.manifest, { reject: rejectUnknown, tolerated: toleratedUnknown });

  // `--rate-card=path.json`: load + validate the printer's own card and confirm it in
  // one line. Warn-and-continue on any problem - the card is not required to render, and
  // this phase computes no prices with it (that is a later phase).
  await loadRateCardCli(params['rate-card']);

  // A password-protected share link (`zx=…`) carries the WHOLE state encrypted. The web
  // shell prompts for the password; the CLI takes it as a flag. Decrypt BEFORE expandQuery,
  // exactly as the web shell does, so everything downstream sees a plain query.
  //
  // NO SILENT DEFAULTS. `zx` is a reserved param, so parseUrlState ignores it - which meant
  // a missing or wrong password rendered the tool's DEFAULTS and exited 0. A wrong document
  // that looks right is the worst thing this shell can emit, so both cases now throw.
  // A repeated flag (--files=a --files=b) contributes ALL its values; `params` holds
  // only the last, so append the full list from `repeated` for those keys instead.
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (repeated[k]) continue; // appended below with every value
    usp.append(k, v);
  }
  for (const [k, vs] of Object.entries(repeated)) {
    for (const v of vs) usp.append(k, v);
  }
  let rawQuery = usp.toString();
  if (hasEncryptedState(rawQuery)) {
    // `--password` is url-mode's PDF open-password. When it is the only password on the
    // command line and the link is encrypted, it is obviously meant for the link, so it is
    // consumed here and removed from the query rather than also locking an exported PDF.
    // `--link-password` is the unambiguous form and always wins.
    const explicit = params['link-password'];
    rawQuery = await decryptLinkQuery(rawQuery, explicit ?? params.password, explicit === undefined);
  }
  // Expand a packed `z=…` param back into a plain query - the CLI is URL mode under a
  // different transport, so a packed share link must run identically here
  // (`lolly design --z=1eJ…`). A no-op for ordinary readable params.
  const query = await expandQuery(rawQuery);
  const { values, format: paramFormat, width, height, unit, dpi, password, c2pa, bleed, imprint, durable, depth, hdr, filename, cuts, profile: pressProfileParam, designVersion: designvParam, slide, video } = parseUrlState(
    query,
    tool.manifest,
  );

  // The host is built HERE, after the query is decrypted, expanded and parsed,
  // because `--designv=` is a render param like any other: the design-system
  // version this run resolves against is read off the same parsed state a packed
  // or password-protected link carries, not off raw argv. Nothing above needs a
  // host, and building it later means a wrong link password fails before the
  // catalog index is read rather than after.
  //
  // Thread the manifest's network.allowlist into host.net (same per-tool gate the
  // web view applies post-load) - without it every host.net fetch on the CLI
  // rejects, breaking the one-render-path parity for network-capable tools.
  const host = await createCliBridge({
    dom,
    profile,
    networkAllowlist: tool.manifest.network?.allowlist,
    // The ladder's two upper rungs (plans/97 section 6a); the bridge reads the active
    // version and the head off the catalog's own ledger. `--designv=latest` is
    // the documented "test against the edit head" lever and beats the pin.
    designVersion: { override: designvParam, pin: tool.manifest.designVersion ?? null },
  });

  // `--input.<id>=<value>` - the explicit input namespace (contract B7). Never
  // intercepted by reserved handling, so the eight shipped tools that declare a
  // `width`/`height`/`format` input stay reachable without renaming inputs whose URLs
  // are a harder contract than this CLI. Applied AFTER parseUrlState so it wins.
  Object.assign(values, explicitInputValues(params, tool.manifest, { rejectUnknown, tolerated: toleratedUnknown }));
  // Print prep + press intent for the browser (Tier-B) export tier. `marks` is passed as
  // the raw CSV (?marks) rather than round-tripped through parseUrlState's flag map, and
  // read off the EXPANDED query so a packed link works too. The CMYK press condition uses
  // a distinct --press-profile flag: url-mode's `profile` means the press condition, but
  // the CLI's --profile is the user-profile JSON file (readProfile above) - never conflate.
  const marksRaw = new URLSearchParams(query).get('marks') || null;
  // The CMYK press condition. `--press-profile` is the explicit spelling; `--profile`
  // is its frozen alias and reads straight off url-mode's reserved `profile` param, so
  // a shared print link and a hand-typed flag mean the same thing (contract B1).
  const pressProfile = params['press-profile'] || pressProfileParam || null;

  // `cuts=N` asks for a CONTACT SHEET: N stills sampled across a timed tool's stage,
  // which only the web shell's sequence-cuts renderer produces. The CLI accepted the
  // param, rendered ONE frame, and said nothing - a different artefact under the right
  // name. Exit 3, because a runner with the browser tier can do it (contract B6; note
  // that the contract calls `cuts` a print instruction, which it is not - the refusal
  // is right, the reason is "the CLI has no sequence renderer").
  if (cuts > 1) {
    throw unavailableHere(
      `--cuts=${cuts} asks for a ${cuts}-frame contact sheet, which the CLI cannot produce (the sequence renderer lives in the web shell). ` +
      'Nothing was written: a single frame under the name you asked for would be a different artefact. Export from the web shell, or drop --cuts.',
      'CUTS_UNAVAILABLE',
    );
  }

  // --output=- means stdout, explicitly (contract B10). Normalised here so every
  // downstream branch sees "no path" and streams, exactly as an omitted --output does.
  if (outputPath === '-') outputPath = undefined;
  // `--filename=<name>` names the output file, written into the working directory, when
  // --output is absent (contract B6: it used to be accepted, ignored, and produce
  // byte-identical output with nothing to say so). A BARE `--filename` is a usage error,
  // rejected by the entry point with every other value-taking flag (contract B5).
  const filenameFlag = filename ?? null;
  if (filenameFlag && outputPath) {
    warn('FILENAME_IGNORED', `--output=${outputPath} wins over --filename=${filenameFlag}; the file is written to --output.`);
  }

  // `--tier-b-debug` (or LOLLY_TIER_B_DEBUG=1): keep the headless browser's console,
  // page errors and network log, and on a Tier-B failure write them to
  // `<output>.tier-b-debug.log` with the step that ran out of time. Off by default -
  // a passing render costs nothing and writes nothing. Set here rather than inside
  // raster.ts so the log is written beside the file the caller asked for.
  if (isOn(params['tier-b-debug'])) {
    const { configureTierBDebug } = await import('@lolly-tools/node-shell/webshell-render');
    configureTierBDebug({
      enabled: true,
      outPath: outputPath ?? (filenameFlag ? resolve(process.cwd(), filenameFlag) : null),
    });
  }

  // File-typed inputs arrive as a filesystem path (--photo=./pic.jpg → an
  // {__file, path} ref from parseUrlState). The engine can't read files (it's
  // platform-agnostic), so the CLI loads the bytes here, into the same FileRef
  // shape the web picker produces - before createRuntime sees them.
  // Load one path ref (or stdin `-`) into the in-memory FileRef shape the web picker
  // produces. Shared by single and `multiple` file inputs.
  const loadFileRef = async (inputId: string, p: string): Promise<Record<string, unknown>> => {
    if (p === '-') {
      // `-` reads the file from stdin (contract B10), so a utility composes with the
      // shell: `cat in.pdf | lolly strip-data --source=- > out.pdf`. Frozen before GA
      // precisely because once `-` can be a literal path, redefining it is breaking.
      const buf = await readStdin();
      if (!buf.length) throw usageError(`--${inputId}=- reads the file from stdin, but stdin was empty.`, 'EMPTY_STDIN');
      return { __file: true, name: 'stdin', mime: 'application/octet-stream', size: buf.length, bytes: new Uint8Array(buf), url: null };
    }
    const abs = resolve(process.cwd(), p);
    let buf: Buffer;
    try { buf = await readFile(abs); }
    catch (e) { throw usageError(`--${inputId}: cannot read "${p}" (${(e as Error).message}).`, 'INPUT_UNREADABLE'); }
    return { __file: true, name: basename(abs), mime: mimeForFile(abs), size: buf.length, bytes: new Uint8Array(buf), url: null };
  };
  for (const input of tool.manifest.inputs ?? []) {
    if (input.type !== 'file') continue;
    const ref = values[input.id];
    // A `multiple` file input collects an array of {path} refs (repeated --id=path).
    if (input.multiple) {
      const refs = Array.isArray(ref) ? ref : (ref ? [ref] : []);
      const loaded: Record<string, unknown>[] = [];
      for (const r of refs) {
        const p = r && typeof r === 'object' ? (r as { path?: string }).path : null;
        if (p) loaded.push(await loadFileRef(input.id, p));
      }
      if (loaded.length) values[input.id] = loaded as unknown as InputValue;
      else delete values[input.id];
      continue;
    }
    const p = ref && typeof ref === 'object' ? (ref as { path?: string }).path : null;
    if (!p) { delete values[input.id]; continue; }
    values[input.id] = await loadFileRef(input.id, p) as unknown as InputValue;
  }

  // An `asset` input can also take the user's OWN local image (--logo=./brand.png), not
  // just a catalog id or a lolly.tools URL. When the ref's id resolves to a real file on
  // disk, load its bytes into a self-contained (baked) AssetRef here - the same in-memory
  // shape a web upload produces - so the runtime uses it directly instead of asking the
  // catalog for it. A catalog id (suse/logo/…) isn't a real file, so it falls through to
  // normal resolution; a tool URL stays 'remote' for compose.
  for (const input of tool.manifest.inputs ?? []) {
    if (input.type !== 'asset') continue;
    const ref = values[input.id];
    if (!ref || typeof ref !== 'object') continue;
    const r = ref as { id?: string; source?: string };
    if (!r.id || r.source === 'remote') continue;   // tool URLs render via compose, not disk
    let st: Awaited<ReturnType<typeof stat>> | undefined;
    try { st = await stat(resolve(process.cwd(), r.id)); } catch { continue; }  // not a local file → catalog
    if (!st.isFile()) continue;
    const abs = resolve(process.cwd(), r.id);
    const mime = mimeForFile(abs);
    const isVec = mime === 'image/svg+xml';
    const bytes = await readFile(abs);
    values[input.id] = {
      source: 'user',
      id: basename(abs),
      type: isVec ? 'vector' : 'raster',
      format: isVec ? 'svg' : (mime.split('/')[1] || 'png'),
      url: `data:${mime};base64,${bytes.toString('base64')}`,
      meta: { baked: true, name: basename(abs) },
    };
  }

  // Read a data-import file to text: an `.xlsx` is unzipped through the SAME engine
  // reader the web uses (honouring `--<input>-sheet=<name|index>`, defaulting to the
  // first sheet) and serialised to CSV; every other file is read as UTF-8. This is the
  // CLI half of the web data-source, so both convert a spreadsheet identically. Lists
  // the sheet names in the note when a multi-sheet book resolves to a non-default sheet.
  const readImportText = async (dataPath: string, inputId: string): Promise<string> => {
    const abs = resolve(process.cwd(), dataPath);
    if (!/\.xlsx$/i.test(dataPath)) return readFile(abs, 'utf8');
    const bytes = new Uint8Array(await readFile(abs));
    const sheetFlag = params[`${inputId}-sheet`];
    const sheet = sheetFlag == null ? undefined : (/^\d+$/.test(sheetFlag) ? Number(sheetFlag) : sheetFlag);
    const sheets = listXlsxSheets(bytes);
    if (sheets.length > 1 && sheet === undefined) {
      note(`ℹ ${dataPath} has ${sheets.length} sheets (${sheets.map(s => s.name).join(', ')}); reading the first. Pass --${inputId}-sheet=<name|index> to choose.`);
    }
    const { rows, sheetName } = readXlsx(bytes, sheet !== undefined ? { sheet } : {});
    if (sheetName) note(`ℹ read sheet “${sheetName}” from ${dataPath}`);
    return rowsToCsv(rows);
  };

  // `--<blocksInput>-data=rows.csv|.xlsx` populates a `blocks` input from a spreadsheet
  // via the SAME engine importer the web offers - so a chart/table can be filled from a
  // file headlessly instead of hand-encoding tilde/JSON rows. Read from `params` (the
  // flag isn't a declared input, so parseUrlState ignores it).
  for (const input of tool.manifest.inputs ?? []) {
    if (input.type !== 'blocks') continue;
    const dataPath = params[`${input.id}-data`];
    if (!dataPath) continue;
    const text = await readImportText(dataPath, input.id);
    const fields = (input.fields ?? []) as Array<{ id: string; label?: string; type?: string }>;
    const { rows, truncated } = parseDataRows(text, { fields });
    values[input.id] = rows as (typeof values)[string];
    note(`✓ Imported ${rows.length} row${rows.length === 1 ? '' : 's'} into --${input.id} from ${dataPath}${truncated ? ' (row cap reached)' : ''}`);
  }

  // `--<tableInput>-data=table.csv|.xlsx` fills a `table` input from a CSV/TSV/Markdown
  // or .xlsx file (first row = headings) - the headless twin of the sidebar's spreadsheet
  // paste. The inline form (--data=<compact-or-JSON string>) already works via
  // parseUrlState; this flag is for real files. Read from `params` (not a
  // declared input, so parseUrlState ignores it).
  for (const input of tool.manifest.inputs ?? []) {
    if (input.type !== 'table') continue;
    const dataPath = params[`${input.id}-data`];
    if (!dataPath) continue;
    const text = await readImportText(dataPath, input.id);
    const parsed = parseTableText(text);
    if (!parsed) throw new Error(`--${input.id}-data: ${dataPath} does not parse as a CSV/TSV/Markdown table`);
    values[input.id] = parsed as (typeof values)[string];
    note(`✓ Imported ${parsed.rows.length} row${parsed.rows.length === 1 ? '' : 's'} × ${parsed.columns.length} columns into --${input.id} from ${dataPath}`);
  }

  // `--<textInput>-data=data.csv|.xlsx` fills a `text`/`longtext` input with a file's
  // content - the headless twin of the web's "Add data" affordance (an .xlsx becomes
  // CSV in the field, first sheet or --<input>-sheet). Reach for it when a chart/table
  // tool takes its data as pasted text rather than as structured blocks/table.
  for (const input of tool.manifest.inputs ?? []) {
    if (input.type !== 'text' && input.type !== 'longtext') continue;
    const dataPath = params[`${input.id}-data`];
    if (!dataPath) continue;
    const text = await readImportText(dataPath, input.id);
    values[input.id] = text as (typeof values)[string];
    note(`✓ Filled --${input.id} from ${dataPath} (${text.length} chars)`);
  }

  // --share/--link: print a shareable lolly.tools link for the current inputs instead of
  // rendering (the CLI half of the web Share dialog + the TUI's `u`). Handled BEFORE the
  // transform/format paths so it works for any tool; a teammate reopens the exact config
  // without hand-reconstructing a URL. (A `file`-typed input has no shareable form, so it
  // is simply absent from the link - same as the web.)
  if (share) {
    const runtime = await createRuntime(tool, host, values, hookExecutorOpts());
    const q = serializeUrlState(runtime.getModel());
    await writeOut(`https://lolly.tools/#/tool/${tool.manifest.id}${q ? '?' + q : ''}\n`);
    return;
  }

  // Transform-path tools (on-device utilities) produce their output via the
  // exportFile hook (bytes in → bytes out), not by rendering a DOM node. They
  // don't use a render format at all - short-circuit before the format checks.
  if (tool.manifest.hooks?.exportFile) {
    // `--export=` on a transform is REFUSED, not ignored. A transform's output container
    // follows its INPUT file (and whatever the tool's own inputs say); the reserved
    // `format` param never reaches the hook. Accepting it printed
    // `✓ … → clean.png` for a file that held JPEG bytes and exited 0 - a mislabelled
    // file is worse than an error, and this is the last release in which the flag can
    // change meaning.
    if (format ?? paramFormat) {
      const asked = format ?? paramFormat;
      const spelled = format ? `--export=${asked}` : `--format=${asked}`;
      // If the tool declares its OWN `format` input (convert-image does), the reserved
      // param shadowed it and the fix is the explicit namespace, not "drop the flag".
      const ownFormat = (tool.manifest.inputs ?? []).some(i => i.id === 'format');
      throw usageError(
        `"${toolId}" is an on-device transform (file in → file out), so ${spelled} has nothing to act on: ` +
        'the output container follows the file you gave it, and the reserved export format never reaches the tool. ' +
        (ownFormat
          ? `"${toolId}" has its own \`format\` input - write it as --input.format=${asked}.`
          : 'Drop the flag, or use one of the tool\'s own inputs if it offers a conversion.'),
        'UNSUPPORTED_FLAG',
      );
    }
    const runtime = await createRuntime(tool, host, values, hookExecutorOpts());
    const fileIn = (tool.manifest.inputs ?? []).find(i => i.type === 'file');
    let tier = 'node';
    let bytes: Uint8Array;
    let suggestedName: string | undefined;
    let usedTransformBrowser = false;
    try {
      const res = await runtime.exportFile(password ? { password } : {});
      if (Array.isArray(res)) {
        // Batch (a `multiple` file input): the shell streams ONE artifact, so fold
        // every transformed file into a zip (STORED for already-compressed media).
        // A one-item batch still delivers that single file directly.
        if (res.length === 1) {
          bytes = res[0]!.bytes as Uint8Array;
          suggestedName = res[0]!.filename;
        } else {
          const used = new Map<string, number>();
          const entries = res.map((r, i) => {
            let name = r.filename || `file-${i + 1}`;
            const n = used.get(name) ?? 0; used.set(name, n + 1);
            if (n) { const dot = name.lastIndexOf('.'); name = dot > 0 ? `${name.slice(0, dot)}-${n + 1}${name.slice(dot)}` : `${name}-${n + 1}`; }
            return { name, bytes: r.bytes instanceof Uint8Array ? r.bytes : new Uint8Array(r.bytes as ArrayBuffer) };
          });
          bytes = storeZip(entries);
          suggestedName = `${tool.manifest.id}-files.zip`;
        }
      } else {
        bytes = res.bytes as Uint8Array;
        suggestedName = res.filename;
      }
    } catch (e) {
      const msg = (e as Error).message;
      const ref = fileIn ? (values[fileIn.id] as { name?: string; mime?: string; bytes?: Uint8Array } | undefined) : undefined;
      if (!needsBrowserTier(e) || !fileIn || !ref?.bytes) throw e;
      // The utility rebuilds real pixels (canvas / PDF page render), which the Node
      // host cannot do. Re-run the SAME hook in the scoped browser driving the built
      // web shell - the tool's export gate runs there, on these bytes. When no browser
      // or no built shell is present, transformViaWebShell names exactly what's missing.
      note(`Note: ${msg} Running it in the browser tier instead.`);
      const { transformViaWebShell } = await import('@lolly-tools/node-shell/webshell-render');
      const out = await transformViaWebShell({
        toolId: tool.manifest.id,
        fileInputId: fileIn.id,
        file: { name: ref.name || 'input', mime: ref.mime || 'application/octet-stream', bytes: ref.bytes },
        query: serializeUrlState(runtime.getModel()),
      });
      bytes = out.bytes;
      suggestedName = out.filename;
      tier = 'browser';
      usedTransformBrowser = true;
    }
    // Copy the VIEW (not `.buffer`): the browser tier hands back a Uint8Array whose
    // backing buffer may be larger than the file, and `.buffer` would write the slack.
    let buf = Buffer.from(bytes);
    // WITHOUT --output, a transform streams to stdout like every other path in this
    // shell (contract section 11: docs/cli.md always claimed it did; the code instead wrote
    // `<name>-clean.svg` into the working directory and printed nothing, so a pipeline
    // that piped it got an empty stream and a surprise file). `--filename=<name>` is
    // how you ask for a named file without naming a path; the hook's own suggestion is
    // used for it only when you do.
    const dest = outputPath || (filenameFlag ? resolve(process.cwd(), filenameFlag) : null);
    // export.file's ONE legal container change: fonts. When a transform's output is an
    // sfnt/WOFF and the requested name asks for a DIFFERENT font container, convert it
    // (TTF/OTF <-> WOFF via the engine's lossless codecs) so the bytes match the name.
    // This is the font-convert tool's headless path; the glyph outlines are untouched.
    if (dest) {
      const de = extname(dest).slice(1).toLowerCase();
      if (de === 'ttf' || de === 'otf' || de === 'woff') {
        if (sfntKind(bytes)) {
          const { convertFontContainer } = await import('@lolly/engine');
          bytes = convertFontContainer(bytes, de); buf = Buffer.from(bytes);
        }
      }
    }
    if (dest) {
      // The name you chose vs the bytes you got. A transform cannot change the container
      // to match the name, so this is a WARNING, not a refusal - but it must be said:
      // `strip-data --source=photo.jpg --output=clean.png` writes JPEG bytes, and
      // silence there is how a mislabelled file gets emailed on.
      const destExt = extname(dest).slice(1).toLowerCase();
      const actual = destExt ? sniffFormat(buf) : null;
      if (actual && !formatAllows(destExt, actual)) {
        warn('OUTPUT_EXTENSION_MISMATCH',
          `--output=${dest} is named ".${destExt}" but a transform cannot change the container: these bytes are ${actual}. The file is written as ${actual} under the name you gave.`);
      }
      await writeFile(dest, buf);
      // One-line result summary (input→output delta + the tool's a11y summary) so the
      // headless path reports what a transform did, not just a byte count. Matches the
      // TUI's utility result panel.
      const inBytes = fileIn ? (values[fileIn.id] as { size?: number } | undefined)?.size : undefined;
      const label = runtime.getHydratedString(tool.manifest.a11yLabel).trim();
      const delta = typeof inBytes === 'number' ? `${inBytes.toLocaleString()} → ${buf.length.toLocaleString()} bytes` : `${buf.length.toLocaleString()} bytes`;
      note(`✓ ${label ? label + ' - ' : ''}${delta} → ${dest}`);
    } else {
      if (suggestedName) note(`Note: streaming to stdout. The tool suggested the name "${suggestedName}" - pass --output=<path> or --filename=<name> to write a file.`);
      await writeOut(buf);
    }
    // --verify: one line per file. The tool's exportFile is what runs the checks and
    // it throws on a failed one (nothing is written, exit 1), so reaching here means
    // no check failed. Stated exactly that way - this does not re-run anything.
    if (verify) {
      const srcName = fileIn ? (values[fileIn.id] as { name?: string } | undefined)?.name ?? '(input)' : '(no file input)';
      note(`✓ verified: ${tool.manifest.id} exported ${srcName} with no failed check (tier: ${tier})`);
    }
    if (usedTransformBrowser) {
      const [{ closeBrowser }, { closeWebShell }] = await Promise.all([
        import('@lolly-tools/node-shell/browsers'), import('@lolly-tools/node-shell/webshell-render'),
      ]);
      await Promise.all([closeBrowser(), closeWebShell()]);
    }
    return;
  }

  // The runtime resolves asset refs (catalog ids → AssetRefs with a `format`), which
  // the matchExportFormat default below reads - so it's created before format resolution.
  const runtime = await createRuntime(tool, host, values, hookExecutorOpts());

  // Format resolution mirrors URL mode: an explicit flag wins (--export= arrives
  // as `format`, --format= as `paramFormat`); otherwise infer it from the
  // --output extension; otherwise a manifest-flagged matchExportFormat input
  // defaults to its uploaded file's own format (a dropped JPEG → jpg - same
  // rule as the web shell); otherwise the tool's first declared format.
  const explicitFormat = format ?? paramFormat ?? null;
  const fromOutputExt = outputPath ? formatFromOutput(outputPath, tool.manifest.render.formats) : null;
  // An --output EXTENSION that names no format this tool declares is a REFUSAL, not a
  // shrug. It used to fall through to the tool's first declared format, so
  // `lolly meeting-planner --output=times.csv` wrote 113 KB of PNG into a file called
  // .csv and exited 0 - the exact silent-substitution class `--export=csv` already
  // refuses with exit 2. Two spellings of one request must not disagree.
  //
  // Only when NO explicit format was given: `--export=svg --output=notes.txt` is a
  // deliberate "this format, that filename" and stays legal, because the caller said
  // which format they meant.
  if (!explicitFormat && outputPath && !fromOutputExt) {
    const ext = extname(outputPath).slice(1).toLowerCase();
    if (ext) {
      throw usageError(
        `--output=${outputPath} asks for ".${ext}", which "${toolId}" does not produce. ` +
        `Supported: ${tool.manifest.render.formats.join(', ')}. ` +
        `Name one with --export=<format> if you meant to write it under that filename anyway.`,
        'UNDECLARED_FORMAT',
      );
    }
  }
  const targetFormat = resolveJpegSynonym(
    explicitFormat ??
    fromOutputExt ??
    matchedExportFormat(tool.manifest, runtime.getModel() as Array<{ id: string; value: unknown }>) ??
    tool.manifest.render.formats[0]!,
    tool.manifest.render.formats,
  );

  // The PRO float formats (exr / .hdr) are admitted for ANY tool, declared or not.
  // plans/61-deeprichpixels.md section 10 rules out per-tool depth declarations - depth is an
  // export concern, tools stay declarative - so a tool.json listing "exr" would be
  // exactly the mistake the plan names (and would drag the schema enum plus every
  // per-brand generated catalog index along with it). The honest gate is at render
  // time instead: a tool with no vector root, or a request with no float source,
  // refuses with a message that says which. See DEEP_FORMATS in node-shell/raster.ts.
  if (!tool.manifest.render.formats.includes(targetFormat) && !DEEP_FORMATS.includes(targetFormat as never)) {
    throw usageError(
      `Tool "${toolId}" does not support format "${targetFormat}". ` +
      `Supported: ${tool.manifest.render.formats.join(', ')}` +
      ` (plus the pro float formats ${DEEP_FORMATS.join(', ')}, which need hdr=1)`,
      'UNDECLARED_FORMAT',
    );
  }

  // ── provenance: DEFAULT ON, exactly as the web shell does (contract section 12 O2) ──
  //
  // Decided by Andy on 2026-08-01, overruling this record's own recommendation: a file
  // made from the terminal carries the same marks as the same file made in the app.
  // Both defaults are read off the tool's MANIFEST through the engine's one policy
  // module (c2paDefaultOn / imprintDefaultOn), which is also what the web shell's
  // export sheet reads - so `render.c2pa:false` and `privacy:'on-device'` opt a tool
  // out on every surface at once, and the two surfaces cannot drift.
  //
  // THE COST, STATED RATHER THAN DISCOVERED: both marks embed a fresh timestamp, so
  // two identical invocations no longer produce identical bytes. `--no-provenance` is
  // the one word that buys determinism back (and `--c2pa=off` / `--imprint=0` are the
  // per-mark spellings); `smoke` and `batch` apply it themselves, being machine paths
  // where reproducibility is the point. docs/cli.md says all of this beside the
  // byte-reproducibility table.
  const bareRender = isOn(params['no-provenance']);
  if (bareRender && (c2pa?.on || imprint === true || durable)) {
    throw usageError(
      '--no-provenance turns every provenance mark off, but this run also asks for one explicitly. ' +
      'Drop --no-provenance, or drop the --c2pa/--imprint/--durable that contradicts it.',
      'CONFLICTING_FLAGS',
    );
  }
  // An explicit setting always wins over the manifest default; `null` from parseUrlState
  // is what "nobody said" means.
  const wantC2pa = bareRender ? false : c2pa ? c2pa.on : c2paDefaultOn(tool.manifest);
  // Whether the CALLER asked for Content Credentials, as opposed to inheriting them.
  // Every "could not stamp" message below is gated on this: a warning is a promise the
  // run did not keep, and under --strict it is an exit code, so a default nobody chose
  // must never produce one (`--export=dxf` would otherwise fail every strict pipeline
  // with "format has no C2PA container").
  const askedC2pa = c2pa?.on === true;
  // The Imprint only exists for formats whose bytes can carry it; on the rest the
  // setting is simply not applicable, which is not the same as being refused.
  const wantImprint = (bareRender ? false : imprint ?? imprintDefaultOn(tool.manifest))
    && isImprintFormat(targetFormat);
  if (imprint === true && !isImprintFormat(targetFormat)) {
    warn('IMPRINT_UNAVAILABLE',
      `--imprint has no effect on "${targetFormat}": the Lolly Imprint lives in pixels, and this format carries none. ` +
      `It applies to ${IMPRINT_FORMATS.join(', ')}.`);
  }
  const wantDurable = bareRender ? false : durable;

  // ── the enrolled signing identity ────────────────────────────────────────────
  //
  // Without one, every CLI export is signed by a fresh anonymous self-signed
  // certificate and reads `signingCredential.untrusted` however the verifier is
  // pinned - which made contract section 12 O1 (the terminal pins the Lolly CA root) a
  // decision with nothing to apply it to. `--sign-key`/`--sign-cert` (or the
  // $LOLLY_SIGN_* environment) supply a real key + x5chain instead.
  //
  // ADDITIVE BY CONSTRUCTION: with nothing configured resolveSigningIdentity
  // returns null and the ephemeral path below is byte-for-byte what it was.
  //
  // Everything that can be misconfigured is caught HERE, before a pixel is
  // rendered: a key that does not match its certificate would otherwise produce a
  // perfectly well-formed file that no verifier can validate, discovered by the
  // recipient rather than by the person who signed it.
  const askedIdentity = Boolean(params['sign-key'] || params['sign-cert']);
  if (bareRender && askedIdentity) {
    throw usageError(
      '--no-provenance turns every provenance mark off, but --sign-key/--sign-cert asks for a signed credential. ' +
      'Drop one of them.',
      'CONFLICTING_FLAGS',
    );
  }
  let identity: SigningIdentity | null = null;
  if (!bareRender) {
    const { resolveSigningIdentity, SigningIdentityError, describeIdentity } = await import('@lolly-tools/node-shell/signing-identity');
    try {
      identity = await resolveSigningIdentity({
        keyPath: params['sign-key'],
        certPath: params['sign-cert'],
        promptPassword: async () => {
          const { promptPassphrase } = await import('./prompt.ts');
          return promptPassphrase('Passphrase for the signing key');
        },
      });
    } catch (e) {
      if (!(e instanceof SigningIdentityError)) throw e;
      // A wrong/missing passphrase is exit 6 (AUTH) so a pipeline can tell "give me
      // the secret" from "you configured this wrong" (exit 2). Everything else is a
      // setup error, which is what USAGE means.
      throw e.code.startsWith('SIGN_KEY_PASSWORD')
        ? authError(e.message, e.code)
        : usageError(e.message, e.code);
    }
    if (identity) {
      note(describeIdentity(identity));
      for (const w of identity.warnings) warn('SIGN_CHAIN_INCOMPLETE', `Signing identity: ${w}`, 'gate');
      if (!wantC2pa) {
        warn('SIGN_IDENTITY_UNUSED',
          'A signing identity is configured, but Content Credentials are off for this run ' +
          `(${c2pa && !c2pa.on ? '--c2pa=off' : `"${tool.manifest.id}" declares render.c2pa:false or privacy:'on-device'`}), so nothing was signed with it.`);
      }
    }
  }

  let finalFormat = targetFormat;         // the format actually written (may fall back to html)
  let buf: Buffer;
  let usedBrowser = false;                // a pooled browser was launched → tear it down before exit
  let webShellExport = false;             // the Tier-B web shell produced the bytes → it owns c2pa
  // The Node tier asked for an Imprint and the frame was below the watermark's
  // detection floor. Reported, never silently dropped - but as a note, not a warning,
  // unless the caller explicitly asked for the mark (see the provenance block above).
  let imprintFloorSkip = false;

  if (isCaptureTool(tool.manifest)) {
    // Capture tools (url-shot): drive the scoped Chromium straight at the target URL - 
    // jsdom can't rasterise a live page. The SAME capture path the TUI uses; a clear,
    // actionable BrowserError surfaces if no browser is installed (`lolly install-browser`).
    const params = captureParamsFrom(runtime.getModel() as Array<{ id: string; value: unknown }>);
    const cdims = pxDims(
      { width: width ?? undefined, height: height ?? undefined, unit: unit ?? undefined, dpi: dpi ?? undefined },
      tool.manifest as { render?: { width?: number; height?: number } },
    );
    const cap = await captureUrl(params, targetFormat, cdims);
    // NOTE, and a knowing gap: a capture is a screenshot of somebody else's page, so
    // this branch does not embed the Lolly Imprint even when it is on by default. The
    // credential still rides (it records that Lolly captured these pixels, which is
    // true); the pixel watermark would assert Lolly rendered the artwork, which is not.
    buf = Buffer.from(cap.bytes);
    usedBrowser = true;                   // captureUrl launched the pooled Chromium
  } else {
    // Set up the rendering DOM. Brand vars go on first: the catalog's semantic
    // colour slots (--brand-primary, --brand-surface, …) land on the canvas root
    // BEFORE hydration, so a template's var(--brand-primary, fallback) reads the
    // same brand via web, URL mode, and CLI (plans/archive/brand-token-contract.md section 7).
    const canvas = dom.window.document.getElementById('canvas')!;
    await applyBrandVars(canvas, host);
    canvas.innerHTML = runtime.getHydrated();

    // Pass through requested output dimensions. A physical unit (mm/cm/in/pt)
    // qualifies the value so the engine converts it for the format; px is the
    // default. (e.g. --width=210 --height=297 --unit=mm --export=svg → A4.)
    const u = unit || 'px';
    const qual = (v: number | null | undefined): string | number | undefined => (typeof v === 'number' && v > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined);
    const exportOpts: CliExportOpts = { width: qual(width), height: qual(height) };

    // ── the `s=` still-export filter (plan 112 section 10) ────────────────────────────
    // `--s=2 --export=png` renders ONE slide of a framed document, exactly as
    // `?s=2&format=png` does in the web shell - same address grammar, same page, because
    // both ask engine/src/frame-address.ts. The DOM-free and Tier-A paths export the
    // picked page node at its own authored size (the web fan-out's rule: each page at its
    // own layout size, document dims stripped); Tier B forwards `s` in the web-shell URL
    // below (dims.slide) and the browser applies the identical filter there.
    //
    // A format the filter cannot apply to is REPORTED, not obeyed and not refused: pdf /
    // zip / pptx / html carry every slide by construction and the motion formats select a
    // frame by TIME, so the honest outcome is the whole document - which is also what the
    // web shell produces for the same link. An address that names nothing throws
    // (pickFramePage) rather than writing the wrong artefact under the right name.
    let exportNode: Element = canvas;
    if (slide) {
      if (!frameFilterApplies(targetFormat)) {
        warn('SLIDE_FILTER_IGNORED',
          `--s=${slide} names one slide, but "${targetFormat}" carries every slide in one file ` +
          '(or is a motion format, where time selects the frame). The whole document was rendered.');
      } else {
        const picked = pickFramePage(canvas, slide);
        if (picked) {
          exportNode = picked.node;
          // The page's own authored size wins unless the caller asked for a size - the
          // document dims describe the whole board, not this slide. PIXELS only: the frame's
          // authored w/h is a px number, so a run in a physical unit (`--unit=mm`, no
          // width/height) must NOT have it re-labelled as 1080mm. There the manifest dims
          // stand, as they did before this filter existed.
          if (u === 'px') {
            if (exportOpts.width === undefined && picked.width) exportOpts.width = picked.width;
            if (exportOpts.height === undefined && picked.height) exportOpts.height = picked.height;
          }
          note(`Rendering slide ${picked.index + 1} of ${picked.total} (--s=${slide}).`);
        }
      }
    }
    if (u !== 'px') exportOpts.dpi = dpi || 300;
    // --depth=8|16|float requests the export's bits per channel (--depth=auto, the
    // default, carries nothing). A request, not a promise: depth follows provenance,
    // so the writer emits deep bits only where the pipeline produced them.
    //
    // CONSUMED on the CLI as of Phase B3: --export=exr --depth=float writes 32-bit
    // FLOAT samples instead of the default 16-bit HALF. Every other combination is
    // logged and ignored rather than obeyed - EXR has no integer sample type, Radiance
    // is RGBE by definition, and no CLI raster path has a >8-bit SOURCE yet, so
    // --depth=16 on png/tiff here would be padding. See plans/61-deeprichpixels.md section 10
    // and the note in docs/url-mode.md.
    if (depth !== 'auto') exportOpts.depth = depth;
    // BMP is the only DOM-free raster the bridge produces (exr/hdr are float and carry
    // no pixel mark; svg/emf/… are vector). Forward the resolved Imprint decision so
    // `encodeBmp` embeds the Lolly pixel watermark by default - the only provenance a
    // container-less format like BMP can hold - honouring --imprint=0 / --no-provenance.
    if (isImprintFormat(targetFormat)) exportOpts.imprint = wantImprint;
    // --hdr=… routes the render through the engine's float HDR view transform. Today
    // that is the CLI's ONLY float pixel source, so it is what exr/.hdr require; the
    // brand's semantic colours (already resolved onto the canvas by applyBrandVars
    // above) are the boost targets, so a CLI EXR glows on the same colours a web HDR
    // export does. Values that are not hex (an oklch() slot) are skipped by hdr.ts's
    // parser rather than failing the export.
    if (hdr) {
      exportOpts.hdr = {
        targets: BRAND_HDR_SLOTS
          .map(s => canvas.style.getPropertyValue(`--brand-${s}`).trim())
          .filter(v => /^#[0-9a-fA-F]{3,8}$/.test(v)),
        peakNits: hdr.peakNits, reach: hdr.reach, lift: hdr.lift, richness: hdr.richness,
      };
    }
    // --password= sets the standard PDF's open-password (basic lock).
    if (targetFormat === 'pdf' && password) exportOpts.password = password;
    // Text as paths on vector export (contract section 6a). For svg, `--text=live`
    // opts out; a run whose font this host cannot resolve keeps its live <text> and
    // is reported here, once per run, so the person exporting knows which words a
    // recipient may see in a different face. Under --strict the fallback is a
    // refusal (exit 4), because a strict pipeline asked for "outlined or nothing".
    // emf INVERTS the default (live GDI text records since engine 1.128), so BOTH
    // values must be forwarded - `--text=outline` is emf's opt-out, not a no-op.
    if (text) {
      exportOpts.text = text;
      // WMF/EPS/DXF have no live-text representation at all - those emitters write
      // outlines or nothing. Say so rather than accept a flag that cannot apply.
      if (text === 'live' && ['wmf', 'eps', 'eps-cmyk', 'dxf'].includes(targetFormat.toLowerCase())) {
        warn('TEXT_LIVE_IGNORED', `--text=live cannot apply to "${targetFormat}": the format carries no text, only geometry. Text was outlined.`);
      }
    }
    const textFallbacks: Array<{ text: string; reason: string }> = [];
    exportOpts.onTextFallback = (run) => textFallbacks.push(run);

    const dims = {
      width: width ?? undefined, height: height ?? undefined, unit: unit ?? undefined, dpi: dpi ?? undefined,
      ...(password ? { password } : {}),
      ...(bleed ? { bleed } : {}),
      ...(marksRaw ? { marks: marksRaw } : {}),
      // ALWAYS forwarded, true or false: the web shell's own Imprint default is on, so
      // omitting the param would let the browser tier re-apply it after this shell
      // resolved it off (--imprint=0 / --no-provenance).
      imprint: wantImprint,
      ...(wantDurable ? { durable: true } : {}),
      ...(pressProfile ? { pressProfile } : {}),
      // Forward the RESOLVED c2pa setting so the browser tier stamps it (single
      // authority); the Node post-stamp below is skipped when the browser ran, avoiding
      // a double-stamp. Always forwarded now that the default is on: leaving the param
      // off would let the web shell apply its OWN default and make the CLI's
      // --c2pa=off a suggestion rather than an instruction.
      // WITH AN ENROLLED IDENTITY the browser tier must NOT stamp. It signs with its
      // own ephemeral on-device key (the key is a CryptoKey in this process; there is
      // no way to hand it to a browser over a URL, and there should not be). So the
      // credential is suppressed there and applied in Node below, over the finished
      // bytes, with the identity - the same last-byte-operation rule, one tier later.
      // The visible trade: the manifest's environment assertion is then the CLI's
      // (surface: 'cli'), not the web shell's. docs/cli-signing.md says so.
      c2pa: wantC2pa && !identity, c2paDays: c2pa?.days ?? undefined,
      // The deck state address, forwarded so the BROWSER tier applies the same one-slide
      // filter the web shell applies to `?s=`. Carried whenever it was given: a format the
      // filter skips is skipped there too (frameFilterApplies is the shared rule), so this
      // can never mean something different from the run that produced it.
      ...(slide ? { slide } : {}),
      // The HDR request and the depth request, for the two HDR STILL writers in
      // raster.ts (16-bit PQ PNG, ISO 21496-1 gain-map JPEG). Deliberately not
      // forwarded to the browser tier: the encode happens in Node over whichever
      // tier supplied the pixels, so an HDR file is the same bytes either way.
      ...(exportOpts.hdr ? { hdr: exportOpts.hdr } : {}),
      ...(depth !== 'auto' ? { depth } : {}),
      // ...and, for the formats whose HDR encode lives in the BROWSER (avif, tiff, the
      // 10-bit mp4/webm containers, and a jpg that declined the Node path), the same
      // request as the `hdr=` URL param the web auto-export reads. Before this an
      // `--hdr=1 --export=avif` came back SDR and said nothing.
      ...(hdr && !wantsNativeHdrStill(targetFormat, { hdr: exportOpts.hdr, depth: depth === 'auto' ? undefined : depth, durable: wantDurable }) ? { hdrParam: serializeHdr(hdr) } : {}),
      // Video controls (--fps/--seconds/--wait/--codec/--vq), forwarded to the browser
      // tier as the same URL params the web shell's export panel reads. The CLI is URL
      // mode under another transport, so a link and a command ask for the same clip.
      ...(video.fps != null || video.seconds != null || video.wait != null || video.codec || video.quality ? { video } : {}),
    };
    const viaRaster = async (): Promise<Buffer> => {
      const { renderRaster } = await import('./raster.ts');
      const res = await renderRaster({ runtime, dom, manifest: tool.manifest, format: targetFormat, dims });
      const bytes = Buffer.from(res.bytes);
      usedBrowser = res.usedBrowser;
      // Tier B == the web shell; it owns c2pa for that path - UNLESS an identity is
      // configured, in which case it was told `c2pa=off` above and this shell stamps.
      // `nodeEncoded` is the third case: the browser supplied only SOURCE PIXELS for an
      // HDR still and was told `c2pa=off`, so the credential goes on the file THIS
      // process wrote. Without it an `--hdr=1` export off the browser tier would carry
      // no Content Credential at all, silently.
      webShellExport = res.usedBrowser && !identity && !res.nodeEncoded;
      // Same third case: an HDR still marks its own pixels here, on either tier, so its
      // floor skip must be reported even when the browser supplied the source frame.
      if ((!res.usedBrowser || res.nodeEncoded) && wantImprint && res.imprinted === false) imprintFloorSkip = true;
      // Tier A (resvg) rasterises THIS runtime's own SVG, so a swallowed hook failure
      // yields a blank raster - gate it. Tier B re-renders in a real browser whose host
      // has the capability, so hookErrors don't describe those bytes; renderViaWebShell
      // already throws if the browser produced nothing.
      if (!usedBrowser) assertRenderOk({ hookErrors: runtime.hookErrors, format: targetFormat, bytes });
      return bytes;
    };

    // PRINT PREP THAT CANNOT BE APPLIED IS A REFUSAL, NOT A SHRUG.
    //
    // `--bleed=3mm --marks=crop,reg` used to produce output byte-identical to a run
    // without them, silently, exit 0 - the Tier-A resvg PNG path never saw the values at
    // all. For a print job that is the worst possible failure mode: it is discovered at
    // the press, on someone else's money.
    //
    // The honest boundary is narrow. computePrintGeometry is wired into exactly three
    // renderers in the web shell (renderPdf, renderCmykPdf, renderCmykTiff - see
    // shells/web/src/bridge/export.ts); nothing applies a bleed box or crop marks to a
    // PNG, an SVG or an EPS on any tier. So the allowlist is those three, and every other
    // format refuses by name rather than accepting flags it will ignore.
    if ((bleed || marksRaw) && !canCarryPrintPrep(targetFormat)) {
      throw unavailableHere(printPrepRefusal(targetFormat), 'PRINT_PREP_UNAVAILABLE');
    }

    // AN HDR STILL AND A DURABLE CREDENTIAL CANNOT BOTH BE PRODUCED HERE, and the
    // silent answer would be worse than either. `--hdr=1` now routes png/jpg through
    // this shell's own HDR writers (raster.ts), which have no neural TrustMark encoder
    // to call - that model is a browser feature. Letting it through would either drop
    // the credential the caller asked for or drop the HDR the caller asked for, with
    // nothing said. Exit 3, not 4: another installation (the web shell, the desktop
    // app) can do both, so a retry elsewhere is the right advice.
    if (hdr && wantDurable && ['png', 'jpg', 'jpeg'].includes(targetFormat.toLowerCase())) {
      throw unavailableHere(
        `--hdr and --durable cannot be combined for "${targetFormat}" in this shell. The HDR writers here `
        + '(16-bit Rec.2100-PQ PNG, ISO 21496-1 gain-map JPEG) run browser-free, and the durable Content '
        + 'Credential needs the neural TrustMark encoder, which is a browser feature. Drop one of the two '
        + 'flags, or export from the web shell or the desktop app, which can apply both. No file was written.',
        'HDR_DURABLE_UNAVAILABLE',
      );
    }

    // What the DOM-free attempt said, kept so a failed escalation can report BOTH halves
    // (why there is no browser-free path, and why the browser tier could not step in).
    let domFreeError: Error | null = null;
    try {
      try {
        // Engine-native / data formats (svg/emf/eps/dxf + html/json/csv/ics/vcf) render DOM-free
        // through the bridge. Raster/PDF/video route to raster.ts: Tier A (resvg, no browser)
        // for PNG from an SVG-native tool, else Tier B (the scoped Chromium driving the built
        // web shell). `usedBrowser` tells us to tear the browser + server down before exit.
        const domFree = NODE_FORMATS.includes(targetFormat.toLowerCase());
        if (domFree) {
          const blob = await runtime.export(exportNode, targetFormat, exportOpts);
          buf = Buffer.from(await blob.arrayBuffer());
          // The DOM-free render is this runtime's own output - a swallowed onInit failure
          // (e.g. an unavailable capability) yields an empty file. Refuse to write it.
          assertRenderOk({ hookErrors: runtime.hookErrors, format: targetFormat, bytes: buf });
        } else {
          buf = await viaRaster();
        }
      } catch (e) {
        // ESCALATION, not substitution. svg/emf/eps/dxf sit in NODE_FORMATS, so an
        // HTML-layout tool's "no root <svg>" used to end the story - even though the web
        // shell's HTML→SVG walker produces real vector for exactly that case. Retry at the
        // browser tier, the same way a raster format already does.
        //
        // The gate is a TYPE, not a phrase. The old fallback keyed on error prose and got
        // it wrong in both directions; "needs a browser engine" (plural verb) does not even
        // match needsBrowserTier's "needs a browser". So: escalate on any DOM-free failure
        // EXCEPT a RenderIntegrityError, which means this runtime's own render is broken
        // (a hook threw) and re-rendering it elsewhere would only launder the bug. If the
        // browser tier can't run either, both halves are reported and nothing is written.
        if (!VECTOR_ESCALATABLE.has(targetFormat.toLowerCase()) || (e as Error)?.name === 'RenderIntegrityError') throw e;
        domFreeError = e as Error;
        note(
          `Note: "${targetFormat}" has no browser-free path for this tool (${firstLine(domFreeError.message)}). ` +
          'Escalating to the browser render tier.',
        );
        buf = await viaRaster();
        domFreeError = null;
      }
    } catch (e) {
      // THE FORMAT IS NOT PRODUCIBLE HERE.
      //
      // What this used to do: notice a browser-ish error message, export HTML instead,
      // rename --output=aa.svg to aa.html, print a note, and EXIT 0. A pipeline that asked
      // for PDF received HTML and had no way to know. That is the single worst outcome
      // this shell can produce, so it is gone: the requested format either comes out or
      // the run fails, with nothing written at the requested path.
      //
      // The HTML artifact is still available, but only when asked for by name
      // (--html-fallback), because then the caller knows to expect it.
      //
      // FIRST, though: a render that is genuinely BROKEN is not a tier limitation and must
      // pass through untouched. A RenderIntegrityError (a hook threw) or a DeepSourceError
      // (float asked for over an 8-bit source) says something true about this render, and
      // neither an HTML file nor a "Cannot export" wrapper would be an honest answer - the
      // wrapper would even hand `lolly smoke` the FORMAT_UNAVAILABLE marker and get a
      // broken tool quietly re-rendered as html.
      // TEAR THE BROWSER TIER DOWN BEFORE LEAVING BY THE ERROR DOOR. The teardown at
      // the end of this function is on the success path only, so a Tier-B failure left
      // the pooled Chromium and the localhost dist server open with nothing to close
      // them: the CLI printed its error and then sat there, because the event loop
      // still had a listening socket and a browser process on it. `lolly` looked hung
      // rather than failed, which is a large part of why a Tier-B failure reads as
      // "the browser tier is broken". Both closes no-op when nothing was started.
      if (REAL_RENDER_FAILURES.has((e as Error)?.name)) { await teardownTierB(); throw e; }
      if (!htmlFallback || finalFormat === 'html') { await teardownTierB(); throw exportFailure(targetFormat, e as Error, domFreeError); }
      const blob = await runtime.export(canvas, 'html', {});
      buf = Buffer.from(await blob.arrayBuffer());
      assertRenderOk({ hookErrors: runtime.hookErrors, format: 'html', bytes: buf });
      finalFormat = 'html';
      webShellExport = false;
      usedBrowser = false;
      // Retarget --output to a .html name so the file's extension matches its content.
      if (outputPath) outputPath = outputPath.replace(/\.[^./\\]+$/, '') + '.html';
      warn('HTML_FALLBACK',
        `"${targetFormat}" could not be produced here (${firstLine((e as Error).message)}). ` +
        `--html-fallback was given, so HTML was written instead${outputPath ? ` - to ${outputPath}, NOT the name you asked for` : ''}.`);
    }

    // `--text=live` on the BROWSER tier is a no-op, and used to be a silent one: the flag
    // is applied by this shell's own DOM-free exporter, and the browser tier is driven
    // through a URL, where there is no reserved param for it (see RESERVED in
    // engine/src/url-mode.ts). A run that escalated therefore came back outlined while
    // the caller had asked for editable <text>, byte-identical to a run without the flag.
    // Say so rather than let the flag look honoured. The browser tier follows the
    // WEB defaults and `--text` does not travel to it: svg comes back outlined
    // (so an explicit `live` did not apply), and emf comes back LIVE since engine
    // 1.128 (so an explicit `outline` did not apply). Warn on exactly the
    // combination whose flag the produced file contradicts.
    if (webShellExport && text && (
      (text === 'live' && targetFormat.toLowerCase() !== 'emf') ||
      (text === 'outline' && targetFormat.toLowerCase() === 'emf'))) {
      warn('TEXT_LIVE_IGNORED',
        `--text=${text} did not apply: "${targetFormat}" for this tool was produced by the browser render tier, ` +
        `which follows the web default (${targetFormat.toLowerCase() === 'emf' ? 'live text records' : 'outlined text'}). ` +
        'The file is the same as one exported without the flag.');
    }

    // Runs the svg branch could not outline. Reported once per run, in the exporter's
    // own terms ("this word, in this font, stays live text"), and refused outright when
    // --strict says the pipeline wants outlines or nothing.
    if (textFallbacks.length) {
      const detail = textFallbacks.map(f => `"${f.text.slice(0, 40)}" (${f.reason})`).join('; ');
      if (isStrict()) {
        throw refused(
          `--strict: ${textFallbacks.length} text run${textFallbacks.length === 1 ? '' : 's'} could not be outlined and would ship as live <text> - ${detail}. ` +
          'No file was written. Install the font, or pass --text=live to accept live text.',
          'TEXT_NOT_OUTLINED',
        );
      }
      warn('TEXT_NOT_OUTLINED',
        `${textFallbacks.length} text run${textFallbacks.length === 1 ? '' : 's'} kept live <text> instead of outlines - ${detail}. ` +
        'Recipients without that font will see a different face.', 'gate');
    }
  }

  // Refuse bytes that are demonstrably a different container from the one requested - 
  // the --export=avif that quietly wrote PNG. Runs before the C2PA stamp (which picks its
  // embedder by format) and before anything is written.
  assertFormatBytes(finalFormat, buf);

  // Content Credentials are stamped into the finished bytes - URL mode's `c2pa` param
  // under the CLI transport (same last-byte-operation rule as the web shell's
  // stampC2pa). Applies to any C2PA-capable format the CLI produces (svg via the
  // engine; png/jpg/pdf via the raster tiers). ON BY DEFAULT since contract section 12 O2;
  // `--c2pa=off` / `--no-provenance` opt out. Ephemeral on-device signing only - 
  // verifiers report it unverified; the enrolled-identity path is a browser feature
  // (see docs/content-credentials-identity.md).
  //
  // EVERY "not stamped" message here is a `note` unless the caller ASKED for the
  // credential (askedC2pa). That distinction is the whole of "defaulting on must not
  // turn an existing refusal into an error": a password-locked PDF and a format with no
  // C2PA container were already documented skips, and under --strict a `warn` is an
  // exit code - so inheriting the default must never be the thing that fails a run.
  // Configuring an identity IS asking for the credential - louder, if anything, since
  // an unsigned file from a run that supplied a key is a promise this shell did not keep.
  const sayNotStamped = (code: string, message: string): void => {
    if (askedC2pa || askedIdentity) warn(code, message);
    else note(`Note: ${message}`);
  };
  if (wantC2pa && !webShellExport && C2PA_FORMATS.includes(finalFormat)) {
    // Only the paths that produced their OWN bytes here (DOM-free svg, Tier-A resvg PNG,
    // url-shot capture) stamp in Node. The Tier-B browser tier already stamped via the
    // forwarded ?c2pa param (exportUrl) - re-stamping would double the credential.
    if (finalFormat === 'pdf' && password) {
      sayNotStamped('C2PA_SKIPPED', 'password-locked export - skipping Content Credentials (an encrypted document cannot take the C2PA update).');
    } else {
      try {
        // The "what was this made from / where / when / how big" record, matching
        // the web shell's tools.lolly.export enrichment (shared with the TUI - 
        // buildExportC2paOpts also attaches the profile author under `useDetails`).
        const stamped = await embedC2pa(new Uint8Array(buf), finalFormat, buildExportC2paOpts({
          surface: 'cli', manifest: tool.manifest, model: runtime.getModel(),
          format: finalFormat, dims: { width, height, unit, dpi }, days: c2pa?.days, profile,
          // Absent = the ephemeral self-signed signer, unchanged. Present, the
          // credential carries the identity's x5chain and its certificate window.
          ...(identity ? { signer: identity.signer, signerValidity: { notBefore: identity.notBefore, notAfter: identity.notAfter } } : {}),
        }));
        buf = Buffer.from(stamped.buffer as ArrayBuffer, stamped.byteOffset, stamped.byteLength);
      } catch (e) {
        sayNotStamped('C2PA_SKIPPED', `Content Credentials not attached - ${(e as Error).message}`);
      }
    }
    // `askedIdentity` is qualified by `wantC2pa` here and NOT above: this branch says
    // "the format cannot carry a credential", which is only true when one was actually
    // wanted. Without the qualifier, `--sign-key` with `--c2pa=off` claimed SVG has no
    // C2PA container, which is false and points at the wrong thing - the identity is
    // unused because credentials are off, which the warning above already says.
  } else if ((askedC2pa || (askedIdentity && wantC2pa)) && !webShellExport) {
    // Only when ASKED. A format with no C2PA container (dxf, csv, md, …) cannot carry a
    // credential at all, so with the default on this branch would have printed a line on
    // every single data-format render - noise about a promise nobody made.
    warn('C2PA_SKIPPED', `format "${finalFormat}" has no C2PA container - Content Credentials skipped.`);
  }
  // The Imprint's own skip, same rule: a note by default, a warning when asked for.
  if (imprintFloorSkip) {
    const msg = 'the render is below the Lolly Imprint\'s detection floor (too few 8×8 luma blocks), '
      + 'so no pixel watermark was embedded. The file is otherwise unchanged, and a browser tier could not have marked it either.';
    if (imprint === true) warn('IMPRINT_SKIPPED', msg); else note(`Note: ${msg}`);
  }

  // `--filename=<name>` names the file when no --output was given (contract B6). It is
  // resolved against the working directory, never against the tool or the catalog.
  const destPath = outputPath ?? (filenameFlag ? resolve(process.cwd(), filenameFlag) : null);
  if (destPath) {
    await writeFile(destPath, buf);
    note(`✓ Wrote ${buf.length} bytes to ${destPath}`);
  } else {
    // AWAITED (contract B3): process.exit() right after a pipe write discards whatever
    // has not been flushed, which is how a 638 KB PNG arrived as 65536 bytes.
    await writeOut(buf);
  }

  // Tier B launches a pooled Chromium + a localhost dist server. This CLI run is
  // single-shot, so tear them down (the bin's explicit exit() would kill them anyway;
  // this keeps a programmatic caller from leaking a browser + open port).
  if (usedBrowser) await teardownTierB();
}

/**
 * Close the pooled Chromium and the localhost dist server, if either was started.
 *
 * Both closes are no-ops when Tier B never ran (each module holds its handle in a
 * module-level promise and clears it), so this is safe to call on any path - which is
 * the point: it is called from the render failure branch as well as the success tail.
 */
async function teardownTierB(): Promise<void> {
  const [{ closeBrowser }, { closeWebShell }] = await Promise.all([
    import('@lolly-tools/node-shell/browsers'), import('@lolly-tools/node-shell/webshell-render'),
  ]);
  await Promise.all([closeBrowser(), closeWebShell()]);
}

/**
 * Vector formats that live in NODE_FORMATS (the DOM-free engine tries them first) but
 * that the BROWSER tier can also produce - the web shell's HTML→SVG walker turns an
 * HTML-layout tool into real vector, and its EMF/EPS/DXF emitters ride the same IR.
 * `penpot` rides it too: the walker lowers an HTML-layout tool into the .penpot
 * writer's SVG input exactly the way it feeds those emitters, so a tool with no root
 * `<svg>` escalates to the browser tier instead of dying on the DOM-free refusal.
 * So a DOM-free failure on one of these is a reason to escalate, not to refuse.
 */
const VECTOR_ESCALATABLE = new Set(['svg', 'emf', 'eps', 'eps-cmyk', 'dxf', 'penpot']);

/**
 * Failures that describe THIS RENDER rather than this shell's tiers. They are never
 * escalated, never wrapped, and never answered with an HTML file - each already says
 * something true and actionable, and each is worded to survive being handled by name
 * rather than by phrase (see render-integrity.ts and raster.ts's deepSourceRefusal).
 */
const REAL_RENDER_FAILURES = new Set(['RenderIntegrityError', 'DeepSourceError', 'FormatMismatchError']);

const firstLine = (s: string): string => String(s ?? '').split('\n')[0]!.trim();

/** Read all of stdin as bytes - the `-` path for `file`-typed inputs and `validate -`. */
export async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks);
}

/**
 * The refusal for "this format cannot be produced here".
 *
 * Names both halves when there are two (no browser-free path AND the browser tier could
 * not step in), so the reader is not left guessing which piece is missing, and always
 * ends with the concrete way out. The underlying errors already carry the actionable
 * hints - `lolly install-browser` from browsers.ts, `npm run build:web` from
 * webshell-render.ts - so they are quoted rather than paraphrased.
 */
export function exportFailure(format: string, failure: Error, domFreeError: Error | null): Error {
  const parts = [`Cannot export "${format}".`];
  if (domFreeError) parts.push(`No browser-free path: ${firstLine(domFreeError.message)}`);
  parts.push(`${domFreeError ? 'And the full render tier is unavailable' : 'Reason'}: ${firstLine(failure.message)}`);
  parts.push('No file was written. Pass --html-fallback if an HTML artifact under a .html name is genuinely useful to you.');
  // A TYPED marker, not prose: `lolly smoke` (browser-free by budget rule) uses it to tell
  // "this tool needs the render tier I am not allowed to launch" from a real render bug,
  // without pattern-matching sentences. Same lesson as needsBrowserTier's sentinel.
  const err = new Error(parts.join(' ')) as Error & { cause?: unknown; code?: string; format?: string };
  err.cause = failure;
  err.code = 'FORMAT_UNAVAILABLE';
  err.format = format;
  return err;
}

/** Flags this shell reads itself, on top of url-mode's RESERVED set. */
export const CLI_FLAGS = new Set([
  'press-profile', 'user-profile', 'link-password', 'html-fallback', 'help', 'version',
  'text', 'password-stdin', 'share', 'link', 'verify', 'rate-card',
  // The one-word provenance opt-out (contract section 12 O2). Consumed in the render path
  // above; listed here so it is never reported as "not an input of <tool>".
  'no-provenance',
  // The enrolled signing identity (contract section 1.3). Both take a PATH - never key
  // material, which would be visible in `ps` to every user on the machine.
  'sign-key', 'sign-cert',
  // The browser tier's diagnostic switch: keeps the headless page's console and network
  // log and writes them beside the output when a Tier-B render fails. Listed here so it
  // is never reported as "not an input of <tool>".
  'tier-b-debug',
  // Global flags (contract section 1.2), consumed by the entry point but still present in the
  // params object a programmatic caller passes through.
  'quiet', 'verbose', 'strict', 'json',
]);

/**
 * Reserved params URL mode defines but this shell does not implement.
 *
 * They were accepted, ignored, and produced byte-identical output with no message
 * (contract B6). Each one now says so; `--strict` turns the whole run into an exit 2,
 * which is the pipeline author's opt-in rather than everyone's problem.
 *
 * Not in this list because they ARE handled: format/export/output/filename/width/height/
 * w/h/unit/dpi/profile/password/bleed/marks/c2pa/imprint/durable/hdr/depth/lang/z/zx,
 * and `cuts`, which is refused outright above.
 */
const UNSUPPORTED_RESERVED: Record<string, string> = {
  copy: 'the CLI cannot reach a clipboard',
  slot: 'saved slots are a GUI concept; the CLI is ephemeral',
  full: 'there is no viewport to go full-bleed in',
  options: 'the options panel is a GUI affordance',
  nostage: 'there is no stage chrome to suppress',
  _v: 'the CLI always runs the tool version on disk',
  // Presentation mode (plan 112) is a view state of a fullscreen shell. `s`, its
  // companion, IS honoured here - as the still-export slide filter - so it is not listed.
  present: 'there is no fullscreen to present into; `--s=<slide>` still selects one slide of a render',
};

export function unsupportedReservedParams(params: Record<string, string>): string[] {
  return Object.keys(params).filter(k => k in UNSUPPORTED_RESERVED);
}

function checkReservedParams(params: Record<string, string>): void {
  for (const k of unsupportedReservedParams(params)) {
    warn('RESERVED_UNSUPPORTED', `--${k} is not supported by the CLI (${UNSUPPORTED_RESERVED[k]}) and had no effect.`);
  }
}

/**
 * Warn when a reserved flag SHADOWS one of this tool's declared inputs.
 *
 * `lolly chart-creator --width=999 --share` printed a link containing `width=1080`: the
 * flag went to export sizing, the input kept its default, and nothing said so. Eight
 * shipped tools declare a `width`/`height` input and one declares `format`; renaming
 * them would break their URLs, which are a harder contract than this CLI, so the escape
 * hatch is a namespace (`--input.<id>=`) and the collision is announced (contract B7).
 */
export function shadowedInputs(
  params: Record<string, string>,
  manifest: { inputs?: Array<{ id: string; urlKey?: string }> },
): string[] {
  const declared = new Set<string>();
  for (const i of manifest.inputs ?? []) { declared.add(i.id); if (i.urlKey) declared.add(i.urlKey); }
  return Object.keys(params).filter(k => RESERVED.has(k) && declared.has(k));
}

function warnShadowedInputs(params: Record<string, string>, manifest: { id: string; inputs?: Array<{ id: string; urlKey?: string }> }): void {
  for (const k of shadowedInputs(params, manifest)) {
    warn('INPUT_SHADOWED',
      `--${k} is a reserved export flag AND an input of "${manifest.id}". The value went to the export, not to the input. ` +
      `Use --input.${k}=<value> to set the input.`);
  }
}

/**
 * Values from the explicit `--input.<id>=<value>` namespace (contract B7).
 *
 * Coercion goes through the ENGINE's own parser rather than a second implementation
 * here: each value is handed to `parseUrlState` under a synthetic, never-reserved
 * urlKey, so `--input.width=12` coerces exactly as `?width=12` would if `width` were
 * not reserved. One coercion rule, no drift.
 *
 * `--input.<vectorId>.<field>=` needs nothing: a dotted key is never reserved, so the
 * bare `--<vectorId>.<field>=` form already reaches the input.
 */
export function explicitInputValues(
  params: Record<string, string>,
  manifest: { inputs?: Array<{ id: string; urlKey?: string; type?: string }> },
  opts: { rejectUnknown?: boolean; tolerated?: ReadonlySet<string> } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const byId = new Map((manifest.inputs ?? []).map(i => [i.id, i] as const));
  for (const [key, raw] of Object.entries(params)) {
    if (!key.startsWith('input.')) continue;
    const id = key.slice('input.'.length);
    const spec = byId.get(id);
    // `--input.<vectorId>.<field>=n`: hand the dotted key to the engine verbatim. It is
    // never reserved, so parseUrlState's own vector-field branch resolves it.
    if (!spec && id.includes('.') && byId.has(id.slice(0, id.lastIndexOf('.')))) {
      const { values } = parseUrlState(new URLSearchParams([[id, raw]]).toString(), manifest as Parameters<typeof parseUrlState>[1]);
      Object.assign(out, values);
      continue;
    }
    if (!spec) {
      if (opts.rejectUnknown && !opts.tolerated?.has(key)) {
        throw usageError(`--input.${id} names no input of this tool. Nothing was rendered.`, 'UNKNOWN_INPUT');
      }
      warn('UNKNOWN_INPUT', `--input.${id} names no input of this tool and had no effect.`);
      continue;
    }
    // NOT underscore-prefixed: the `_` prefix is the reserved URL-param namespace
    // (plan 171) and parseUrlState skips such keys before input matching, which
    // silently broke the old `__lollyinput` sentinel. Collision-free by
    // construction either way: the synthetic manifest below holds only this one
    // spec.
    const alias = 'lollyinput';
    const { values } = parseUrlState(new URLSearchParams([[alias, raw]]).toString(), {
      inputs: [{ ...spec, urlKey: alias }],
    } as Parameters<typeof parseUrlState>[1]);
    if (id in values) out[id] = values[id];
  }
  return out;
}

/**
 * Warn about `--flags` that match nothing - no declared input, no `urlKey` alias, no
 * reserved param, no CLI flag. They were silently swallowed, so `--urll=https://…`
 * rendered the tool's defaults and said nothing. A warning, not an error: url-mode is
 * deliberately tolerant of extra params (a share link can carry view state a tool no
 * longer declares), and turning that into an exit-1 would break working links.
 */
export function unknownFlags(
  params: Record<string, string>,
  manifest: { inputs?: Array<{ id: string; urlKey?: string; type?: string }> },
): string[] {
  const inputs = manifest.inputs ?? [];
  const known = new Set<string>();
  for (const i of inputs) {
    known.add(i.id);
    if (i.urlKey) known.add(i.urlKey);
    known.add(`${i.id}-data`);          // --<blocks|table|text|longtext>-data=rows.csv|.xlsx
    known.add(`${i.id}-sheet`);         // --<input>-sheet=<name|index> (which .xlsx sheet)
  }
  const prefixes = inputs.map(i => `${i.id}.`);   // --<vector>.<field>=<number>
  return Object.keys(params).filter(
    k => !known.has(k) && !RESERVED.has(k) && !CLI_FLAGS.has(k) && !prefixes.some(p => k.startsWith(p))
      // --input.<id>= is the explicit input namespace; explicitInputValues reports the
      // ones that name nothing, with a message that fits what was actually asked for.
      && !k.startsWith('input.'),
  );
}

function warnUnknownFlags(
  params: Record<string, string>,
  manifest: { id: string; inputs?: Array<{ id: string; urlKey?: string }> },
  opts: { reject?: boolean; tolerated?: ReadonlySet<string> } = {},
): void {
  const unknown = unknownFlags(params, manifest).filter(k => !opts.tolerated?.has(k));
  if (!unknown.length) return;
  if (opts.reject) {
    throw usageError(
      `${unknown.map(k => `--${k}`).join(', ')} ${unknown.length === 1 ? 'is not an input' : 'are not inputs'} of "${manifest.id}". Nothing was rendered. Run \`lolly describe ${manifest.id}\` to list its inputs.`,
      'UNKNOWN_FLAG',
    );
  }
  warn('UNKNOWN_FLAG',
    `${unknown.map(k => `--${k}`).join(', ')} ${unknown.length === 1 ? 'is not an input' : 'are not inputs'} of "${manifest.id}" ` +
    `and had no effect. Run \`lolly describe ${manifest.id}\` to list its inputs.`);
}

/**
 * Decrypt a `zx=…` share link into the plain query it protects.
 *
 * Throws - never returns the encrypted query - because the alternative is what this
 * shell used to do: `zx` is reserved, parseUrlState ignores it, and the run quietly
 * produced the tool at its DEFAULTS with exit 0. A pipeline cannot tell that apart from
 * the real document. The two failure modes (no password, wrong password) are named
 * separately so the caller knows which it is.
 *
 * Readable params riding alongside `zx` are re-appended after the decoded state, so
 * on-visit flags still apply - the same rule expandQuery and the web shell follow.
 */
export async function decryptLinkQuery(query: string, password: string | undefined, consumesPlainPassword: boolean): Promise<string> {
  const sp = new URLSearchParams(query);
  const token = sp.get(ENC_PARAM) ?? '';
  if (!password) {
    // Exit 6 (AUTH), not a generic failure: a pipeline that can supply a password
    // should be able to tell "I need the password" from "the render broke".
    throw authError(
      'This is a password-protected link (zx=…) and no password was given. ' +
      'Pass --link-password=<password>. Nothing was rendered: without the password the state cannot be read, ' +
      'and rendering the tool at its defaults instead would hand you a different document under the right filename.',
    );
  }
  const decoded = await unpackEncrypted(token, password);
  if (decoded == null) {
    throw authError(
      'Could not open the password-protected link (zx=…): the password is wrong, or the token is truncated or tampered with. ' +
      'Nothing was rendered: falling back to the tool\'s defaults would hand you a different document under the right filename.',
    );
  }
  const extras: string[] = [];
  sp.forEach((v, k) => {
    if (k === ENC_PARAM) return;
    if (consumesPlainPassword && k === 'password') return;   // it was the LINK password, not a PDF lock
    extras.push(v === '' ? encodeURIComponent(k) : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });
  return extras.length ? `${decoded}&${extras.join('&')}` : decoded;
}

/**
 * Read one file out of the ACTIVE PROFILE's `tools/` view - the single reader every
 * entry point in this shell hands to `loadTool`. It was duplicated inline in two
 * places; `preflight.ts` needs a third, and three copies of a path join is how one of
 * them ends up reading a different tree.
 */
export async function readToolFile(path: string): Promise<string> {
  return readFile(join(REPO_ROOT, 'tools', path), 'utf8');
}

// Load a tool, turning a missing tool dir (ENOENT on tool.json) into a clean, THROWN
// error (not a process.exit) - so a batch loop can catch a bad-toolId row, honour
// --keep-going, and still print its summary, while the single-run path's top-level
// catch prints the same message and exits 1 as before. The substituted message hides
// the internal absolute path + errno the raw readFile ENOENT would leak.
export async function loadToolOrThrow(toolId: string, fetchFile: (path: string) => Promise<string>, opts: { lang?: Lang } = {}) {
  try {
    return await loadTool(toolId, fetchFile, opts);
  } catch (e) {
    if ((e as { code?: string })?.code === 'ENOENT') {
      // Exit 2 (USAGE): a tool id that does not exist is a wrong invocation, not a
      // failed render - a CI loop must be able to tell them apart (contract section 5.1).
      throw usageError(`Tool not found: ${toolId}. Run \`lolly list\` to list tools.`, 'UNKNOWN_TOOL');
    }
    throw e;
  }
}

/**
 * Read + parse a `--user-profile=path.json` file.
 *
 * A missing or unparseable file is a USAGE ERROR (exit 2), not a warning (contract B2).
 * It used to warn and render anyway, which shipped assets with every `bindToProfile`
 * field unfilled - the name, the email, the role all quietly blank, in a file that
 * looks finished. If you named a profile, you meant it.
 */
export async function readProfile(profilePath: string | undefined): Promise<Profile> {
  if (!profilePath) return {};
  let raw: string;
  try {
    raw = await readFile(resolve(process.cwd(), profilePath), 'utf8');
  } catch (e) {
    throw usageError(
      `Could not read the profile file "${profilePath}" (${(e as Error).message}). Nothing was rendered: ` +
      'continuing without it would silently leave every bindToProfile field empty.',
      'PROFILE_UNREADABLE',
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw usageError(`The profile file "${profilePath}" is not valid JSON (${(e as Error).message}).`, 'PROFILE_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw usageError(`The profile file "${profilePath}" must contain a JSON object.`, 'PROFILE_INVALID');
  }
  return parsed as Profile;
}

// Every issuer/label string on a dropped card is attacker-controlled bytes. Strip
// control characters (incl. ESC) before printing - the same threat class, and the
// same scrub, as the credential strings in validate.ts (a crafted card must not
// inject ANSI that forges a confirmation line).
const scrubCtl = cleanControlChars;

/**
 * Read + validate a `--rate-card=path.json` file, and print ONE confirmation line.
 *
 * Named `--rate-card`, never `--rate`/`--rates` - url-mode's reserved `profile` already
 * collides between `--profile` (the user-profile JSON) and `--press-profile` (the CMYK
 * condition); a third overloaded word is exactly the trip hazard docs/cli.md warns of.
 *
 * Unlike `--user-profile`, a missing/invalid/refused card WARNS and CONTINUES: the card
 * is not required to render, and this phase only LOADS and validates it - the cost output
 * is a later phase. On success it prints the issuer's own claim as REPORTED SPEECH, the
 * digest, and a priced-line COUNT. Nothing money-shaped: no rate, no currency figure,
 * no total. A number Lolly made up and presented as money is worse than showing nothing.
 */
async function loadRateCardCli(cardPath: string | undefined): Promise<void> {
  if (!cardPath) return;
  let bytes: Buffer;
  try {
    bytes = await readFile(resolve(process.cwd(), cardPath));
  } catch (e) {
    warn('RATE_CARD_UNREADABLE',
      `Could not read the rate card "${cardPath}" (${(e as Error).message}). Continuing without it.`);
    return;
  }
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const card = parseRateCard(bytes, digest, validateRateCard);
  if (isRateCardError(card)) {
    const why = card.error === 'no-priced-lines'
      ? 'it validates but has no priced lines, so nothing can be costed with it'
      : card.error === 'example-card'
        ? 'it is the shipped example - copy it and type your printer’s own rates'
        : 'it is not a rate card this can read';
    warn('RATE_CARD_REFUSED',
      `The rate card "${cardPath}" was refused (${card.error}): ${why}. Continuing without it.`);
    return;
  }
  // One confirmation line. Priced = lines with a usable numeric rate (the rest are
  // "counted only"); a COUNT, never a currency figure.
  const priced = card.lines.filter((l) => !l.disabled).length;
  const claimed = [card.issuer?.name, card.issuer?.issued].filter(Boolean).map(scrubCtl).join(', ');
  const said = claimed ? `The file says: ${claimed} (Lolly has not verified this). ` : '';
  note(`✓ Rate card loaded - ${said}${digest} · prices ${priced} of ${card.lines.length} lines. ` +
    'No prices are computed in this run.');
}

// True when the tool captures a live URL (url-shot) - its export drives Chromium
// straight at the page, bypassing the DOM export path. Mirrors the TUI's isCaptureTool.
function isCaptureTool(manifest: { capabilities?: string[] }): boolean {
  return (manifest.capabilities ?? []).includes('capture');
}

// Infer an export format from an --output filename's extension, but only when it
// names a format the tool actually declares - otherwise return null so the
// caller falls back to formats[0]. (.jpeg normalises to the canonical 'jpg'.)
/**
 * `jpg` and `jpeg` are ONE format with two spellings, and the catalog is split down the
 * middle (28 manifests declare `jpg`, 6 declare `jpeg`). Without this, `--export=jpg`
 * exited 2 on `qr-code` and `--export=jpeg` exited 2 on `d3` - the same flag succeeding
 * or failing depending on which tool you named, with `--help` advertising only `jpg` and
 * the docs advertising both. `--output=x.jpeg` already resolved the synonym, so the two
 * halves of one shell disagreed too.
 *
 * The alias resolves to the tool's OWN declared spelling, so nothing downstream (the
 * format gate, the raster tier, the format-byte sniff) has to learn about it. An
 * asymmetric alias is a name, and names freeze at GA - this is the window.
 */
export function resolveJpegSynonym(format: string, formats: readonly string[]): string {
  const f = format.toLowerCase();
  if (formats.includes(format)) return format;
  const alias = f === 'jpeg' ? 'jpg' : f === 'jpg' ? 'jpeg' : null;
  return alias && formats.includes(alias) ? alias : format;
}

export function formatFromOutput(path: string, formats: string[]): string | null {
  const ext = extname(path).slice(1).toLowerCase();
  if (!ext) return null;
  // Match against the tool's declared formats, tolerating the jpg/jpeg synonym split
  // (some tools declare 'jpeg', others 'jpg'). Prefer the exact declared spelling, so
  // e.g. `--output=x.jpeg` on a tool that declares 'jpeg' picks jpeg (not a silent SVG
  // fallback), and on a tool that declares 'jpg' picks jpg.
  if (formats.includes(ext)) return ext;
  const alias = ext === 'jpeg' ? 'jpg' : ext === 'jpg' ? 'jpeg' : null;
  if (alias && formats.includes(alias)) return alias;
  // The pro float formats are never declared per tool (see the format gate above), so
  // `--output=poster.exr` has to be honoured off the extension alone or it would
  // silently fall back to formats[0] and write an SVG into a .exr file.
  if (DEEP_FORMATS.includes(ext as never)) return ext;
  return null;
}

// Extension → MIME for a file-typed input loaded from disk. The hook can read
// the real bytes; this is the declared type the FileRef carries (best-effort).
function mimeForFile(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.png':  return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif':  return 'image/gif';
    case '.svg':  return 'image/svg+xml';
    case '.heic': return 'image/heic';
    case '.tif': case '.tiff': return 'image/tiff';
    case '.pdf':  return 'application/pdf';
    case '.json': return 'application/json';
    default: return 'application/octet-stream';
  }
}

/** One tool as `list --json` reports it: what it is, and whether it runs HERE. */
export interface ToolListing {
  id: string;
  name: string;
  description?: string;
  status: string;
  category?: string;
  formats: string[];
  capabilities: string[];
  /** Capabilities this shell cannot provide. Non-empty means `run` exits 3. */
  unmetCapabilities: string[];
  /** Declared formats this shell can produce with no browser. */
  nativeFormats: string[];
  /**
   * Can this installation run the tool at all? False when a capability is unmet - the
   * honest pre-flight answer for an agent, so it never has to learn it from an exit 3.
   * A tool with no native format is still `true`: the browser tier may be present, and
   * `environment.tiers.browser` says whether it is.
   */
  runnableHere: boolean;
}

export async function listToolsCli(opts: { json?: boolean } = {}): Promise<void> {
  const indexPath = join(REPO_ROOT, 'catalog', 'tools', 'index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8')) as {
    tools: Array<{ id: string; status: string; name: string; description?: string; category?: string; formats?: string[] }>;
  };
  if (!opts.json) {
    process.stdout.write('Available tools:\n');
    for (const t of index.tools) {
      process.stdout.write(`  ${t.id.padEnd(20)} [${t.status}] ${t.description ?? t.name}\n`);
    }
    return;
  }

  // The machine listing carries the manifest's `capabilities`, which the generated
  // index does not, so each manifest is read. A missing/unreadable one degrades to
  // "no declared capabilities" rather than failing the whole listing: `list` is how an
  // agent discovers the catalog, and one broken tool must not blind it to the rest.
  const { NODE_FORMATS } = await import('@lolly-tools/node-shell/raster');
  const tools: ToolListing[] = await Promise.all(index.tools.map(async (t) => {
    let capabilities: string[] = [];
    let formats = t.formats ?? [];
    try {
      const m = JSON.parse(await readFile(join(REPO_ROOT, 'tools', t.id, 'tool.json'), 'utf8')) as {
        capabilities?: string[]; render?: { formats?: string[] };
      };
      capabilities = m.capabilities ?? [];
      formats = m.render?.formats ?? formats;
    } catch { /* index-derived facts only */ }
    const unmet = unmetCapabilities({ capabilities });
    return {
      id: t.id,
      name: t.name,
      ...(t.description ? { description: t.description } : {}),
      status: t.status,
      ...(t.category ? { category: t.category } : {}),
      formats,
      capabilities,
      unmetCapabilities: unmet,
      nativeFormats: formats.filter(f => NODE_FORMATS.includes(f.toLowerCase())),
      runnableHere: unmet.length === 0,
    };
  }));

  const { describeEnvironment } = await import('./environment.ts');
  const { emitResult } = await import('./envelope.ts');
  await emitResult({ tools, environment: await describeEnvironment() });
}

/**
 * List catalog assets - the discovery half of "use the catalog as an input". An
 * `asset`-type input already accepts any of these ids (the engine resolves them), but
 * nothing surfaced the ids; this does. Optional substring query (id/name/tags) and a
 * `--type=` filter (raster/vector/lottie/palette/tokens/font/audio/video).
 */
export async function listAssetsCli(query?: string, opts: { type?: string; json?: boolean } = {}): Promise<void> {
  const indexPath = join(REPO_ROOT, 'catalog', 'assets', 'index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8')) as {
    assets: Array<{ id: string; name?: string; type: string; tags?: string[] }>;
  };
  const q = (query ?? '').trim().toLowerCase();
  const type = opts.type?.trim().toLowerCase();
  // A `--type=` no asset in this catalog has is a USAGE error, not "0 of 428". A typo'd
  // filter returning an empty list and exit 0 is the silent-wrong-answer class: a script
  // doing `lolly assets --type=rastor --json | jq '.result.assets[].id'` would emit
  // nothing and carry on. The known set is derived from the catalog, not hard-coded,
  // because a brand pack may ship types this shell has never heard of.
  if (type) {
    const known = [...new Set(index.assets.map(a => a.type.toLowerCase()))].sort();
    if (!known.includes(type)) {
      throw usageError(`No catalog asset has type "${opts.type}". This catalog has: ${known.join(', ')}.`, 'UNKNOWN_ASSET_TYPE');
    }
  }
  const matches = index.assets.filter(a => {
    if (type && a.type.toLowerCase() !== type) return false;
    if (!q) return true;
    const hay = `${a.id} ${a.name ?? ''} ${(a.tags ?? []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
  if (opts.json) {
    const { emitResult } = await import('./envelope.ts');
    // `total` and the echoed query are part of the answer: a filtered listing that
    // returns nothing is different from a catalog that has nothing.
    await emitResult({
      assets: matches,
      total: index.assets.length,
      ...(q ? { query } : {}),
      ...(type ? { type } : {}),
    });
    return;
  }
  const width = Math.min(48, matches.reduce((w, a) => Math.max(w, a.id.length), 0));
  process.stdout.write(
    `Catalog assets${type ? ` [${type}]` : ''}${q ? ` matching "${query}"` : ''} - ${matches.length} of ${index.assets.length}:\n`,
  );
  for (const a of matches) {
    process.stdout.write(`  ${a.id.padEnd(width)}  ${`(${a.type})`.padEnd(10)} ${a.name ?? ''}\n`);
  }
  process.stdout.write(
    `\nUse any id as an asset input, e.g.  lolly asset-export --src=${matches[0]?.id ?? '<id>'} --export=png\n`,
  );
}

export async function showToolInputsCli(toolId: string, opts: { lang?: Lang; json?: boolean; full?: boolean } = {}): Promise<void> {
  const tool = await loadToolOrThrow(toolId, readToolFile, opts);
  if (opts.json) {
    await describeToolJson(tool.manifest as DescribableManifest);
    return;
  }
  process.stdout.write(`${tool.manifest.name} (${tool.manifest.id} v${tool.manifest.version})\n`);
  process.stdout.write(`Status: ${tool.manifest.status}\n`);
  process.stdout.write(`Formats: ${tool.manifest.render.formats.join(', ')}\n`);
  const allInputs = tool.manifest.inputs ?? [];
  const exampleInput = allInputs.find(i => i.required)
    ?? allInputs.find(i => !i.showIf && ['url', 'text', 'longtext', 'color', 'number'].includes(i.type));
  const exampleValue = exampleInput
    ? exampleInput.type === 'url' ? 'https://example.com'
      : exampleInput.type === 'color' ? '#7c3aed'
        : exampleInput.type === 'number' ? String(exampleInput.default ?? 1)
          : exampleInput.type === 'file' || exampleInput.type === 'asset' ? './input-file'
            : String(exampleInput.default || 'Hello')
    : '';
  const exampleFlag = exampleInput
    ? ` --${RESERVED.has(exampleInput.id) ? `input.${exampleInput.id}` : exampleInput.id}=${/\s/.test(exampleValue) ? JSON.stringify(exampleValue) : exampleValue}`
    : '';
  const format = tool.manifest.render.formats.includes('svg') ? 'svg' : tool.manifest.render.formats[0];
  process.stdout.write(`\nTry it:\n  lolly ${tool.manifest.id}${exampleFlag} --output=${tool.manifest.id}.${format}\n\n`);

  const essentials = allInputs.filter(i => i.required || !i.showIf).slice(0, 8);
  const shown = opts.full ? allInputs : essentials;
  // Keep the long-standing `Inputs:` anchor for docs and shell parsers; the
  // human count/detail follows it instead of replacing it.
  process.stdout.write(opts.full || shown.length === allInputs.length
    ? `Inputs: ${allInputs.length}\n`
    : `Inputs: ${shown.length} essentials of ${allInputs.length}\n`);
  for (const i of shown) {
    const req = i.required ? ' [required]' : '';
    const def = i.default !== undefined ? ` (default: ${JSON.stringify(i.default)})` : '';
    process.stdout.write(`  --${i.id}=<${i.type}>${req}${def}\n`);
    if (i.help) process.stdout.write(`      ${i.help}\n`);
    const hint = syntaxHint(i.id, i.type);
    if (hint) process.stdout.write(`      ↳ ${hint}\n`);
  }
  if (!opts.full && shown.length < allInputs.length) {
    process.stdout.write(`\n${allInputs.length - shown.length} more inputs: lolly describe ${tool.manifest.id} --all\n`);
  }
}

/** The manifest slice `describe --json` reports (kept structural, like the rest of run.ts). */
interface DescribableManifest {
  id: string;
  name: string;
  version: string;
  status: string;
  description?: string;
  capabilities?: string[];
  hooks?: Record<string, unknown> | null;
  inputs: Array<{ id: string; type: string; urlKey?: string }>;
  render: { formats: string[]; width?: number; height?: number };
}

/**
 * `describe <tool> --json` - the machine half of the tool schema, and the thing an
 * agent needs to build an invocation without guessing.
 *
 * Each input is its DECLARED spec (the manifest is the source of truth for input
 * semantics - inventing a second shape here is how the web shell and the CLI would
 * drift) plus three computed facts the manifest cannot know:
 *
 *   • `flag` - the actual CLI spelling. For the nine shipped inputs whose id collides
 *     with a reserved export param (`width`, `height`, `format`), that is
 *     `--input.<id>=`, not `--<id>=`, and an agent reading `--width` off the manifest
 *     would silently set the export size instead of the input (contract B7).
 *   • `urlParam` - the compact `urlKey` alias when the tool declares one.
 *   • `syntax` - how the non-scalar types are expressed on a command line.
 */
async function describeToolJson(manifest: DescribableManifest): Promise<void> {
  const unmet = unmetCapabilities(manifest);
  const inputs = (manifest.inputs ?? []).map(i => {
    const shadowed = RESERVED.has(i.id) || (i.urlKey ? RESERVED.has(i.urlKey) : false);
    const syntax = syntaxHint(i.id, i.type);
    return {
      ...i,
      flag: shadowed ? `--input.${i.id}=` : `--${i.id}=`,
      ...(shadowed ? { shadowedByReservedParam: true } : {}),
      ...(i.urlKey ? { urlParam: i.urlKey } : {}),
      ...(syntax ? { syntax } : {}),
    };
  });
  const { emitResult } = await import('./envelope.ts');
  await emitResult({
    tool: {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      status: manifest.status,
      ...(manifest.description ? { description: manifest.description } : {}),
      formats: manifest.render.formats,
      ...(manifest.render.width ? { width: manifest.render.width } : {}),
      ...(manifest.render.height ? { height: manifest.render.height } : {}),
      capabilities: manifest.capabilities ?? [],
      nativeFormats: manifest.render.formats.filter(f => NODE_FORMATS.includes(f.toLowerCase())),
      unmetCapabilities: unmet,
      runnableHere: unmet.length === 0,
      // An experimental tool watermarks every export (the engine forces it). A script
      // that would ship the output needs to know that BEFORE it renders.
      watermarked: manifest.status === 'experimental',
    },
    inputs,
  });
}

/** URL-mode syntax hint for the non-scalar input types, so the CLI's `<tool>` help
 *  explains how to actually express them (the forms are otherwise undocumented). */
function syntaxHint(id: string, type: string): string {
  switch (type) {
    case 'asset':   return 'a catalog id (see `lolly assets`), a local image file, or a lolly.tools tool URL';
    case 'blocks':  return `a JSON array --${id}='[{…}]', tilde rows --${id}='label,val,#hex~…', or a data file --${id}-data=rows.csv`;
    case 'vector':  return `one flag per field, e.g. --${id}.<field>=<number>`;
    case 'file':    return 'a path to your file (read locally, never uploaded)';
    case 'color':   return '#RRGGBB (the # is optional) or a token path';
    case 'boolean': return `bare --${id} = true; --${id}=false to unset`;
    default:        return '';
  }
}
