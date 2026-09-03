// SPDX-License-Identifier: MPL-2.0
/**
 * The Node shells' full-fidelity render tier (CLI + TUI): for formats the DOM-free
 * engine can't make (HTML-layout raster, jpg/webp, pdf, video), drive a REAL Lolly web
 * shell in the scoped Chromium and capture the exact bytes its own export path
 * downloads. Terminal output is byte-identical to the web/desktop app, with no
 * second render path to drift.
 *
 * It serves the built web dist (`shells/web/dist`) from an ephemeral localhost server
 * and points Chromium at `#/tool/<id>?…&format=<fmt>&export=1`. Needs a build:
 * `npm run build:web` (or set LOLLY_WEB_DIST / LOLLY_WEB_BASE). If absent, a clear
 * error explains the one build step; svg and data formats render without it.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve, extname, normalize } from 'node:path';
import { getBrowser, BrowserError } from './browsers.ts';
import { repoRoot } from './repo-root.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json; charset=utf-8',
  // Legacy Windows-metafile type rather than RFC 7903 image/emf|image/wmf: it's
  // the only MIME Google Drive routes into Google Drawings/Slides.
  '.emf': 'application/x-msmetafile', '.wmf': 'application/x-msmetafile',
};

interface Served { base: string; close: () => Promise<void> }
let served: Promise<Served> | null = null;

/** Base origin of a Lolly web shell to drive (a running LOLLY_WEB_BASE, else served dist). */
async function webShellBase(): Promise<string> {
  const remote = process.env.LOLLY_WEB_BASE;
  if (remote) return remote.replace(/\/$/, '');
  if (!served) served = serveDist().catch(err => { served = null; throw err; });
  return (await served).base;
}

export async function closeWebShell(): Promise<void> {
  const s = served;
  served = null;
  if (s) { try { await (await s).close(); } catch { /* ignore */ } }
}

/** Serve the built web dist over localhost, SPA-style (unknown paths → index.html). */
function serveDist(): Promise<Served> {
  const dist = process.env.LOLLY_WEB_DIST || join(repoRoot(), 'shells', 'web', 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    throw new BrowserError(
      `No built web shell at ${dist}. Run \`npm run build:web\` (or set LOLLY_WEB_DIST to a ` +
      `prebuilt shell / LOLLY_WEB_BASE to a running one). Raster/PDF/video export needs it; ` +
      `svg and data formats render without it.`,
    );
  }
  const root = resolve(dist);
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]!);
      let filePath = resolve(root, '.' + normalize(urlPath));
      if (!filePath.startsWith(root)) { res.writeHead(403).end(); return; }
      if (urlPath === '/' || !existsSync(filePath) || !(await stat(filePath)).isFile()) {
        filePath = join(root, 'index.html');
      }
      const data = await readFile(filePath);
      res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      // CROSS-ORIGIN ISOLATION, the same pair vercel.json and shells/web/vite.config.js
      // send (`same-origin` + `credentialless`). Without them `crossOriginIsolated` is
      // false in the headless page, SharedArrayBuffer is absent, and the built shell's
      // threaded onnxruntime falls back or stalls - so the durable TrustMark embed
      // (?durable=1), the /valid deep scan and every model-backed export ran here under
      // different rules than the browser a person uses. This server is the ONLY place
      // the dist was served without them.
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise<Served>((ok) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      ok({ base: `http://127.0.0.1:${port}`, close: () => new Promise<void>(done => server.close(() => done())) });
    });
  });
}

// Reserved params we set ourselves on the export URL. Cleared from the inbound query
// first so the export dims/format/password win over anything the saved session encoded.
const EXPORT_URL_RESERVED = ['format', 'export', 'copy', 'width', 'w', 'height', 'h', 'unit', 'dpi', 'password', 'bleed', 'marks', 'imprint', 'durable', 'profile', 'c2pa', 'preview', 'options', 'fps', 'seconds', 'wait', 'codec', 'vq', 'hdr', 'depth'];

export function exportUrl(base: string, toolId: string, query: string, fmt: string, dims: RenderDims): string {
  const p = new URLSearchParams(query);
  for (const k of EXPORT_URL_RESERVED) p.delete(k);
  p.set('format', fmt);
  const unit = dims.unit || 'px';
  if (dims.width && dims.width > 0) p.set('width', String(dims.width));
  if (dims.height && dims.height > 0) p.set('height', String(dims.height));
  if (unit !== 'px') { p.set('unit', unit); p.set('dpi', String(dims.dpi || 300)); }
  if (dims.password) p.set('password', dims.password);   // standard PDF open-password
  // Print prep + provenance controls the web auto-export already honours (tool.ts reads
  // ?bleed/?marks/?imprint/?profile/?c2pa via parseUrlState). Threading them here is the
  // whole of the P3 fix: the geometry/watermark/press-intent lives in the web shell; the
  // Node shells were simply never carrying the values into the URL that drives it.
  if (dims.bleed) p.set('bleed', dims.bleed);                    // e.g. "3mm"
  if (dims.marks) p.set('marks', dims.marks);                    // CSV: crop,reg,bleed,bars,prov
  // The imprint is default-on in the web shell, so `false` has to travel as the explicit
  // `imprint=0` opt-out: forwarding only the true case would have made the Node shells'
  // --imprint=0 (and --no-provenance) a suggestion the browser tier quietly overrode.
  if (dims.imprint === false) p.set('imprint', '0');
  else if (dims.imprint) p.set('imprint', '1');                  // durable pixel watermark
  if (dims.durable) p.set('durable', '1');                       // neural TrustMark credential
  if (dims.pressProfile) p.set('profile', dims.pressProfile);    // URL 'profile' = CMYK press condition
  // Content Credentials: forward the setting so the web shell is the single c2pa authority
  // for the browser tier (the Node post-stamp is skipped when this path ran; see run.ts /
  // engine-render.ts, which avoids the pre-existing double-stamp).
  // The deck state address (plan 112): the web shell's still-export fan-out renders only
  // the named slide. Same param, same meaning as the link a person would paste.
  if (dims.slide) p.set('s', dims.slide);
  // Video controls (plan 183 follow-up): the panel's Frame rate / Duration / Start after /
  // Codec / Quality have URL forms now, and the CLI's --fps/--seconds/--wait/--codec/--vq
  // are those params under another transport. Written only when given.
  // HDR for the browser-encoded formats (avif/tiff/mp4/webm): the web auto-export reads
  // ?hdr= and writes Rec.2100 PQ; before this the CLI's --hdr=1 reached only the Node
  // still writers, so an HDR AVIF or TIFF came back SDR and said nothing.
  if (dims.hdrParam) p.set('hdr', dims.hdrParam);
  if (dims.video) {
    const v = dims.video;
    if (v.fps != null) p.set('fps', String(v.fps));
    if (v.seconds != null) p.set('seconds', String(v.seconds));
    if (v.wait != null) p.set('wait', String(v.wait));
    if (v.codec) p.set('codec', v.codec);
    if (v.quality) p.set('vq', v.quality);
  }
  if (dims.c2pa === false) p.set('c2pa', 'off');
  else if (dims.c2pa) p.set('c2pa', [7, 30, 90, 365].includes(Number(dims.c2paDays)) ? String(dims.c2paDays) : '1');
  p.set('export', '1'); // presence flag → the web shell auto-exports on load
  return `${base}/#/tool/${encodeURIComponent(toolId)}?${p.toString()}`;
}

/** How long to wait for the download. Video records in real time. */
function timeoutFor(fmt: string): number {
  const f = fmt.toLowerCase();
  if (['webm', 'mp4', 'gif', 'apng'].includes(f)) return 180_000;
  if (['pdf', 'pdf-cmyk', 'cmyk-tiff', 'tiff'].includes(f)) return 90_000;
  return 60_000;
}

// ── Tier-B debug (--tier-b-debug / LOLLY_TIER_B_DEBUG=1) ──────────────────────
//
// A Tier-B failure used to be one sentence with no evidence in it: "the web shell
// produced no mp4 in time" says nothing about WHICH of the five steps ran out, and
// the console error that actually explains it died with the browser context. With
// the switch on, the page's console, its page errors and its network log are kept,
// the step timings are recorded, and on failure the whole lot is written beside the
// output file - so the next question is answerable from the log rather than from a
// second run with a hand-patched module.

interface TierBDebugConfig {
  enabled: boolean;
  /** The run's output path; the log is written as `<outPath>.tier-b-debug.log`. */
  outPath: string | null;
}
let tierBDebugConfig: TierBDebugConfig = { enabled: false, outPath: null };

/** Turn the Tier-B debug log on for this process and say where the output is written. */
export function configureTierBDebug(cfg: { enabled?: boolean; outPath?: string | null }): void {
  tierBDebugConfig = {
    enabled: cfg.enabled ?? tierBDebugConfig.enabled,
    outPath: cfg.outPath === undefined ? tierBDebugConfig.outPath : cfg.outPath,
  };
}

function tierBDebugOn(): boolean {
  return tierBDebugConfig.enabled || /^(1|true|on|yes)$/i.test(process.env.LOLLY_TIER_B_DEBUG ?? '');
}

/** How much of each log we keep - enough to diagnose, bounded so a chatty page
 *  cannot grow the process without limit. */
const DEBUG_MAX_LINES = 500;

interface DebugRecorder {
  /** Begin a named step; the previous one is closed with its duration. */
  step(name: string): void;
  /** Attach console/pageerror/network listeners to the page. */
  attach(page: import('playwright-core').Page): void;
  /** The step that was running, and how long it had been running, at failure. */
  where(): string;
  /** Write the log beside the output. Returns the path, or null when nothing was written. */
  write(label: string, failure: string): string | null;
}

/** A no-op recorder is cheaper than a null check at every call site. */
const NO_DEBUG: DebugRecorder = {
  step: () => {}, attach: () => {}, where: () => '', write: () => null,
};

function startDebug(): DebugRecorder {
  if (!tierBDebugOn()) return NO_DEBUG;
  const t0 = Date.now();
  const steps: Array<{ name: string; at: number; ms?: number }> = [];
  const console_: string[] = [];
  const network: string[] = [];
  // One log per render. `write` is idempotent so the download-timeout sentence and the
  // outer catch (which covers a failed navigation, a dead browser, a missing dist)
  // cannot produce two files or two paths in one message.
  let writtenPath: string | null | undefined;
  const at = (): string => `${((Date.now() - t0) / 1000).toFixed(2)}s`;
  const push = (into: string[], line: string): void => {
    if (into.length < DEBUG_MAX_LINES) into.push(`[${at()}] ${line}`);
    else if (into.length === DEBUG_MAX_LINES) into.push(`… (further lines dropped at ${DEBUG_MAX_LINES})`);
  };
  return {
    step(name: string): void {
      const prev = steps[steps.length - 1];
      if (prev) prev.ms = Date.now() - prev.at;
      steps.push({ name, at: Date.now() });
    },
    attach(page): void {
      page.on('console', (m) => push(console_, `${m.type()}: ${m.text()}`));
      page.on('pageerror', (e) => push(console_, `pageerror: ${e.message}`));
      page.on('requestfailed', (r) => push(network, `FAILED ${r.method()} ${r.url()} - ${r.failure()?.errorText ?? 'unknown'}`));
      page.on('response', (r) => push(network, `${r.status()} ${r.request().method()} ${r.url()}`));
    },
    where(): string {
      const cur = steps[steps.length - 1];
      if (!cur) return '';
      return `step "${cur.name}" after ${((Date.now() - cur.at) / 1000).toFixed(1)}s`;
    },
    write(label: string, failure: string): string | null {
      if (writtenPath !== undefined) return writtenPath;
      const cur = steps[steps.length - 1];
      if (cur) cur.ms = Date.now() - cur.at;
      const lines = [
        `Lolly Tier-B debug - ${label}`,
        `failed: ${failure}`,
        '',
        'STEPS (the last one is where it stopped)',
        ...steps.map(s => `  ${s.name}: ${((s.ms ?? 0) / 1000).toFixed(2)}s`),
        '',
        `CONSOLE (${console_.length})`,
        ...(console_.length ? console_.map(l => `  ${l}`) : ['  (nothing)']),
        '',
        `NETWORK (${network.length})`,
        ...(network.length ? network.map(l => `  ${l}`) : ['  (nothing)']),
        '',
      ];
      const path = tierBDebugConfig.outPath
        ? `${tierBDebugConfig.outPath}.tier-b-debug.log`
        : join(process.cwd(), `lolly-tier-b-debug-${label.replace(/[^a-z0-9.-]+/gi, '-')}.log`);
      try {
        writeFileSync(path, lines.join('\n'), 'utf8');
        writtenPath = path;
      } catch {
        writtenPath = null;
      }
      return writtenPath;
    },
  };
}

/** Attach the debug log to a Tier-B failure that is not already carrying one - a failed
 *  navigation, a page that closed under us, a download that yielded no file. */
function withDebugLog(err: unknown, label: string, debug: DebugRecorder): unknown {
  const log = debug.write(label, err instanceof Error ? err.message : String(err));
  if (log && err instanceof Error && !err.message.includes(log)) {
    err.message += ` Debug log: ${log}`;
  }
  return err;
}

/** The download-timeout sentence, with the debug log's evidence when it is on. */
function noFileError(toolId: string, format: string, debug: DebugRecorder): BrowserError {
  const where = debug.where();
  const log = debug.write(`${toolId}.${format}`, `no "${format}" file (${where || 'download wait'})`);
  return new BrowserError(
    `The web shell produced no "${format}" file for "${toolId}" in time - the tool may have ` +
    `failed to render or doesn't support that format. Try a different format or check the inputs.` +
    (where ? ` Timed out in ${where}.` : '') +
    (log ? ` Debug log: ${log}` : tierBDebugOn() ? '' : ' Re-run with --tier-b-debug for the browser console and network log.'),
  );
}

export interface RenderDims {
  width?: number; height?: number; unit?: string; dpi?: number;
  /** Standard PDF open-password (basic RC4 lock). */
  password?: string;
  /** Bleed amount as a dimension string (e.g. "3mm") for the print formats. */
  bleed?: string;
  /** Print marks CSV (crop,reg,bleed,bars,prov) for the print formats. */
  marks?: string;
  /** Embed the durable Lolly pixel watermark on raster exports. */
  /** `false` = the explicit opt-out (forwarded as `imprint=0`); `null`/absent = let the
   *  web shell apply its own default. */
  imprint?: boolean | null;
  /** Embed the opt-in durable Content Credential (neural TrustMark mark) on raster
   *  exports. The web shell's durableEmbedCanvas runs it (?durable=1). */
  durable?: boolean;
  /** Video export controls for the motion formats, forwarded as the URL params the web
   *  shell's auto-export reads (`fps`, `seconds`, `wait`, `codec`, `vq` - url-mode.ts).
   *  Null/undefined fields are simply not written, so the shell keeps its defaults. */
  video?: { fps?: number | null; seconds?: number | null; wait?: number | null; codec?: string | null; quality?: string | null };
  /** The serialised `hdr=` value (url-mode's serializeHdr: `1` or `peak-reach-lift-richness`)
   *  for the formats whose HDR encode lives in the browser - AVIF, TIFF and the 10-bit
   *  mp4/webm containers. PNG/JPEG HDR stills are encoded in Node and never set this. */
  hdrParam?: string | null;
  /** CMYK press condition (e.g. "fogra39") for pdf-cmyk / cmyk-tiff. Named distinctly
   *  from the CLI's --profile (the user-profile FILE) to avoid the url-mode collision. */
  pressProfile?: string;
  /** Content Credentials: true/off/undefined. undefined ⇒ the web shell's tool default. */
  c2pa?: boolean | null;
  /** Ephemeral-certificate lifetime in days (7/30/90/365) when c2pa is on. */
  c2paDays?: number | null;
  /** The deck state address (url-mode's `s`, plan 112): a 1-based slide position, a frame
   *  id, or either with an `.N` build suffix. Forwarded so the web shell's per-slide export
   *  fan-out renders just that slide - the browser tier is the CLI's still-export path for
   *  every raster/pdf format, so without it `--s=` would silently mean nothing there. */
  slide?: string | null;
}

/** One file's deep-scan outcome from deepScanViaWebShell. */
export interface DeepScanResult {
  file: string;
  /** False when the /valid view never offered a scan for this batch (no decodable
   *  raster, WASM unavailable) or the detector download failed. */
  scanned: boolean;
  /** Lolly's own durable identifier decoded from the pixels (TrustMark-format,
   *  error-correction passed). The ?durable=1 mark, readable after a metadata strip. */
  lollyDurable: boolean;
  /** A generic/foreign Adobe TrustMark payload decoded (not Lolly's id). */
  trustmark: boolean;
  /** A Meta Content Seal mark decoded. */
  contentSeal: boolean;
  /** The human-readable note the /valid view rendered for this file, if any. */
  note: string | null;
}

/**
 * Drive the web shell's /#/valid deep scan (the neural TrustMark / Content Seal
 * detectors) over local files and report, per file, whether Lolly's durable mark
 * or a foreign watermark was decoded from the pixels. This is the verify-side
 * counterpart of the ?durable=1 export: the same on-device ONNX decode the browser
 * runs, driven headlessly so `lolly validate --deep` and the TUI can read the mark.
 * The models are served from the built dist (fetched fresh per run: the ephemeral
 * browser context has no IndexedDB cache), so it needs the same build:web setup as
 * the render tier. A negative result is not proof of absence (per the watermark
 * detectors' own policy); callers must word it that way.
 */
export async function deepScanViaWebShell(files: string[]): Promise<DeepScanResult[]> {
  const base = await webShellBase();
  const browser = await getBrowser();
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await ctx.newPage();
    await page.goto(`${base}/#/valid`, { waitUntil: 'load', timeout: 30_000 });
    await page.setInputFiles('input[type="file"]', files);
    // The consent banner injects only after the per-file verdicts + passive pixel
    // checks land, and only when something in the batch is deep-scannable.
    const enable = page.locator('[data-deep-scan-enable]');
    const offered = await enable.first().waitFor({ state: 'visible', timeout: 45_000 }).then(() => true, () => false);
    if (!offered) {
      return files.map(f => ({ file: f, scanned: false, lollyDurable: false, trustmark: false, contentSeal: false, note: null }));
    }
    await enable.first().click();
    // Success removes the banner (then scans run file-by-file); a failed download
    // leaves the banner up with an error message. Wait for either.
    await page.waitForFunction(() => {
      const banner = document.querySelector('[data-deepscan-banner]');
      if (!banner) return true;
      const msg = banner.querySelector('[data-deepscan-banner-msg]')?.textContent || '';
      return /couldn|failed/i.test(msg);
    }, { timeout: 180_000 });
    const failed = await page.locator('[data-deepscan-banner]').count();
    if (failed) {
      return files.map(f => ({ file: f, scanned: false, lollyDurable: false, trustmark: false, contentSeal: false, note: null }));
    }
    // The per-file scans pop results in sequentially with no "all done" marker.
    // Poll until the findings snapshot is stable for a quiet period.
    const snapshot = (): Promise<Array<{ pips: string[]; note: string }>> => page.evaluate((count: number) =>
      Array.from({ length: count }, (_, i) => {
        const block = document.querySelector(`[data-deepscan-block="${i}"]`);
        const scope = block?.closest('.valid-item') ?? document;
        const pips = [...scope.querySelectorAll('[data-deepscan-pip]')].map(p => (p.textContent || '').replace(/\s+/g, ' ').trim());
        const note = (block?.querySelector(`[data-deepscan-result="${i}"]`)?.textContent || '').replace(/\s+/g, ' ').trim();
        return { pips, note };
      }), files.length);
    const QUIET_MS = 8_000, MAX_MS = 240_000, STEP_MS = 1_000;
    let last = JSON.stringify(await snapshot());
    let quiet = 0;
    for (let waited = 0; waited < MAX_MS && quiet < QUIET_MS; waited += STEP_MS) {
      await page.waitForTimeout(STEP_MS);
      const now = JSON.stringify(await snapshot());
      quiet = now === last ? quiet + STEP_MS : 0;
      last = now;
    }
    const found = JSON.parse(last) as Array<{ pips: string[]; note: string }>;
    // Text-matched against the /valid view's own en strings (the served dist runs
    // untranslated here). The durable note's heading is the most specific signal.
    return files.map((f, i) => {
      const r = found[i] ?? { pips: [], note: '' };
      const hay = [r.note, ...r.pips].join(' · ');
      const lollyDurable = /durable lolly credential|lolly durable mark/i.test(hay);
      return {
        file: f, scanned: true, lollyDurable,
        trustmark: !lollyDurable && /trustmark/i.test(hay),
        contentSeal: /content seal/i.test(hay),
        note: r.note || null,
      };
    });
  } finally {
    await ctx.close();
  }
}

/** A file handed to the browser tier for a transform (file-in → file-out) tool. */
export interface TransformFile { name: string; mime: string; bytes: Uint8Array }

export interface TransformViaWebShellArgs {
  toolId: string;
  /** The manifest's `file`-typed input id (the picker the bytes are dropped into). */
  fileInputId: string;
  file: TransformFile;
  /** The tool's URL-state (serializeUrlState): everything except the file itself. */
  query?: string;
  timeoutMs?: number;
}

/**
 * Run a transform tool (file-in to file-out, the `exportFile` hook) in the real web
 * shell and capture the file it downloads. The Node host has no canvas and no PDF
 * page renderer, so utilities that rebuild pixels, redact above all, cannot run
 * their export in jsdom. This drives the exact browser path a user clicks, so the
 * tool's own export gate runs on the same bytes the caller receives.
 *
 * It uploads the bytes into the sidebar file picker (`setInputFiles` with an
 * in-memory payload; nothing is written to disk) and clicks the template's
 * `[data-export-file]` button. A hook that throws (a failed verification gate)
 * puts its sentence on that button and downloads nothing. We surface that sentence
 * as the thrown error, so a failed gate is a failure here too, never a quiet pass.
 */
export async function transformViaWebShell(
  { toolId, fileInputId, file, query = '', timeoutMs = 120_000 }: TransformViaWebShellArgs,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const base = await webShellBase();
  const p = new URLSearchParams(query);
  p.delete('export');            // the render auto-export is not this path
  const q = p.toString();
  const url = `${base}/#/tool/${encodeURIComponent(toolId)}${q ? `?${q}` : ''}`;
  const browser = await getBrowser();
  const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
  try {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    const picker = `.file-picker[data-input-id="${fileInputId}"] input.file-native`;
    try {
      await page.waitForSelector(picker, { state: 'attached', timeout: 30_000 });
    } catch {
      throw new BrowserError(
        `The web shell showed no file picker for "${fileInputId}" on "${toolId}" - the built shell ` +
        `may predate this tool. Rebuild it with \`npm run build:web\`.`,
      );
    }
    await page.setInputFiles(picker, {
      name: file.name, mimeType: file.mime || 'application/octet-stream', buffer: Buffer.from(file.bytes),
    });
    const button = '[data-export-file]';
    try {
      await page.waitForSelector(`${button}:not([disabled])`, { state: 'visible', timeout: 60_000 });
    } catch {
      throw new BrowserError(
        `"${toolId}" never offered its export button after the file was loaded - the tool may have ` +
        `refused this file. Open the same inputs in the app to see what it says.`,
      );
    }
    // A tool whose canvas still owes the inputs work says so with
    // [data-export-wait] (redact: page previews rendering, or bars that arrived
    // as instructions and have not been snapped to cover against the real page
    // yet). The export button enables before that settles, so clicking on sight
    // shipped bars exactly as supplied, with none of the geometry correction a
    // person gets. Best-effort: if it never clears we go ahead anyway rather
    // than turning a slow page into a hard failure.
    await page.waitForFunction(() => !document.querySelector('[data-export-wait]'), undefined, { timeout: 30_000 })
      .catch(() => {});
    const downloadP = page.waitForEvent('download', { timeout: timeoutMs })
      .then(d => ({ kind: 'download' as const, d }), (e: Error) => ({ kind: 'timeout' as const, e }));
    // The click handler paints a thrown hook error onto the button (is-error + the
    // sentence). Never settles when no error appears, so the download always wins.
    const errorP = page.waitForFunction(
      () => {
        const b = document.querySelector('[data-export-file]');
        return b && b.classList.contains('is-error') ? (b.textContent || '').trim() || 'Export failed.' : null;
      },
      undefined,
      { timeout: timeoutMs },
    ).then(h => h.jsonValue() as Promise<string>).then(
      msg => ({ kind: 'error' as const, msg }),
      () => new Promise<never>(() => {}),
    );
    await page.click(button);
    const outcome = await Promise.race([downloadP, errorP]);
    if (outcome.kind === 'error') throw new Error(outcome.msg);
    if (outcome.kind === 'timeout') {
      throw new BrowserError(
        `"${toolId}" produced no file for ${file.name} within ${Math.round(timeoutMs / 1000)}s. ` +
        `Nothing was written.`,
      );
    }
    const path = await outcome.d.path();
    if (!path) throw new BrowserError(`Download for "${toolId}" yielded no file.`);
    const bytes = new Uint8Array(await readFile(path));
    const filename = outcome.d.suggestedFilename() || file.name;
    await outcome.d.delete().catch(() => {});
    return { bytes, filename };
  } finally {
    await ctx.close();
  }
}

/**
 * Render a tool to bytes by driving the web shell in Chromium and capturing its
 * download. `query` is the tool's current URL-state (serializeUrlState).
 */
export async function renderViaWebShell(
  toolId: string, query: string, format: string, dims: RenderDims = {},
): Promise<{ bytes: Uint8Array; mime: string }> {
  // The durable embed is best-effort inside the web shell (it never fails an export),
  // so a dist without the encoder model would silently write an unmarked file while
  // the caller believes it's protected. Fail loud up front instead. The mark is the
  // whole point of ?durable=1. Only checkable for a local dist; a remote
  // LOLLY_WEB_BASE serves its own models (or not) and we can't see its filesystem.
  if (dims.durable && !process.env.LOLLY_WEB_BASE) {
    const dist = process.env.LOLLY_WEB_DIST || join(repoRoot(), 'shells', 'web', 'dist');
    if (!existsSync(join(dist, 'models', 'trustmark', 'encoder_Q.onnx'))) {
      throw new BrowserError(
        `The durable credential needs the TrustMark encoder model, which isn't in the built ` +
        `web shell (${join(dist, 'models', 'trustmark', 'encoder_Q.onnx')}). Rebuild it with ` +
        `\`npm run build:web\` (the model ships in shells/web/public), or export without --durable.`,
      );
    }
  }
  const debug = startDebug();
  debug.step('serve the built web shell');
  const base = await webShellBase();
  const url = exportUrl(base, toolId, query, format, dims);
  debug.step('launch the browser');
  const browser = await getBrowser();
  const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
  try {
    const page = await ctx.newPage();
    debug.attach(page);
    const downloadP = page.waitForEvent('download', { timeout: timeoutFor(format) });
    debug.step('open the tool page');
    await page.goto(url, { waitUntil: 'commit', timeout: 30_000 });
    debug.step(`wait for the ${format} download`);
    let download: Awaited<typeof downloadP>;
    try {
      download = await downloadP;
    } catch {
      throw noFileError(toolId, format, debug);
    }
    debug.step('read the downloaded bytes');
    const path = await download.path();
    if (!path) throw new BrowserError(`Download for "${toolId}" yielded no file.`);
    const bytes = new Uint8Array(await readFile(path));
    await download.delete().catch(() => {});
    return { bytes, mime: MIME['.' + format.toLowerCase()] ?? 'application/octet-stream' };
  } catch (err) {
    throw withDebugLog(err, `${toolId}.${format}`, debug);
  } finally {
    await ctx.close();
  }
}

/**
 * Prototype: an opt-in alternative to renderViaWebShell for motion formats only
 * (gif/apng/webm/mp4). renderViaWebShell lets the web shell's own capture loop run
 * inside headless Chromium exactly as it does in a real browser tab, frame-by-frame
 * via dom-to-image (clone, serialize, rasterize). That means every export-fidelity
 * edge case dom-to-image has (documented against known bugs elsewhere in the export
 * path) applies here too, and it runs in real time: a 5s clip takes at least 5s of
 * capture.
 *
 * This drives the same tool page and the same client-side pipeline (deterministic
 * clock, scrubAnimations, WebCodecs encode, C2PA/watermark stamping; none of that
 * is duplicated here), but replaces dom-to-image's per-frame capture with a real
 * Playwright screenshot of the live #tool-canvas element: genuine Chromium paint,
 * no clone/serialize/reinterpret step. The bridge is `page.exposeFunction`. The web
 * shell's frame() (shells/web/src/bridge/export.ts) detects
 * window.__lollyCaptureScreenshot and calls it instead of dom-to-image when present.
 *
 * deviceScaleFactor: 1 is required. The client scales the live node's CSS size
 * to the export's target pixel dimensions itself (mirroring dom-to-image's own
 * scale-transform trick) and expects a 1:1 CSS-px to screenshot-px mapping.
 *
 * Not wired into the default CLI/MCP render path. Opt in via
 * LOLLY_VIDEO_CAPTURE=screenshot (see shells/cli/src/raster.ts) while this proves
 * itself out; renderViaWebShell remains the default for every caller.
 */
export async function renderVideoViaScreenshot(
  toolId: string, query: string, format: string, dims: RenderDims = {},
): Promise<{ bytes: Uint8Array; mime: string }> {
  const debug = startDebug();
  debug.step('serve the built web shell');
  const base = await webShellBase();
  const url = exportUrl(base, toolId, query, format, dims);
  debug.step('launch the browser');
  const browser = await getBrowser();
  // Generous viewport so #tool-canvas renders near its native size rather than the
  // web shell's own "fit to view" zooming it down to fit a small window. The client
  // upscales whatever comes back, but starting from a full-resolution screenshot
  // keeps it sharp instead of upscaling an already-shrunk raster.
  const vw = Math.min(4000, Math.max(1400, (dims.width ?? 1000) + 500));
  const vh = Math.min(4000, Math.max(1000, (dims.height ?? 1000) + 300));
  const ctx = await browser.newContext({
    serviceWorkers: 'block', acceptDownloads: true, deviceScaleFactor: 1,
    viewport: { width: vw, height: vh },
  });
  try {
    const page = await ctx.newPage();
    // Exposed before navigation. The binding survives the goto() below and every
    // frame() call for the life of this page.
    await page.exposeFunction('__lollyCaptureScreenshot', async (): Promise<string | null> => {
      const handle = await page.$('#tool-canvas');
      if (!handle) return null;
      const buf = await handle.screenshot({ type: 'png' });
      return buf.toString('base64');
    });
    debug.attach(page);
    const downloadP = page.waitForEvent('download', { timeout: timeoutFor(format) });
    debug.step('open the tool page');
    await page.goto(url, { waitUntil: 'commit', timeout: 30_000 });
    debug.step(`wait for the ${format} download`);
    let download: Awaited<typeof downloadP>;
    try {
      download = await downloadP;
    } catch {
      throw noFileError(toolId, format, debug);
    }
    debug.step('read the downloaded bytes');
    const path = await download.path();
    if (!path) throw new BrowserError(`Download for "${toolId}" yielded no file.`);
    const bytes = new Uint8Array(await readFile(path));
    await download.delete().catch(() => {});
    return { bytes, mime: MIME['.' + format.toLowerCase()] ?? 'application/octet-stream' };
  } catch (err) {
    throw withDebugLog(err, `${toolId}.${format}`, debug);
  } finally {
    await ctx.close();
  }
}
