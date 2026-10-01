// SPDX-License-Identifier: MPL-2.0
/**
 * resvg in a child process, for SVGs this server did not write.
 *
 * resvg can panic on some documents, and a panic inside it aborts the whole
 * Node process ("fatal runtime error: failed to initiate panic"): no exception
 * reaches JavaScript, so try/catch cannot help, and a worker thread dies with
 * the process. One such document is a Design render framed to a region that
 * leaves a clipped text group outside the view (plans/289, found while building
 * lolly_look); the emoji packs already withhold glyphs for the same reason
 * (engine/emoji.md). lolly_look and its siblings rasterise SVGs that callers
 * supply, so in-process that would let one file take the server down.
 *
 * Each job therefore runs `node -e` with the job on stdin and the picture on
 * stdout (an 8-byte width and height header, then PNG or raw RGBA). A crash
 * fails that one job with a `RasterCrash`, which the caller can answer or work
 * around. The cost is a process start, about 100 ms, which looking can afford.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

/** The child: read one job, rasterise, write header + bytes, exit. CommonJS so
 *  it can `require` the native package by its resolved path. */
const CHILD = `
const { Resvg } = require(process.argv[1]);
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const job = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const opts = { font: { fontDirs: job.fontDirs, loadSystemFonts: true } };
  if (job.fitTo) opts.fitTo = job.fitTo;
  if (job.crop) opts.crop = job.crop;
  const img = new Resvg(job.svg, opts).render();
  const body = job.want === 'png' ? img.asPng() : img.pixels;
  const head = Buffer.alloc(8);
  head.writeUInt32BE(img.width, 0);
  head.writeUInt32BE(img.height, 4);
  process.stdout.write(Buffer.concat([head, body]), () => process.exit(0));
});
`;

export interface RasterJob {
  svg: string;
  want: 'png' | 'rgba';
  fontDirs: string[];
  fitTo?: { mode: 'zoom'; value: number };
  crop?: { left: number; top: number; right: number; bottom: number };
}

export interface RasterOut { width: number; height: number; bytes: Uint8Array }

/** The rasteriser stopped on this document (a crash, not a bad request). */
export class RasterCrash extends Error {}

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;

let resvgPath: string | null = null;
function resolveResvg(): string {
  resvgPath ??= createRequire(import.meta.url).resolve('@resvg/resvg-js');
  return resvgPath;
}

export function rasterInChild(job: RasterJob): Promise<RasterOut> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', CHILD, resolveResvg()], { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let size = 0, err = '';
    let settled = false;
    const finish = (fn: () => void) => { if (!settled) { settled = true; clearTimeout(timer); fn(); } };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(() => reject(new RasterCrash('The picture took too long to draw.')));
    }, TIMEOUT_MS);
    child.stdout.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_OUTPUT_BYTES) { child.kill('SIGKILL'); finish(() => reject(new RasterCrash('The picture is too large to return.'))); return; }
      out.push(c);
    });
    child.stderr.on('data', (c: Buffer) => { if (err.length < 4000) err += c.toString('utf8'); });
    child.on('error', (e) => finish(() => reject(e)));
    child.on('close', (code, signal) => finish(() => {
      const buf = Buffer.concat(out);
      if (code !== 0 || buf.length < 8) {
        const why = /panicked at/.test(err) ? 'the rasteriser stopped on this SVG' : signal ? `stopped by ${signal}` : `exit ${code}`;
        reject(new RasterCrash(`The picture could not be drawn (${why}).`));
        return;
      }
      resolve({ width: buf.readUInt32BE(0), height: buf.readUInt32BE(4), bytes: new Uint8Array(buf.buffer, buf.byteOffset + 8, buf.length - 8) });
    }));
    child.stdin.on('error', () => { /* the child may exit before reading everything */ });
    child.stdin.end(JSON.stringify(job));
  });
}
