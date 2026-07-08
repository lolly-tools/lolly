// SPDX-License-Identifier: MPL-2.0
/**
 * Characterization harness for shells/web/src/bridge/export.ts.
 *
 * export.ts is the ~7k-LOC web-shell export bridge with ZERO direct tests, and
 * its formats (raster/pdf/pptx/video/motion) render only in a real browser. This
 * harness is the regression net that makes its teardown into per-format modules
 * safe: capture a baseline, refactor, re-check, prove the bytes are unchanged.
 *
 * SAME-SESSION net, not a committed CI golden. Raster bytes depend on the local
 * Chromium build + OS font stack, so hashes are NOT stable across machines. The
 * workflow is deliberately local:
 *
 *   npm run build:web                                  # the harness needs shells/web/dist
 *   node scripts/characterize-export.ts --baseline     # BEFORE touching export.ts
 *   …refactor export.ts…
 *   node scripts/characterize-export.ts --check        # AFTER — exits 1 on any drift
 *
 * It drives the built web shell's real export path through the Tier-B reuse point
 * renderViaWebShell (shells/cli/src/webshell-render.ts) — the same Chromium path
 * the CLI and MCP server use — which returns the exact bytes export.ts wrote to
 * the download, with no node-side mutation.
 *
 * A rendering platform cares about the DRAWN result, so we compare what's drawn:
 *   1. c2pa=off is forced on every render (C2PA is default-on and injects a fresh
 *      keypair + signature + timestamp per run — un-hashable otherwise).
 *   2. Raster/vector formats hash their bytes directly. PDFs are byte-nondeterministic
 *      (pdf-lib object/font-subset ordering) but pixel-identical, so they are
 *      RASTERISED (macOS PDFKit) and the PNG pixels are hashed — render-faithful and
 *      deterministic. Container/encoder formats (pptx/zip/motion), whose bytes also
 *      wobble harmlessly, are size-banded `smoke`.
 *   3. Every (tool,format) is rendered TWICE and auto-classified: identical →
 *      `stable` (hash); differing / container → `smoke` (size band). Nothing is
 *      assumed stable; nondeterminism is discovered, not guessed.
 *
 * Flags: --baseline | --check ; --out/--in <file> (default scratch path) ;
 *        --only <id,id> to restrict tools ; --formats <f,f> to restrict formats.
 */
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SNAPSHOT = path.join(ROOT, 'scratch', 'export-characterization.json');

// Matrix: tools chosen so every export.ts dispatch branch is exercised, with
// tools whose DEFAULT render is rich enough to walk gradients/borders/clips/text
// (no example-seeding needed — the branch is selected by FORMAT, not by inputs).
const MATRIX: { id: string; formats: string[] }[] = [
  // Solid vector + raster + physical/CMYK — fully deterministic core.
  { id: 'qr-code',        formats: ['png', 'jpg', 'webp', 'avif', 'pdf', 'pdf-cmyk', 'tiff', 'cmyk-tiff', 'svg', 'eps', 'dxf'] },
  { id: 'tool-logo',      formats: ['png', 'jpg', 'pdf', 'ico', 'zip', 'svg'] },
  { id: 'quotes',         formats: ['png', 'pdf', 'pptx'] },
  { id: 'chart-creator',  formats: ['png', 'pdf', 'pptx', 'tiff', 'svg'] },   // fills + shapes
  { id: 'code-canvas',    formats: ['png', 'svg', 'pdf'] },                    // text-as-paths heavy (pdf pixel-hashed: its byte-level nondeterminism is invisible in the render)
  { id: 'multi-page-pdf', formats: ['pdf', 'pptx'] },                          // multipage geometry
  // (daily-card intentionally excluded — its weather/date/map content is live-varying,
  //  so it's noise for a regression net; png/pdf coverage comes from the tools above.)
  { id: 'web-icon',       formats: ['ico', 'png'] },
  { id: 'filter-halftone',formats: ['png', 'avif'] },                          // photo → raster (gif dropped: slow, motion covered by digi-ad)
  // Animation encoders (expect smoke). webm/mp4 are omitted by default — each has
  // a 180s render budget; add them when touching the video cluster with:
  //   node scripts/characterize-export.ts --baseline --only digi-ad --formats webm,mp4
  { id: 'digi-ad',        formats: ['gif', 'apng', 'webp-anim'] },
];

interface Entry {
  tool: string;
  format: string;
  status: 'stable' | 'smoke' | 'error';
  hash?: string;              // stable: sha256 of normalized bytes
  sizeMin?: number;           // smoke: observed byte-length band across the two runs
  sizeMax?: number;
  bytes?: number;             // stable: exact normalized byte length (informational)
  mime?: string;
  error?: string;
}

// --- CLI args -------------------------------------------------------------
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string): string | undefined => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const MODE: 'baseline' | 'check' = has('--check') ? 'check' : 'baseline';
const SNAP = val(MODE === 'check' ? '--in' : '--out') ?? val('--out') ?? val('--in') ?? DEFAULT_SNAPSHOT;
const onlyTools = val('--only')?.split(',').map(s => s.trim());
const onlyFormats = val('--formats')?.split(',').map(s => s.trim());

// --- normalization: strip the known nondeterministic fields ---------------
// Only PDFs carry run-to-run noise (dates + random doc/instance UUIDs). Those
// fields live BOTH in the plaintext XMP packet AND inside Flate-compressed
// object streams (/ObjStm, the Info dict), so a raw latin1 regex can't reach the
// compressed copies. We therefore INFLATE every FlateDecode stream first (so all
// the noise becomes reachable plaintext), then apply the field regexes. The
// result is not a valid PDF — it is a canonical, comparable byte sequence for
// hashing only. Identity for every non-PDF format.
const ZERO_FIELDS = (s: string): string => s
  .replace(/(\/(?:CreationDate|ModDate))\s*\(D:[^)]*\)/g, '$1 (D:00000000000000Z)')
  .replace(/\/ID\s*\[\s*<[0-9a-fA-F]*>\s*<[0-9a-fA-F]*>\s*\]/g, '/ID [<0><0>]')
  .replace(/(xmp:CreateDate|xmp:ModifyDate|xmp:MetadataDate)>[^<]*/g, '$1>ZEROED')
  .replace(/(DocumentID|InstanceID)>[^<]*/g, '$1>ZEROED')
  .replace(/uuid:[0-9a-fA-F-]{36}/g, 'uuid:00000000-0000-0000-0000-000000000000');

function normalize(bytes: Uint8Array, format: string): Uint8Array {
  if (format !== 'pdf' && format !== 'pdf-cmyk') return bytes;
  const raw = Buffer.from(bytes);
  // Expand each `stream…endstream` payload in place: if it inflates, substitute
  // the inflated (then field-zeroed) text; otherwise (DCTDecode images, etc.)
  // keep it raw. Then zero the plaintext fields across the whole result.
  const out: Buffer[] = [];
  const streamKw = Buffer.from('stream'), endKw = Buffer.from('endstream');
  let pos = 0;
  for (;;) {
    const sIdx = raw.indexOf(streamKw, pos);
    if (sIdx < 0) { out.push(raw.subarray(pos)); break; }
    // payload starts after `stream` + its EOL (\r\n or \n).
    let dataStart = sIdx + streamKw.length;
    if (raw[dataStart] === 0x0d) dataStart++;
    if (raw[dataStart] === 0x0a) dataStart++;
    const eIdx = raw.indexOf(endKw, dataStart);
    if (eIdx < 0) { out.push(raw.subarray(pos)); break; }
    // trailing EOL before `endstream` is not part of the payload.
    let dataEnd = eIdx;
    if (raw[dataEnd - 1] === 0x0a) dataEnd--;
    if (raw[dataEnd - 1] === 0x0d) dataEnd--;
    out.push(raw.subarray(pos, dataStart));           // dict + `stream\n`
    const payload = raw.subarray(dataStart, dataEnd);
    let replaced: Buffer;
    try { replaced = Buffer.from(ZERO_FIELDS(inflateSync(payload).toString('latin1')), 'latin1'); }
    catch { replaced = payload; }                     // not Flate (image/raw) → keep
    out.push(replaced);
    out.push(raw.subarray(dataEnd, eIdx + endKw.length)); // EOL + `endstream`
    pos = eIdx + endKw.length;
  }
  return Buffer.from(ZERO_FIELDS(Buffer.concat(out).toString('latin1')), 'latin1');
}

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

// --- render-faithful fingerprint ------------------------------------------
// A rendering platform cares about the DRAWN result, not the container bytes.
// PDFs are byte-nondeterministic (pdf-lib object/font-subset ordering) but pixel-
// identical across renders (verified: 0-pixel diff). Byte-hashing them cries false
// "drift". So we rasterise PDFs to pixels and hash THOSE — the thing we care about,
// and deterministic. Container/encoder formats (pptx/zip/motion) whose bytes also
// wobble harmlessly are classified `smoke` (size-band) rather than byte-hashed.
const PDF_FORMATS = new Set(['pdf', 'pdf-cmyk']);
const ALWAYS_SMOKE = new Set(['pptx', 'zip', 'webm', 'mp4', 'gif', 'apng', 'webp-anim']);

// macOS PDFKit rasteriser (no Ghostscript needed). Detected once.
let _rasterOk: boolean | undefined;
function rasterizerAvailable(): boolean {
  if (_rasterOk === undefined) {
    try { execFileSync('qlmanage', ['-h'], { stdio: 'ignore' }); _rasterOk = true; }
    catch { _rasterOk = false; }
  }
  return _rasterOk;
}
function rasterizePdf(bytes: Uint8Array): Uint8Array | null {
  if (!rasterizerAvailable()) return null;
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lolly-pdfrast-'));
  try {
    const pdf = path.join(dir, 'a.pdf');
    writeFileSync(pdf, bytes);
    execFileSync('qlmanage', ['-t', '-s', '1200', '-o', dir, pdf], { stdio: 'ignore' });
    const png = path.join(dir, 'a.pdf.png');   // qlmanage names it "<file>.png"
    return existsSync(png) ? readFileSync(png) : null;
  } catch { return null; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

// The bytes to hash + whether that hash is a trustworthy stable identity.
// faithful=false forces `smoke` (a PDF we couldn't rasterise on this platform).
function fingerprint(bytes: Uint8Array, format: string): { buf: Uint8Array; faithful: boolean } {
  if (PDF_FORMATS.has(format)) {
    const png = rasterizePdf(bytes);
    if (png) return { buf: png, faithful: true };      // pixel hash — render-faithful
    return { buf: normalize(bytes, format), faithful: false };  // no rasteriser → smoke
  }
  return { buf: normalize(bytes, format), faithful: true };
}
const forceSmoke = (format: string, faithful: boolean): boolean => ALWAYS_SMOKE.has(format) || !faithful;

// --- one render via the shell's real export path --------------------------
type RenderFn = (toolId: string, query: string, format: string, dims?: unknown) => Promise<{ bytes: Uint8Array; mime: string }>;

async function main(): Promise<void> {
  // Dynamic import keeps this script's own tsconfig project from having to resolve
  // shells/cli's graph at typecheck time; the modules are plain .ts run by node.
  const { renderViaWebShell, closeWebShell } = await import('../shells/cli/src/webshell-render.ts') as { renderViaWebShell: RenderFn; closeWebShell: () => Promise<void> };
  const { closeBrowser, browserInstalled } = await import('../shells/cli/src/browser.ts') as { closeBrowser: () => Promise<void>; browserInstalled: () => boolean };

  if (!browserInstalled()) {
    console.error('✗ no Chromium for playwright-core. Set LOLLY_BROWSER_CHANNEL=chrome, or run `npm run cli -- install-browser`.');
    process.exit(2);
  }

  const jobs = MATRIX
    .filter(m => !onlyTools || onlyTools.includes(m.id))
    .flatMap(m => m.formats.filter(f => !onlyFormats || onlyFormats.includes(f)).map(f => ({ tool: m.id, format: f })));

  const baseline: Record<string, Entry> = MODE === 'check' ? loadSnapshot(SNAP) : {};
  const results: Record<string, Entry> = {};
  let drift = 0, ok = 0, errors = 0;

  try {
    for (const { tool, format } of jobs) {
      const key = `${tool}:${format}`;
      const query = 'c2pa=off';
      try {
        if (MODE === 'baseline') {
          // Two runs → classify. Raster/vector + rasterised-PDF hash to a stable
          // identity; container/encoder formats (and un-rasterisable PDFs) are
          // size-banded `smoke` so a lucky byte collision can't mint a false stable.
          const r1 = await renderViaWebShell(tool, query, format);
          const fpA = fingerprint(r1.bytes, format);
          const r2 = await renderViaWebShell(tool, query, format);
          const fpB = fingerprint(r2.bytes, format);
          const smoke = forceSmoke(format, fpA.faithful && fpB.faithful);
          const ha = sha256(fpA.buf), hb = sha256(fpB.buf);
          if (!smoke && ha === hb) {
            results[key] = { tool, format, status: 'stable', hash: ha, bytes: fpA.buf.length, mime: r2.mime };
            console.log(`  stable  ${key.padEnd(26)} ${fpA.buf.length} B  ${ha.slice(0, 12)}${PDF_FORMATS.has(format) ? ' (pixels)' : ''}`);
          } else {
            const lo = Math.min(r1.bytes.length, r2.bytes.length), hi = Math.max(r1.bytes.length, r2.bytes.length);
            results[key] = { tool, format, status: 'smoke', sizeMin: lo, sizeMax: hi, mime: r2.mime };
            console.log(`  smoke   ${key.padEnd(26)} ${lo}–${hi} B (${smoke ? 'byte-nondeterministic container' : 'nondeterministic'})`);
          }
          ok++;
        } else {
          // check: render once, compare to baseline.
          const base = baseline[key];
          const r = await renderViaWebShell(tool, query, format);
          if (!base) { console.log(`  ??      ${key.padEnd(26)} not in baseline — skipped`); continue; }
          if (base.status === 'stable') {
            const h = sha256(fingerprint(r.bytes, format).buf);   // pixel hash for PDF
            if (h === base.hash) { console.log(`  ✓ match ${key.padEnd(26)} ${h.slice(0, 12)}${PDF_FORMATS.has(format) ? ' (pixels)' : ''}`); ok++; }
            else { console.log(`  ✗ DRIFT ${key.padEnd(26)} ${base.hash?.slice(0, 12)} → ${h.slice(0, 12)}${PDF_FORMATS.has(format) ? ' (rendered pixels differ)' : ` (${base.bytes}→${r.bytes.length} B)`}`); drift++; }
          } else if (base.status === 'smoke') {
            const lo = (base.sizeMin ?? 0) * 0.9, hi = (base.sizeMax ?? 0) * 1.1;
            if (r.bytes.length >= lo && r.bytes.length <= hi) { console.log(`  ✓ band  ${key.padEnd(26)} ${r.bytes.length} B ∈ [${base.sizeMin}–${base.sizeMax}]`); ok++; }
            else { console.log(`  ✗ DRIFT ${key.padEnd(26)} ${r.bytes.length} B outside [${base.sizeMin}–${base.sizeMax}]`); drift++; }
          }
        }
      } catch (e) {
        errors++;
        const msg = e instanceof Error ? e.message : String(e);
        results[key] = { tool, format, status: 'error', error: msg };
        console.log(`  ! ERROR ${key.padEnd(26)} ${msg.slice(0, 80)}`);
      }
    }
  } finally {
    await closeBrowser().catch(() => {});
    await closeWebShell().catch(() => {});
  }

  if (MODE === 'baseline') {
    mkdirSync(path.dirname(SNAP), { recursive: true });
    writeFileSync(SNAP, JSON.stringify(results, null, 2));
    const stable = Object.values(results).filter(r => r.status === 'stable').length;
    const smoke = Object.values(results).filter(r => r.status === 'smoke').length;
    console.log(`\nBASELINE written → ${path.relative(ROOT, SNAP)}\n  ${stable} stable, ${smoke} smoke, ${errors} error, ${jobs.length} total`);
    if (errors) process.exit(1);
  } else {
    console.log(`\nCHECK: ${ok} ok, ${drift} drift, ${errors} error`);
    if (drift || errors) process.exit(1);
  }
}

function loadSnapshot(file: string): Record<string, Entry> {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { console.error(`✗ cannot read baseline ${file} — run --baseline first`); process.exit(2); }
}

main().catch(e => { console.error(e); process.exit(1); });
