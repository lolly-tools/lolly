// SPDX-License-Identifier: MPL-2.0
/**
 * Piping pictures into a sponsor wall from the terminal (plan 334, decision 4).
 *
 * A blocks input that declares `dropToAdd` takes local files on the CLI, one row per
 * file, the way a drop does in the web shell. Logo Wall's `logos` is the reference.
 * These run the real entry point with no built web shell, so every render here is
 * browser-free: the wall's template root is an <svg>, the CLI writes that SVG and
 * resvg draws PNG from that SVG.
 *
 *  - files as arguments (a shell glob), `--logos-file` repeated, and a path list in a
 *    file or on stdin (`--logos-files=-`) each add one row per picture;
 *  - `--logos-file=-` reads one picture's bytes from stdin;
 *  - a CSV's `logo` column may name pictures beside the CSV, and its `tier` column
 *    groups the wall under headings;
 *  - `--width`/`--height` at another shape (an A4 page, 1080 x 1920) lay the wall
 *    out for that shape, in the SVG and in the PNG resvg draws from it;
 *  - files given to a tool with no such input, a file that is not a picture and a
 *    missing file are refused with exit 2 before anything is rendered;
 *  - a path written into a row (a CSV column, `--logos=` JSON) is read only when the
 *    file's bytes are a picture, whatever it is called, so a CSV someone sent cannot
 *    copy a credentials file into the exported SVG (exit 2, nothing written);
 *  - a local path inside a link (a pasted lolly.tools URL or a `z=` state), and a
 *    link that sets a flag pointing at a file, are refused with exit 4: the link's
 *    author does not choose files on the computer that runs the command.
 *
 * Run with: node --test tests/cli-logo-wall.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptsMime, imageMime, parsePathList } from '../shells/cli/src/block-files.ts';
import { isLocalPathFlag, linkBorneKeys, unknownFlags } from '../shells/cli/src/run.ts';
import { packQuery } from '../engine/src/url-pack.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'shells', 'cli', 'bin', 'lolly.ts');
const SKIP = !existsSync(join(ROOT, 'community', 'logo-wall', 'tool.json')) && 'community pack not mounted';
const root = await mkdtemp(join(tmpdir(), 'lolly-logo-wall-'));
after(() => rm(root, { recursive: true, force: true }));

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAMCAYAAAB4MH11AAAABHNCSVQICAgIfAhkiAAAAAFzUkdCAK7OHOkAAAAxSURBVDiNY/z///9/BhoCJloaThcLWNAFhE3DKTLw7emVKPyhH0SjFhAEjKMZjRAAAEDDCxGeaqqpAAAAAElFTkSuQmCC', 'base64');
const svg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect x="10" y="10" width="100" height="20" fill="${fill}"/></svg>`;
await mkdir(join(root, 'logos'));
await writeFile(join(root, 'logos', 'a.svg'), svg('#e2231a'));
await writeFile(join(root, 'logos', 'b.svg'), svg('#0b6bcb'));
await writeFile(join(root, 'logos', 'c.svg'), svg('#2e7d32'));
await writeFile(join(root, 'logos', 'd.png'), PNG);
await writeFile(join(root, 'logos', 'e.png'), PNG);
await writeFile(join(root, 'logos', 'notes.txt'), 'not a picture');
// A secret that must never reach an exported file, under a picture's name too.
const CANARY = 'SECRET-CANARY-1234567890';
await writeFile(join(root, 'credentials'), `[default]\naws_secret_access_key = ${CANARY}\n`);
await writeFile(join(root, 'logos', 'disguised.png'), CANARY);
await writeFile(join(root, 'logos', 'sponsors.csv'), 'logo,tier\na.svg,Gold partners\nd.png,Gold partners\nb.svg,Silver partners\nc.svg,Silver partners\ne.png,Silver partners\n');

function cli(args: string[], stdin?: Buffer | string): Promise<{ stdout: Buffer; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: join(root, 'logos'),
      env: { ...process.env, NO_COLOR: '1', LOLLY_WEB_DIST: join(root, 'no-web-shell') },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => { out.push(c); });
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    child.on('close', (code) => resolve({ stdout: Buffer.concat(out), stderr, code: code ?? -1 }));
    child.stdin.end(stdin ?? '');
  });
}

const images = (text: string) => [...text.matchAll(/<image\b[^>]*href="data:image\/(svg\+xml|png);base64,/g)].map((m) => m[1]);
const ok = (r: { code: number; stderr: string }) => {
  assert.equal(r.code, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /browser render tier/i, 'rendered with no browser');
};

test('files as arguments become one row each', { skip: SKIP }, async () => {
  const r = await cli(['run', 'logo-wall', 'a.svg', 'b.svg', 'c.svg', 'd.png', 'e.png', '--output=glob.svg', '--no-provenance']);
  ok(r);
  assert.match(r.stderr, /Added 5 pictures to --logos/);
  const text = await readFile(join(root, 'logos', 'glob.svg'), 'utf8');
  assert.match(text, /^<\?xml[^>]*>\s*<svg class="lw-svg"/);
  assert.deepEqual(images(text), ['svg+xml', 'svg+xml', 'svg+xml', 'png', 'png']);
});

test('--logos-file repeats, and --logos-files reads a list from a file or stdin', { skip: SKIP }, async () => {
  const flags = await cli(['logo-wall', '--logos-file=a.svg', '--logos-file=d.png', '--output=flags.svg', '--no-provenance']);
  ok(flags);
  assert.equal(images(await readFile(join(root, 'logos', 'flags.svg'), 'utf8')).length, 2);

  await writeFile(join(root, 'logos', 'list.txt'), '# sponsors\na.svg\n\nb.svg\nd.png\n');
  const list = await cli(['run', 'logo-wall', '--logos-files=list.txt', '--output=list.svg', '--no-provenance']);
  ok(list);
  assert.equal(images(await readFile(join(root, 'logos', 'list.svg'), 'utf8')).length, 3);

  const piped = await cli(['run', 'logo-wall', '--logos-files=-', '--output=piped.png', '--no-provenance'], 'a.svg\nb.svg\nc.svg\nd.png\ne.png\n');
  ok(piped);
  assert.match(piped.stderr, /Added 5 pictures/);
  const png = await readFile(join(root, 'logos', 'piped.png'));
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'resvg drew a PNG');
});

test('--logos-file=- reads one picture from stdin', { skip: SKIP }, async () => {
  const r = await cli(['run', 'logo-wall', '--logos-file=-', '--logos-file=a.svg', '--output=bytes.svg', '--no-provenance'], PNG);
  ok(r);
  assert.deepEqual(images(await readFile(join(root, 'logos', 'bytes.svg'), 'utf8')), ['png', 'svg+xml']);
});

test('a CSV names pictures beside it, and its tier column groups the wall', { skip: SKIP }, async () => {
  // Run from the parent folder: the CSV's relative paths still find the pictures.
  const r = await new Promise<{ code: number; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [BIN, 'run', 'logo-wall', '--logos-data=logos/sponsors.csv', '--transparentBg=0', '--text=live', '--output=tiers.svg', '--no-provenance'],
      { cwd: root, env: { ...process.env, NO_COLOR: '1', LOLLY_WEB_DIST: join(root, 'no-web-shell') }, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    child.on('close', (code) => resolve({ code: code ?? -1, stderr }));
  });
  ok(r);
  const text = await readFile(join(root, 'tiers.svg'), 'utf8');
  assert.equal(images(text).length, 5);
  const heads = [...text.matchAll(/<text class="lw-heading"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(heads, ['Gold partners', 'Silver partners']);
  assert.match(text, /<rect x="0" y="0" width="1280" height="720" fill="#/, '--transparentBg=0 paints the background');
});

test('an export at another shape fills it, in the SVG and in the PNG drawn from it', { skip: SKIP }, async (t) => {
  // An A4 page as SVG: the page's own size, and a wall laid out for its shape.
  const page = await cli(['run', 'logo-wall', 'a.svg', 'b.svg', 'c.svg', 'd.png', 'e.png', '--width=210', '--height=297', '--unit=mm', '--output=a4.svg', '--no-provenance']);
  ok(page);
  const svg = await readFile(join(root, 'logos', 'a4.svg'), 'utf8');
  assert.match(svg, /<svg class="lw-svg"[^>]*width="210mm" height="297mm"/);
  const [, , w, h] = /viewBox="([^"]+)"/.exec(svg)![1]!.split(' ').map(Number);
  assert.ok(Math.abs(w! / h! - 210 / 297) < 1e-3, `viewBox ${w} x ${h} has the page's shape`);

  // 1080 x 1920 as PNG: the logos reach the lower part of the picture, where a
  // letterboxed 16:9 wall would leave it empty.
  const tall = await cli(['run', 'logo-wall', 'a.svg', 'b.svg', 'c.svg', 'd.png', 'e.png', '--width=1080', '--height=1920', '--output=tall.png', '--no-provenance']);
  ok(tall);
  let sharp: typeof import('sharp')['default'];
  try { sharp = (await import('sharp')).default; } catch { t.skip('sharp unavailable on this platform'); return; }
  const { data, info } = await sharp(join(root, 'logos', 'tall.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [1080, 1920]);
  let lower = 0;
  for (let y = Math.round(info.height * 0.75); y < info.height; y++) {
    for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3]! > 0) lower++;
  }
  assert.ok(lower > 1000, `logos drawn in the lowest quarter (${lower} px)`);
});

test('a row can name a placeholder logo the tool ships, as the example look does', { skip: SKIP }, async () => {
  const r = await cli(['run', 'logo-wall', '--logos=[{"logo":"/tools/logo-wall/assets/your-logo.svg","tier":"Gold partners"}]', '--output=shipped.svg', '--no-provenance']);
  ok(r);
  const text = await readFile(join(root, 'logos', 'shipped.svg'), 'utf8');
  assert.deepEqual(images(text), ['svg+xml'], 'the shipped file is drawn, carried as its own bytes');
  assert.doesNotMatch(r.stderr, /Failed to resolve|Tool asset not found/);
});

test('files the wall cannot take are refused before anything renders', { skip: SKIP }, async () => {
  const qr = await cli(['run', 'qr-code', 'a.svg', '--output=qr.svg']);
  assert.equal(qr.code, 2);
  assert.match(qr.stderr, /"qr-code" has no input that takes files as arguments/);
  const txt = await cli(['run', 'logo-wall', 'notes.txt', '--output=x.svg']);
  assert.equal(txt.code, 2);
  assert.match(txt.stderr, /"notes.txt" is not a picture this shell recognises, and logos takes image\/\*/);
  const missing = await cli(['run', 'logo-wall', 'gone.png', '--output=x.svg']);
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /logos: cannot read "gone.png"/);
  const empty = await cli(['run', 'logo-wall', '--logos-files=-', '--output=x.svg']);
  assert.equal(empty.code, 2);
  assert.match(empty.stderr, /--logos-files=- reads one path per line from stdin, but stdin was empty/);
  assert.equal(existsSync(join(root, 'logos', 'x.svg')), false);
});

const canaryIn = (bytes: Buffer): boolean =>
  bytes.includes(CANARY) || bytes.includes(Buffer.from(CANARY).toString('base64').slice(0, 20));

test('a CSV or a --logos path that is not a picture is refused, and nothing is written', { skip: SKIP }, async () => {
  await writeFile(join(root, 'logos', 'leak.csv'), `logo,tier\na.svg,Gold\n${join(root, 'credentials')},Gold\n`);
  const csv = await cli(['run', 'logo-wall', '--logos-data=leak.csv', '--output=leak.svg', '--no-provenance']);
  assert.equal(csv.code, 2, csv.stderr);
  assert.match(csv.stderr, /is a file on this computer but not a picture this shell recognises, so it was not read/);
  assert.equal(existsSync(join(root, 'logos', 'leak.svg')), false, 'no file was written');

  // A picture's name is not a picture: the bytes decide.
  const named = await cli(['run', 'logo-wall', '--logos=[{"logo":"disguised.png"}]', '--output=named.svg', '--no-provenance']);
  assert.equal(named.code, 2, named.stderr);
  assert.equal(existsSync(join(root, 'logos', 'named.svg')), false);
  const dropped = await cli(['run', 'logo-wall', 'disguised.png', '--output=dropped.svg']);
  assert.equal(dropped.code, 2, dropped.stderr);
  assert.match(dropped.stderr, /"disguised.png" is not a picture this shell recognises/);
  for (const r of [csv, named, dropped]) assert.equal(canaryIn(Buffer.from(r.stderr)), false);
});

test('a path typed into --logos still reads the picture', { skip: SKIP }, async () => {
  const r = await cli(['run', 'logo-wall', '--logos=[{"logo":"./a.svg"},{"logo":{"id":"d.png"}}]', '--output=typed.svg', '--no-provenance']);
  ok(r);
  assert.deepEqual(images(await readFile(join(root, 'logos', 'typed.svg'), 'utf8')), ['svg+xml', 'png']);
});

test('a local path inside a pasted link or a z= state is refused', { skip: SKIP }, async () => {
  const rows = JSON.stringify([{ logo: join(root, 'logos', 'd.png') }]);
  const link = `https://lolly.tools/#/tool/logo-wall?logos=${encodeURIComponent(rows)}`;
  const pasted = await cli([link, '--output=pasted.svg', '--no-provenance']);
  assert.equal(pasted.code, 4, pasted.stderr);
  assert.match(pasted.stderr, /the link sets a logo of ".*d\.png", a file on this computer\. A link cannot choose files for the CLI to read/);
  assert.equal(existsSync(join(root, 'logos', 'pasted.svg')), false);

  const token = await packQuery(`logos=${encodeURIComponent(rows)}`);
  assert.ok(token, 'the packer is available');
  const packed = await cli(['run', 'logo-wall', `--z=${token}`, '--output=packed.svg', '--no-provenance']);
  assert.equal(packed.code, 4, packed.stderr);
  assert.match(packed.stderr, /A link cannot choose files for the CLI to read/);
  assert.equal(existsSync(join(root, 'logos', 'packed.svg')), false);

  // A file: URL in the row is the same thing spelled as a URL.
  const fileRows = JSON.stringify([{ logo: { url: `file://${join(root, 'credentials')}`, type: 'raster' } }]);
  const fileLink = await cli([`https://lolly.tools/#/tool/logo-wall?logos=${encodeURIComponent(fileRows)}`, '--output=file-url.svg', '--no-provenance']);
  assert.equal(fileLink.code, 4, fileLink.stderr);
  assert.match(fileLink.stderr, /the link sets a logo of "file:\/\/.*credentials", a file on this computer/);
  assert.equal(existsSync(join(root, 'logos', 'file-url.svg')), false);

  // The same picture typed after the link is the person's own choice.
  const typed = await cli([link, `--logos=${rows}`, '--output=typed-after.svg', '--no-provenance']);
  ok(typed);
  assert.deepEqual(images(await readFile(join(root, 'logos', 'typed-after.svg'), 'utf8')), ['png']);
});

test('a link that sets a flag pointing at a file is refused', { skip: SKIP }, async () => {
  for (const [query, flag] of [
    [`logos-data=${encodeURIComponent(join(root, 'credentials'))}`, 'logos-data='],
    [`logos-file=${encodeURIComponent(join(root, 'credentials'))}`, 'logos-file='],
    [`output=${encodeURIComponent(join(root, 'overwritten.svg'))}`, 'output='],
  ] as const) {
    const r = await cli([`https://lolly.tools/#/tool/logo-wall?${query}`, '--no-provenance']);
    assert.equal(r.code, 4, r.stderr);
    assert.ok(r.stderr.includes(`The link sets ${flag}`), r.stderr);
  }
  const named = await cli([`https://lolly.tools/#/tool/logo-wall?filename=${encodeURIComponent('../escaped.svg')}`, '--no-provenance']);
  assert.equal(named.code, 4, named.stderr);
  assert.match(named.stderr, /The link sets filename=\.\.\/escaped\.svg, a path rather than a file name/);
  assert.equal(existsSync(join(root, 'overwritten.svg')), false);
  assert.equal(existsSync(join(root, 'escaped.svg')), false);
});

test('link-borne keys: a pasted link\'s, and what a packed state adds beyond the typed flags', () => {
  const typed = new URLSearchParams('z=tok&w=10');
  assert.deepEqual([...linkBorneKeys(typed, 'logos=a&w=10')], ['logos']);
  assert.deepEqual([...linkBorneKeys(typed, 'logos=a&w=5&w=10')].sort(), ['logos', 'w'], 'a key the state also set counts');
  assert.deepEqual([...linkBorneKeys(new URLSearchParams('logos=a&w=1'), 'logos=a&w=1', new Set(['logos']))], ['logos']);
  assert.deepEqual([...linkBorneKeys(new URLSearchParams('logos=a'), 'logos=a')], [], 'all typed');
  for (const flag of ['output', 'logos-data', 'logos-file', 'logos-files', 'user-profile', 'document', 'sign-key']) assert.ok(isLocalPathFlag(flag), flag);
  for (const flag of ['logos', 'filename', 'width', 'format']) assert.equal(isLocalPathFlag(flag), false, flag);
});

test('the helpers read pictures by their bytes and keep the web drop filter', () => {
  assert.equal(imageMime('logo.bin', PNG), 'image/png');
  assert.equal(imageMime('logo.png', new TextEncoder().encode(svg('#000'))), 'image/svg+xml');
  assert.equal(imageMime('notes.txt', new TextEncoder().encode('hello')), 'application/octet-stream');
  assert.equal(imageMime('notes.png', new TextEncoder().encode('hello')), 'application/octet-stream', 'the name alone is not a picture');
  assert.equal(imageMime('scan.tif', new Uint8Array([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0])), 'image/tiff');
  assert.equal(acceptsMime('image/*', 'image/svg+xml'), true);
  assert.equal(acceptsMime(undefined, 'application/pdf'), false);
  assert.equal(acceptsMime('image/png, image/svg+xml', 'image/jpeg'), false);
  assert.deepEqual(parsePathList('a.svg\r\n\n  # skip\n b.png \n'), ['a.svg', 'b.png']);
});

test('the dropToAdd flags and the engine-added render inputs are known flags', () => {
  const manifest = {
    inputs: [{ id: 'logos', type: 'blocks', dropToAdd: { field: 'logo' } }],
    render: { transparentBg: true, formats: ['svg'] },
  };
  assert.deepEqual(unknownFlags({ 'logos-file': 'a.png', 'logos-files': '-', transparentBg: '0', convertPaths: '1' }, manifest), []);
  assert.deepEqual(unknownFlags({ 'logos-filez': 'a.png' }, manifest), ['logos-filez']);
});
