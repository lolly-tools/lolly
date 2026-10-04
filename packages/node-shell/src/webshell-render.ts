// SPDX-License-Identifier: MPL-2.0
import { observeProductionInputs, type ProductionBrowserOptions } from './production-browser.ts';
import { serializeMotionParams } from '../../../engine/src/motion-sampling.ts';
/**
 * The Node shells' full-fidelity render tier (CLI + TUI): for formats the DOM-free
 * engine can't make (HTML-layout raster, jpg/webp, pdf, video), drive a REAL Lolly web
 * shell in the scoped Chromium and capture the exact bytes its own export path
 * downloads. Terminal output is byte-identical to the web/desktop app, with no
 * second render path to drift.
 *
 * It serves the built web dist (`shells/web/dist`) from an ephemeral localhost server
 * and points Chromium at `#/tool/<id>?…&format=<fmt>&export=1`. Needs a build:
 * `pnpm run build:web` (or set LOLLY_WEB_DIST / LOLLY_WEB_BASE). If absent, a clear
 * error explains the one build step; svg and data formats render without it.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve, extname, normalize } from 'node:path';
import { getBrowser, BrowserError } from './browsers.ts';
import {
  desktopInstalled, launchRenderServer, readRenderServer, renderThroughRungs,
  rendererPreference, renderViaRenderServer, type RendererDrivers,
} from './desktop-renderer.ts';
import { repoRoot } from './repo-root.ts';
import { catalogFile, readAssetIndex, toolFile } from './content-roots.ts';
import { waitForExport, type ExportWait } from './export-wait.ts';
import type { ConsoleMessage, Page } from 'playwright-core';
import { OpenSessionError, checksInOpenedPage, openRouteRefusal, openSessionInPage, packageDesignSession, sessionExportQuery, shortenUrls } from './open-session.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.zip': 'application/zip', '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
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

/**
 * A `/catalog/<rel>` or `/tools/<id>/<rel>` request answered from the ACTIVE content
 * profile, as the dev server answers it (the same resolver, and the same merged asset
 * index). The dist on disk holds whichever profile last ran `build:web`, so serving its
 * own catalog rendered every brand asset of another profile as missing: a SUSE deck
 * came back without its logos or icons, with no warning. null hands the request back
 * to the dist (the app bundle, and any file the profile does not have).
 */
export function activeContentResponse(urlPath: string): { file: string } | { json: string } | null {
  const segs = urlPath.split('/').filter((seg) => seg && seg !== '.');
  if (segs.some((seg) => seg === '..')) return null;
  const [head, ...rest] = segs;
  if (!rest.length) return null;
  try {
    if (head === 'catalog' && rest.join('/') === 'assets/index.json') return { json: JSON.stringify(readAssetIndex()) };
    const file = head === 'catalog' ? catalogFile(rest.join('/'))
      : head === 'tools' && rest.length > 1 ? toolFile(rest[0]!, rest.slice(1).join('/'))
        : null;
    return file && existsSync(file) ? { file } : null;
  } catch {
    return null;   // no such tool in this profile, or no profile at all
  }
}

/** Serve the built web dist over localhost, SPA-style (unknown paths → index.html). */
function serveDist(): Promise<Served> {
  const dist = process.env.LOLLY_WEB_DIST || join(repoRoot(), 'shells', 'web', 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    throw new BrowserError(
      `No built web shell at ${dist}. Run \`pnpm run build:web\` (or set LOLLY_WEB_DIST to a ` +
      `prebuilt shell / LOLLY_WEB_BASE to a running one). Raster/PDF/video export needs it; ` +
      `svg and data formats render without it.`,
    );
  }
  const root = resolve(dist);
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]!);
      const live = activeContentResponse(urlPath);
      if (live && 'json' in live) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(live.json);
        return;
      }
      let filePath = live ? live.file : resolve(root, '.' + normalize(urlPath));
      if (!live && !filePath.startsWith(root)) { res.writeHead(403).end(); return; }
      if (!live && (urlPath === '/' || !existsSync(filePath) || !(await stat(filePath)).isFile())) {
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
const EXPORT_URL_RESERVED = ['format', 'export', 'copy', 'width', 'w', 'height', 'h', 'unit', 'dpi', 'password', 'bleed', 'marks', 'imprint', 'durable', 'profile', 'c2pa', 'preview', 'options', 'fps', 'seconds', 'wait', 'codec', 'vq', 'hdr', 'depth', 'cuts', 'sampletimes', 'motionblur', 'seqrange'];

export function exportUrl(base: string, toolId: string, query: string, fmt: string, dims: RenderDims): string {
  const p = new URLSearchParams(query);
  if (dims.lang) p.set('lang', dims.lang);
  for (const k of EXPORT_URL_RESERVED) p.delete(k);
  p.set('format', fmt);
  if (dims.cuts != null && dims.cuts > 1) p.set('cuts', String(dims.cuts));
  serializeMotionParams(p, dims);
  if (dims.sampleTimes !== undefined) p.set('sampletimes', dims.sampleTimes.join(','));
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
  if (dims.depth && dims.depth !== 'auto') p.set('depth', String(dims.depth));
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
  // A failed navigation quotes its whole address, and a document carried in the address
  // made that megabytes of stderr. The head and the length say enough.
  if (err instanceof Error) err.message = shortenUrls(err.message);
  const log = debug.write(label, err instanceof Error ? err.message : String(err));
  if (log && err instanceof Error && !err.message.includes(log)) {
    err.message += ` Debug log: ${log}`;
  }
  return err;
}

/** The download-timeout sentence, with the debug log's evidence when it is on. */
function noFileError(toolId: string, format: string, debug: DebugRecorder, reason: unknown): BrowserError {
  const where = debug.where();
  const log = debug.write(`${toolId}.${format}`, `no "${format}" file (${where || 'download wait'})`);
  return new BrowserError(
    `The web shell produced no "${format}" file for "${toolId}". ${reason instanceof Error ? reason.message : String(reason)}` +
    (where ? ` Stopped in ${where}.` : '') +
    (log ? ` Debug log: ${log}` : tierBDebugOn() ? '' : ' Re-run with --tier-b-debug for the browser console and network log.'),
  );
}

export interface RenderDims extends ProductionBrowserOptions {
  cuts?: number;
  motionBlur?: import('../../../engine/src/motion-sampling.ts').MotionBlur;
  sequenceRange?: import('../../../engine/src/motion-sampling.ts').MotionRange;
  sampleTimes?: readonly number[];
  /** Effective UI/content language forwarded to the browser runtime. */
  lang?: string;
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
  depth?: 8 | 16 | 'float' | 'auto';
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
        `may predate this tool. Rebuild it with \`pnpm run build:web\`.`,
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
async function renderViaChromiumShell(
  toolId: string, query: string, format: string, dims: RenderDims = {},
): Promise<{ bytes: Uint8Array; mime: string }> {
  // The mark is the whole point of ?durable=1: fail loud up front when the dist cannot make the mark.
  assertDurableEncoder(dims, Boolean(process.env.LOLLY_WEB_BASE));
  const debug = startDebug();
  debug.step('serve the built web shell');
  const base = await webShellBase();
  const url = exportUrl(base, toolId, query, format, dims);
  debug.step('launch the browser');
  const browser = await getBrowser();
  const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
  let waiting: ExportWait | undefined;
  try {
    const page = await ctx.newPage();
    const observeInputs = await observeProductionInputs(page, toolId, dims.productionInputIds ?? []);
    debug.attach(page);
    waiting = await waitForExport(page, format);
    const downloadP = waiting.result;
    debug.step('open the tool page');
    await page.goto(url, { waitUntil: 'commit', timeout: 30_000 });
    debug.step(`wait for the ${format} download`);
    let download: Awaited<typeof downloadP>;
    try {
      download = await downloadP;
    } catch (error) {
      throw noFileError(toolId, format, debug, error);
    }
    debug.step('read the downloaded bytes');
    const path = await download.path();
    if (!path) throw new BrowserError(`Download for "${toolId}" yielded no file.`);
    const bytes = new Uint8Array(await readFile(path));
    await download.delete().catch(() => {});
    dims.onProductionInputs?.(observeInputs(bytes));
    return { bytes, mime: MIME[extname(download.suggestedFilename()).toLowerCase()] ?? MIME['.' + format.toLowerCase()] ?? 'application/octet-stream' };
  } catch (err) {
    throw withDebugLog(err, `${toolId}.${format}`, debug);
  } finally {
    waiting?.dispose();
    await ctx.close();
  }
}

/**
 * Render with the selected full-fidelity host: a running desktop app, an installed
 * one started for the job, or Chromium (plans/202 WP2.2).
 *
 * Both desktop rungs and the Chromium rung are handed the SAME export URL, built by
 * the same `exportUrl` above, so the URL contract decides what gets rendered exactly
 * once. That is also what keeps Content Credentials right: the `c2pa` param travels
 * on the URL, the web shell running inside whichever host stamps the file, and
 * `shells/cli/src/run.ts` skips its own post-stamp for every one of these rungs
 * (`usedBrowser`) unless a signing identity is configured, in which case the URL
 * already carries `c2pa=off` and this shell stamps once. Adding the desktop rung
 * changed no part of that decision.
 *
 * `auto` walks the rungs; an explicit `desktop` or `chromium` does not. A rung that
 * fails under `auto` says so on stderr before the next one is tried, so a silent
 * demotion cannot be mistaken for a first-choice render.
 */
export async function renderViaWebShell(
  toolId: string, query: string, format: string, dims: RenderDims = {},
): Promise<{ bytes: Uint8Array; mime: string }> {
  const preference = rendererPreference();
  // The URL is a transport envelope for the desktop rungs. The app extracts its tool
  // id and query, then loads its OWN embedded origin in the off-screen WebView, so
  // the host part is never fetched.
  const toolUrl = exportUrl('https://lolly.tools', toolId, query, format, dims);
  const { result } = await renderThroughRungs(preference, {
    runningServer: () => readRenderServer(),
    installed: () => desktopInstalled(),
    launchServer: () => launchRenderServer(),
    renderOnServer: (server) => renderViaRenderServer(server, { toolUrl, format }),
    renderOnChromium: () => renderViaChromiumShell(toolId, query, format, dims),
    onFallback: (rung, reason) => {
      process.stderr.write(`lolly: the ${rung} renderer could not do this job (${reason.message}) - trying the next one.\n`);
    },
  });
  return result;
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
  let waiting: ExportWait | undefined;
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
    waiting = await waitForExport(page, format);
    const downloadP = waiting.result;
    debug.step('open the tool page');
    await page.goto(url, { waitUntil: 'commit', timeout: 30_000 });
    debug.step(`wait for the ${format} download`);
    let download: Awaited<typeof downloadP>;
    try {
      download = await downloadP;
    } catch (error) {
      throw noFileError(toolId, format, debug, error);
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
    waiting?.dispose();
    await ctx.close();
  }
}

/** A portable tool is installed in an isolated reader, then rendered by the ordinary export path. */
export async function renderToolPackageViaWebShell(bytes: Uint8Array, toolId: string, query: string, format: string, production: ProductionBrowserOptions = {}): Promise<Uint8Array> {
  const base = await webShellBase();
  const browser = await getBrowser();
  const context = await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
  let waiting: ExportWait | undefined;
  try {
    const page = await context.newPage();
    const observeInputs = await observeProductionInputs(page, toolId, production.productionInputIds ?? []);
    await page.goto(base, {waitUntil:'load',timeout:30_000});
    await page.waitForLoadState('networkidle');
    await page.evaluate(data => {
      const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(data)], 'tool.lolly'));
      (document.querySelector('#view') || document.body).dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:transfer}));
    }, [...bytes]);
    await page.getByRole('button', {name:'Trust & install',exact:true}).click({timeout:10_000}).catch(async () => { throw new BrowserError(`The reader could not open this tool file: ${(await page.locator('body').innerText()).slice(-1500)}`); });
    await page.locator('.lolly-locked-design').waitFor({timeout:30_000});
    waiting = await waitForExport(page, format);
    const downloading = waiting.result;
    await page.goto(exportUrl(base,toolId,query,format,{}), {waitUntil:'commit'});
    const download = await downloading;
    const path = await download.path(); if (!path) throw new BrowserError('The tool produced no output file.');
    const rendered = new Uint8Array(await readFile(path));
    production.onProductionInputs?.(observeInputs(rendered));
    return rendered;
  } finally { waiting?.dispose(); await context.close(); }
}

/** What `designChecksViaWebShell` found on the page. */
export type DesignChecksPageAnswer =
  /** The page ran `window.lolly.document.check()` and returned this JSON. */
  | { kind: 'answered'; value: unknown }
  /** The shell answered but has no `check` verb: a build from before plan 291 W1. */
  | { kind: 'no-hook'; reason: string };

export interface DesignChecksViaWebShellOptions {
  /** Longest wait for the editor and the checks, in ms. Default 120 s. */
  timeoutMs?: number;
  viewport?: { width: number; height: number };
}

/**
 * Open a Design document in the web shell and run the checks that need a painted
 * canvas (plan 291 W1): `window.lolly.document.check()`, the same function the
 * app's "Before you export" card runs, evaluated in the page and returned as JSON.
 *
 * The document travels in the URL hash, as every browser-tier render does, so the
 * caller keeps the query inside the transport's size (plan 291 W9 moves it off the
 * URL). No `export=1`: this is the editor a person sees, not an export. A shell
 * without the verb (an older desktop app or dist) is reported as `no-hook`, never as
 * a failure, so the caller can say the render family is unavailable here.
 */
export async function designChecksViaWebShell(
  query: string, opts: DesignChecksViaWebShellOptions = {},
): Promise<DesignChecksPageAnswer> {
  const timeout = opts.timeoutMs ?? 120_000;
  const debug = startDebug();
  try {
    debug.step('serve the built web shell');
    const base = await webShellBase();
    const p = new URLSearchParams(query);
    for (const k of EXPORT_URL_RESERVED) p.delete(k);
    const q = p.toString();
    debug.step('launch the browser');
    const browser = await getBrowser();
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: opts.viewport ?? { width: 1440, height: 1000 } });
    try {
      const page = await ctx.newPage();
      debug.attach(page);
      debug.step('open the Design editor');
      await page.goto(`${base}/#/tool/design${q ? `?${q}` : ''}`, { waitUntil: 'load', timeout: Math.min(timeout, 60_000) });
      debug.step('wait for the document surface');
      await page.waitForFunction(
        () => !!(window as unknown as { lolly?: { document?: unknown } }).lolly?.document,
        undefined, { timeout },
      );
      const hasHook = await page.evaluate(
        () => typeof (window as unknown as { lolly?: { document?: { check?: unknown } } }).lolly?.document?.check === 'function',
      );
      if (!hasHook) {
        return { kind: 'no-hook', reason: 'This web shell build has no Design check hook; rebuild it (pnpm run build:web) or update the desktop app.' };
      }
      // The Loading card keeps the page inert until the mount finishes.
      debug.step('wait for the editor to finish loading');
      await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden', timeout }).catch(() => undefined);
      debug.step('run the Design checks');
      const value = await page.evaluate(
        () => (window as unknown as { lolly: { document: { check: () => Promise<unknown> } } }).lolly.document.check(),
      );
      return { kind: 'answered', value };
    } finally {
      await ctx.close();
    }
  } catch (err) {
    throw withDebugLog(err, 'design.check', debug);
  }
}

/** A `.lolly` opened in the web shell through the `#/open` route (plan 291 W8). */
export interface OpenedLollyPage {
  /** The saved session's slot in the page's store, as carried by the tool address. */
  slot: string;
  /** The tool the session opened in. */
  toolId: string;
  /** The origin of the web shell the page runs on. */
  base: string;
  /** The live page, left on the tool. */
  page: Page;
  /** Close the page and its browser context. */
  close(): Promise<void>;
}

export interface OpenLollyViaWebShellOptions {
  /** The file name the app shows while it opens the file. */
  name: string;
  /** A web shell origin to drive. Default: LOLLY_WEB_BASE, else the built dist served here. */
  base?: string;
  /** Longest wait for the session to open, in ms. Default 120 s. */
  timeoutMs?: number;
  /**
   * A DTCG token document the page renders in instead of its content profile's
   * (seedPageDesignSystem): the `--file` or terminal system the caller resolved.
   */
  designSystem?: unknown;
}

/**
 * The page global the web token bridge reads its automation design system from
 * (shells/web/src/bridge/tokens.ts, AUTOMATION_DESIGN_SYSTEM_GLOBAL).
 */
export const PAGE_DESIGN_SYSTEM_GLOBAL = '__lollyAutomationDesignSystem';

/**
 * Start every document of `page` with this design system (plan 291 M4): an init script
 * sets it before the app loads, and the web token bridge takes it at boot as the
 * document its renders resolve token links in. A `.lolly` never carries one (the `#/open`
 * route refuses a file with a design system), so the system a page renders in is the
 * driver's choice alone. Nothing is installed in the page's store. A missing or
 * non-object document leaves the page on its content profile's system.
 */
export async function seedPageDesignSystem(page: Page, doc: unknown): Promise<void> {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return;
  await page.addInitScript(({ key, value }: { key: string; value: unknown }) => {
    (globalThis as Record<string, unknown>)[key] = value;
  }, { key: PAGE_DESIGN_SYSTEM_GLOBAL, value: doc });
}

// The `#/open` helpers live in open-session.ts, which the MCP server also imports
// (it keeps its own browser, queue and egress policy and needs only the page steps).
export { openRouteFileName, openedToolSlot, openRouteRefusal, openSessionInPage, sessionExportQuery, OPEN_ROUTE_MAX_BYTES } from './open-session.ts';

/**
 * Open a `.lolly` in a real web shell with no drop event and no chooser click (plan 291
 * W8). The bytes are served to the page from a random same-origin path through
 * page.route, and the page is pointed at `#/open?lolly=<that path>`. The route skips
 * the chooser for a plain shared design only: a file that carries a tool, a design
 * system, templates, a renovation or a project is refused here, because it would wait
 * for a person's answer. Service workers are blocked, as on every browser-tier render.
 *
 * Resolves once the page is on the tool with the saved session's slot. The caller owns
 * the page and must call close().
 */
export async function openLollyViaWebShell(bytes: Uint8Array, opts: OpenLollyViaWebShellOptions): Promise<OpenedLollyPage> {
  const refusal = openRouteRefusal(bytes);
  if (refusal) throw new BrowserError(`${opts.name} ${refusal}. Open it in the app instead.`);
  const debug = startDebug();
  debug.step('serve the built web shell');
  const base = (opts.base ?? await webShellBase()).replace(/\/$/, '');
  debug.step('launch the browser');
  const browser = await getBrowser();
  const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 1600, height: 1000 } });
  const close = async (): Promise<void> => { await ctx.close().catch(() => {}); };
  try {
    const page = await ctx.newPage();
    debug.attach(page);
    await seedPageDesignSystem(page, opts.designSystem);
    const opened = await openSessionInPage(page, base, bytes, opts.name, {
      ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
      step: (name) => debug.step(name),
    }).catch((error: unknown) => { throw error instanceof OpenSessionError ? new BrowserError(error.message) : error; });
    return { ...opened, base, page, close };
  } catch (err) {
    await close();
    throw withDebugLog(err, `open ${opts.name}`, debug);
  }
}

/** The formats a saved Design session exports to through the web shell. `jpeg` is `jpg` on the URL. */
export type DesignSessionExportFormat = 'pptx' | 'pdf' | 'png' | 'svg' | 'jpeg' | 'jpg' | 'webp';

export interface ExportDesignSessionOptions {
  /** The file name the app shows while it opens the file. */
  name: string;
  format: DesignSessionExportFormat;
  /** One frame (slide) id; default every frame the format takes. Wins over `dims.slide`. */
  frame?: string;
  /** Content Credentials on or off; absent keeps the app's default. Wins over `dims.c2pa`. */
  c2pa?: boolean;
  /** The pixel Imprint on or off; absent keeps the app's default. Wins over `dims.imprint`. */
  imprint?: boolean;
  /** Every other export setting the URL-mode export reads (plan 291 W9): size, unit, print prep, video, HDR. */
  dims?: RenderDims;
  /**
   * The theme choice per token group (`_themes`), one export each. Absent, or one
   * `undefined`, exports in the theme the session was saved in.
   */
  tokenSelections?: ReadonlyArray<Record<string, string> | undefined>;
  /** A web shell origin to drive. Default: LOLLY_WEB_BASE, else the built dist served here. */
  base?: string;
  /** Longest wait for the session to open, in ms. Default 120 s. */
  timeoutMs?: number;
  /** A DTCG token document the page renders in (seedPageDesignSystem). Default: the page's content profile's. */
  designSystem?: unknown;
}

/**
 * Export the session open in `page` once, through the URL-mode export of its slot, and
 * return the download. The page stays open, so a caller can export it again in another
 * theme (a change of `_themes` in the address remounts the editor in that theme).
 */
async function exportOpenedSession(
  page: Page, base: string, query: string, format: string, dims: RenderDims, debug: DebugRecorder, label: string,
): Promise<{ bytes: Uint8Array; filename: string; notes?: string[] }> {
  const waiting = await waitForExport(page, format);
  // The exporter's own notes (what a PowerPoint export could not keep) are console
  // lines in the page; they are read back here so the caller prints them too.
  const notes: string[] = [];
  const onConsole = (message: ConsoleMessage): void => {
    const line = sessionExportNote(message.type(), message.text());
    if (line && !notes.includes(line)) notes.push(line);
  };
  page.on('console', onConsole);
  try {
    debug.step(`open the ${format} export`);
    await page.goto(exportUrl(base, 'design', query, format, dims), { waitUntil: 'commit', timeout: 30_000 });
    debug.step(`wait for the ${format} download`);
    let download: Awaited<typeof waiting.result>;
    try {
      download = await waiting.result;
    } catch (error) {
      throw noFileError('design', format, debug, error);
    }
    const path = await download.path();
    if (!path) throw new BrowserError(`The ${format} export of ${label} yielded no file.`);
    const out = new Uint8Array(await readFile(path));
    const filename = download.suggestedFilename();
    await download.delete().catch(() => {});
    return { bytes: out, filename, ...(notes.length ? { notes } : {}) };
  } finally {
    page.off('console', onConsole);
    waiting.dispose();
  }
}

/**
 * One export note from a console line of the web shell's exporter, or null. The shell's
 * `host.log('warn', 'pptx: …')` prints `[warn] pptx: …`; the note is the `pptx: …` part.
 */
export function sessionExportNote(type: string, text: string): string | null {
  if (type !== 'warning' || !text.startsWith('[warn] pptx: ')) return null;
  return text.slice('[warn] '.length, '[warn] '.length + 2000).trimEnd();
}

/** The RenderDims of a session export: the frame and provenance options laid over `dims`. */
function sessionDims(opts: ExportDesignSessionOptions): RenderDims {
  return {
    ...(opts.dims ?? {}),
    ...(opts.frame ? { slide: opts.frame } : {}),
    ...(opts.c2pa !== undefined ? { c2pa: opts.c2pa } : {}),
    ...(opts.imprint !== undefined ? { imprint: opts.imprint } : {}),
  };
}

/**
 * Export a saved Design session `.lolly` with the web shell's own exporter (plan 291 W8,
 * the transport W9 builds on). The file is opened through `#/open` (openLollyViaWebShell),
 * then the page goes to the URL-mode export of that slot, `#/tool/design?slot=…&format=…
 * &export=1`, and the download it produces is returned with the file name the app chose.
 * Only the first of `tokenSelections` is used; exportDesignSessionThemesViaWebShell
 * exports every one of them from one opened page.
 */
export async function exportDesignSessionViaWebShell(
  bytes: Uint8Array, opts: ExportDesignSessionOptions,
): Promise<{ bytes: Uint8Array; filename: string; notes?: string[] }> {
  const [first] = await exportDesignSessionThemesViaWebShell(bytes, { ...opts, tokenSelections: [opts.tokenSelections?.[0]] });
  return first!;
}

/** `exportDesignSessionViaWebShell` once per entry of `tokenSelections`, from one opened page. */
export async function exportDesignSessionThemesViaWebShell(
  bytes: Uint8Array, opts: ExportDesignSessionOptions,
): Promise<Array<{ bytes: Uint8Array; filename: string; notes?: string[] }>> {
  const format = opts.format === 'jpeg' ? 'jpg' : opts.format;
  const opened = await openLollyViaWebShell(bytes, { name: opts.name, base: opts.base, timeoutMs: opts.timeoutMs, designSystem: opts.designSystem });
  const debug = startDebug();
  try {
    if (opened.toolId !== 'design') throw new BrowserError(`${opts.name} is a ${opened.toolId} session; this export takes a Design session.`);
    debug.attach(opened.page);
    const out: Array<{ bytes: Uint8Array; filename: string; notes?: string[] }> = [];
    const selections = opts.tokenSelections?.length ? opts.tokenSelections : [undefined];
    for (const selection of selections) {
      out.push(await exportOpenedSession(opened.page, opened.base, sessionExportQuery(opened.slot, selection), format, sessionDims(opts), debug, opts.name));
    }
    return out;
  } catch (err) {
    throw withDebugLog(err, `design.${format}`, debug);
  } finally {
    await opened.close();
  }
}

export interface RenderDesignViaSessionOptions {
  /** The document's name, shown while it opens; default "Design". */
  label?: string;
  /** The theme choice per token group, sent as `_themes`. */
  tokenSelection?: Record<string, string>;
  /** The reserved emoji params (`emoji`, `emojifx`, `emojistyle`), as a share link carries them. */
  emoji?: Record<string, string>;
  /**
   * The values the caller gave, for the rows whose picture the host could not resolve
   * (an upload id): matched by position, so the session still points at the picture.
   */
  fill?: Record<string, unknown>;
  /** A web shell origin to drive. Default: LOLLY_WEB_BASE, else the built dist served here. */
  base?: string;
  /** Longest wait for the session to open, in ms. Default 120 s. */
  timeoutMs?: number;
  /**
   * The same document as a URL-mode query (serializeUrlState), for the desktop renderer.
   * The desktop app takes a document in an address (plan 291 E27), so with this given,
   * a desktop rung on this machine and an address that fits its request, the render walks
   * the rungs as every other tool does: the running app, the installed app, then Chromium
   * with the session. Without it, Chromium renders the session.
   */
  urlQuery?: string;
  /**
   * A DTCG token document the page renders in (seedPageDesignSystem): the `--file` or
   * terminal system the caller lowered against. The desktop app renders in its own
   * design system, so with one given Chromium renders first.
   */
  designSystem?: unknown;
}

/**
 * The most the desktop render endpoint reads in one request: 1 MiB
 * (shells/tauri-desktop/src-tauri/src/render_server.rs, MAX_REQUEST_BYTES).
 */
export const DESKTOP_REQUEST_MAX_BYTES = 1 << 20;

/** Room in a desktop request for the token, the op and the format beside the address. */
const DESKTOP_REQUEST_MARGIN = 4 * 1024;

/** Whether a desktop render request carrying this export address fits the endpoint's 1 MiB cap. */
export function fitsDesktopRequest(toolUrl: string): boolean {
  return Buffer.byteLength(toolUrl, 'utf8') + DESKTOP_REQUEST_MARGIN <= DESKTOP_REQUEST_MAX_BYTES;
}

/**
 * Refuse a durable render up front when the served dist has no TrustMark encoder. The
 * embed is best-effort inside the web shell (it never fails an export), so without
 * this check an unmarked file would be written while the caller believes it is
 * protected. Only checkable for a local dist: a remote web shell serves its own models.
 */
function assertDurableEncoder(dims: RenderDims, remote: boolean): void {
  if (!dims.durable || remote) return;
  const dist = process.env.LOLLY_WEB_DIST || join(repoRoot(), 'shells', 'web', 'dist');
  const model = join(dist, 'models', 'trustmark', 'encoder_Q.onnx');
  if (!existsSync(model)) {
    throw new BrowserError(
      `The durable credential needs the TrustMark encoder model, which isn't in the built ` +
      `web shell (${model}). Rebuild it with ` +
      `\`pnpm run build:web\` (the model ships in shells/web/public), or export without --durable.`,
    );
  }
}

/**
 * Render a Design document with the web shell's own exporter, carrying the document as
 * a session instead of in the address (plan 291 W9). The values are packaged as a
 * `.lolly` (`packageDesign`: every `data:` picture becomes an upload it carries), opened
 * through `#/open`, and exported through the URL-mode export of its slot with the full
 * RenderDims, so the address holds only the slot and the export settings however large
 * the pictures are.
 *
 * The desktop renderer keeps the address transport (E27): when `opts.urlQuery` is given
 * and LOLLY_RENDERER is not `chromium`, an address that fits the desktop request goes
 * through the rungs (`renderThroughRungs`), and only the Chromium rung takes the session.
 * An address over the 1 MiB cap goes to Chromium as a session, and a note says so when a
 * desktop app was there to take the job.
 */
export async function renderDesignViaSession(
  values: Record<string, unknown>, format: string, dims: RenderDims, opts: RenderDesignViaSessionOptions = {},
): Promise<{ bytes: Uint8Array; mime: string; notes?: string[] }> {
  const preference = rendererPreference();
  if (opts.urlQuery === undefined || preference === 'chromium' || opts.base !== undefined) {
    const notes = preference === 'desktop' && opts.urlQuery === undefined
      ? ['The desktop renderer takes the document in an address, and none was given; Chromium rendered the session.']
      : [];
    return renderDesignSessionInChromium(values, format, dims, opts, notes);
  }
  // The URL is a transport envelope for the desktop rungs, as in renderViaWebShell.
  const toolUrl = exportUrl('https://lolly.tools', 'design', opts.urlQuery, format, dims);
  if (!fitsDesktopRequest(toolUrl)) {
    const desktopHere = preference === 'desktop' || Boolean(readRenderServer()) || desktopInstalled();
    const notes = desktopHere
      ? [`The document's address is ${Buffer.byteLength(toolUrl, 'utf8').toLocaleString('en-US')} bytes, over the desktop renderer's 1 MiB request, so Chromium rendered it as a session.`]
      : [];
    return renderDesignSessionInChromium(values, format, dims, opts, notes);
  }
  let chromiumNotes: string[] | undefined;
  const drivers: RendererDrivers = {
    runningServer: () => readRenderServer(),
    installed: () => desktopInstalled(),
    launchServer: () => launchRenderServer(),
    renderOnServer: (server) => renderViaRenderServer(server, { toolUrl, format }),
    renderOnChromium: async () => {
      const out = await renderDesignSessionInChromium(values, format, dims, opts, []);
      chromiumNotes = out.notes;
      return out;
    },
    onFallback: (rung, reason) => {
      process.stderr.write(`lolly: the ${rung} renderer could not do this job (${reason.message}) - trying the next one.\n`);
    },
  };
  // The desktop app resolves token links in its own design system. A document lowered
  // against another one (`--file`, the terminal system) renders in Chromium first, where
  // the page is given that system; the app is the fallback, and a note says what it used.
  if (opts.designSystem !== undefined) {
    const appNote = "The desktop app rendered this document in the app's own design system, so its linked colours come from that system.";
    if (preference === 'desktop') {
      const { result } = await renderThroughRungs('desktop', drivers);
      return { bytes: result.bytes, mime: result.mime, notes: [appNote] };
    }
    try {
      return await renderDesignSessionInChromium(values, format, dims, opts, []);
    } catch (err) {
      if (!readRenderServer() && !desktopInstalled()) throw err;
      process.stderr.write(`lolly: the chromium renderer could not do this job (${err instanceof Error ? err.message : String(err)}) - trying the desktop app.\n`);
      const { result } = await renderThroughRungs('desktop', drivers);
      return { bytes: result.bytes, mime: result.mime, notes: [appNote] };
    }
  }
  const { result } = await renderThroughRungs(preference, drivers);
  return { bytes: result.bytes, mime: result.mime, ...(chromiumNotes?.length ? { notes: chromiumNotes } : {}) };
}

/** The Chromium half of renderDesignViaSession: package, open through `#/open`, export. */
async function renderDesignSessionInChromium(
  values: Record<string, unknown>, format: string, dims: RenderDims, opts: RenderDesignViaSessionOptions, notes: string[],
): Promise<{ bytes: Uint8Array; mime: string; notes?: string[] }> {
  const fmt = format.toLowerCase() === 'jpeg' ? 'jpg' : format.toLowerCase();
  const debug = startDebug();
  assertDurableEncoder(dims, opts.base !== undefined || Boolean(process.env.LOLLY_WEB_BASE));
  try {
    debug.step('package the document as a session');
    const label = opts.label?.trim() || 'Design';
    const packed = await packageDesignSession(values, { label, ...(opts.fill ? { fill: opts.fill } : {}) });
    notes.push(...packed.notes);
    debug.step('serve the built web shell');
    const base = (opts.base ?? await webShellBase()).replace(/\/$/, '');
    debug.step('launch the browser');
    const browser = await getBrowser();
    const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 1600, height: 1000 } });
    try {
      const page = await ctx.newPage();
      // Before the first navigation: the observer's init script runs on a new document only.
      const observeInputs = await observeProductionInputs(page, 'design', dims.productionInputIds ?? []);
      debug.attach(page);
      await seedPageDesignSystem(page, opts.designSystem);
      const opened = await openSessionInPage(page, base, packed.bytes, `${label}.lolly`, {
        ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
        step: (name) => debug.step(name),
      }).catch((error: unknown) => { throw error instanceof OpenSessionError ? new BrowserError(error.message) : error; });
      if (opened.toolId !== 'design') throw new BrowserError(`The packaged document opened in ${opened.toolId}, not Design.`);
      const extra = new URLSearchParams(opts.emoji ?? {}).toString();
      const result = await exportOpenedSession(page, base, sessionExportQuery(opened.slot, opts.tokenSelection, extra), fmt, dims, debug, label);
      dims.onProductionInputs?.(observeInputs(result.bytes));
      notes.push(...(result.notes ?? []));
      const mime = MIME[extname(result.filename).toLowerCase()] ?? MIME['.' + fmt] ?? 'application/octet-stream';
      return { bytes: result.bytes, mime, ...(notes.length ? { notes } : {}) };
    } finally {
      await ctx.close().catch(() => {});
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'DesignPackageError') {
      throw withDebugLog(new BrowserError(`The document could not be packaged for the web shell: ${err.message}`), `design.${fmt}`, debug);
    }
    throw withDebugLog(err, `design.${fmt}`, debug);
  }
}

export interface DesignChecksViaSessionOptions extends DesignChecksViaWebShellOptions {
  /** The file name the app shows while it opens the file. */
  name?: string;
  /** The theme choice per token group, sent as `_themes`. */
  tokenSelection?: Record<string, string>;
  /** A web shell origin to drive. Default: LOLLY_WEB_BASE, else the built dist served here. */
  base?: string;
  /** A DTCG token document the page checks in (seedPageDesignSystem). Default: the page's content profile's. */
  designSystem?: unknown;
}

/**
 * `designChecksViaWebShell` over a session instead of an address (plan 291 W9): the
 * `.lolly` is opened through `#/open`, so uploaded pictures are painted and the checks
 * see what an export would show, whatever the document's size. With a theme choice,
 * the editor is reopened on the slot in that theme before the checks run.
 */
export async function designChecksViaSession(
  bytes: Uint8Array, opts: DesignChecksViaSessionOptions = {},
): Promise<DesignChecksPageAnswer> {
  const timeout = opts.timeoutMs ?? 120_000;
  const name = opts.name ?? 'document.lolly';
  const debug = startDebug();
  try {
    debug.step('serve the built web shell');
    const base = (opts.base ?? await webShellBase()).replace(/\/$/, '');
    debug.step('launch the browser');
    const browser = await getBrowser();
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: opts.viewport ?? { width: 1440, height: 1000 } });
    try {
      const page = await ctx.newPage();
      debug.attach(page);
      await seedPageDesignSystem(page, opts.designSystem);
      return await checksInOpenedPage(page, base, bytes, name, opts.tokenSelection, timeout, (step) => debug.step(step));
    } finally {
      await ctx.close().catch(() => {});
    }
  } catch (err) {
    throw withDebugLog(err instanceof OpenSessionError ? new BrowserError(err.message) : err, 'design.check', debug);
  }
}
