// SPDX-License-Identifier: MPL-2.0
/**
 * An uploaded font outlines in a vector export whichever design system is active.
 *
 * Uploads used to be stored for the device's default design system, while the
 * vector-export font registry offers only the active system's faces. A fresh device
 * runs the shipped system, so on it, and on any system the person made, an uploaded
 * face never reached the export: the SVG kept the run as `<text>` and the PDF drew it
 * in a stand-in face. Each case here starts from an empty device in a new browser
 * context, uploads one public face (Cinzel, a family no catalog or platform font
 * answers for) as a TTF or a WOFF2 file, sets a run in it and exports. The same face
 * declared by the page with `@font-face` is the reference: the uploaded run's SVG
 * outlines and PDF drawing must be the reference's, exactly.
 *
 * Needs the source shell (`LOLLY_EXPORT_TEST_URL`, a Vite dev server, as CI starts
 * it) and Chromium; skips by name without either.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { decodeWoff2 } from '../packages/node-shell/src/woff2.ts';
import { useNodeWoff2Runner } from '../packages/node-shell/src/woff2-node.ts';

const REPO = fileURLToPath(new URL('..', import.meta.url));

async function chromiumOrSkip(): Promise<{ chromium: typeof import('playwright').chromium } | string> {
  let chromium: typeof import('playwright').chromium;
  try { ({ chromium } = await import('playwright')); } catch { return 'playwright not installed'; }
  try {
    const path = chromium.executablePath();
    if (!path || !existsSync(path)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}

interface Exported { svg: string; pdf: string }
interface CaseResult { activeBefore: string; activeAfter: string; assetIds: string[]; listed: string[]; uploaded: Exported; reference: Exported }

/** Every `d` attribute of an SVG, in order. */
const pathData = (svg: string): string[] => [...svg.matchAll(/\bd="([^"]+)"/g)].map((m) => m[1]!);

/** The PDF's streams, inflated where they are compressed, leaving out the XMP packet
 *  (its dates and document ids differ on every export): the page drawing is among them. */
function pdfStreams(base64: string): string[] {
  const bytes = Buffer.from(base64, 'base64');
  const text = bytes.toString('latin1');
  const out: string[] = [];
  for (const match of text.matchAll(/(?<!end)stream\r?\n/g)) {
    const start = match.index! + match[0].length;
    const end = text.indexOf('endstream', start);
    if (end < 0) break;
    const raw = bytes.subarray(start, end);
    let data: string;
    try { data = inflateSync(raw).toString('latin1'); } catch { data = raw.toString('latin1'); }
    if (!data.includes('<x:xmpmeta')) out.push(data);
  }
  return out;
}

test('an uploaded font outlines in SVG and PDF exports under the shipped and a person\'s own design system', { timeout: 600_000 }, async (t) => {
  const browserType = await chromiumOrSkip();
  if (typeof browserType === 'string') { t.skip(browserType); return; }
  const origin = process.env.LOLLY_EXPORT_TEST_URL;
  if (!origin) { t.skip('set LOLLY_EXPORT_TEST_URL to a local Vite shell'); return; }

  useNodeWoff2Runner();
  const woff2 = readFileSync(join(REPO, 'shells/web/public/info/fonts/cinzel-latin.woff2'));
  const ttf = Buffer.from(await decodeWoff2(new Uint8Array(woff2)));
  assert.equal(ttf.readUInt32BE(0), 0x00010000, 'the decoded face is a TrueType sfnt');

  const browser = await browserType.chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  t.after(() => browser.close());

  const files = { ttf: { name: 'Cinzel.ttf', bytes: ttf }, woff2: { name: 'cinzel-latin.woff2', bytes: woff2 } };
  for (const system of ['shipped', 'own'] as const) {
    for (const format of ['ttf', 'woff2'] as const) {
      await t.test(`${format} upload, ${system === 'shipped' ? 'the shipped design system' : 'a design system the person made'}`, async () => {
        // A new context is an empty device: no design systems of the person's, no fonts.
        const context = await browser.newContext({ serviceWorkers: 'block' });
        try {
          const page = await context.newPage();
          await page.goto(`${origin}/#/profile`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
          const result = await page.evaluate(async ({ base64, filename, system }): Promise<CaseResult> => {
            const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
            const [{ createBridge }, fonts, { renderSvgFromHtml }, { setExportHost }, registry, { renderPdf }, manage] = await Promise.all([
              import('/src/bridge/index.ts' as string), import('/src/user-fonts.ts' as string),
              import('/src/bridge/export-svg-walker.ts' as string), import('/src/bridge/export-shared.ts' as string),
              import('/src/bridge/font-registry.ts' as string), import('/src/bridge/export.ts' as string),
              import('/src/lib/design-system/manage.ts' as string),
            ]);
            const host = await createBridge();
            setExportHost(host);
            if (system === 'own') {
              const record = await manage.createDesignSystem(host, { label: 'Fieldwork', seedFrom: 'shipped' });
              await host.designSystems.setActive(record.id);
              host.tokens.bust?.();
            }
            const activeBefore = await host.designSystems.activeId();
            const installed = await fonts.installFontFromBytes(host, bytes, { filename, makePrimary: false });
            if (!installed) throw new Error('the font was not installed');
            const activeAfter = await host.designSystems.activeId();
            const listed = (await fonts.listUserFonts(host)).map((f: { family: string }) => f.family);

            const toBase64 = async (blob: Blob): Promise<string> => {
              const buffer = new Uint8Array(await blob.arrayBuffer());
              let out = '';
              for (let i = 0; i < buffer.length; i += 8192) out += String.fromCharCode(...buffer.subarray(i, i + 8192));
              return btoa(out);
            };
            const exportRun = async (family: string): Promise<Exported> => {
              const node = document.createElement('div');
              node.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:160px;background:#fff;color:#111';
              const run = document.createElement('span');
              run.style.cssText = `font-family:"${family}";font-size:64px;line-height:1`;
              run.textContent = 'LOLLY FONTS';
              node.append(run);
              document.body.append(node);
              try {
                await document.fonts.load(`64px "${family}"`);
                registry.bustFontRegistry();
                const svg = await (await renderSvgFromHtml(node, { format: 'svg', convertPaths: true, embedMeta: false })).text();
                const pdf = await toBase64(await renderPdf(node, { format: 'pdf', convertPaths: true, embedMeta: false }));
                return { svg, pdf };
              } finally { node.remove(); }
            };

            const uploaded = await exportRun(installed.family);
            // The reference: the same bytes, declared by the page under a family of its own.
            const blobUrl = URL.createObjectURL(new Blob([bytes]));
            const style = document.createElement('style');
            style.textContent = `@font-face{font-family:"Cinzel Reference";src:url("${blobUrl}")}`;
            document.head.append(style);
            const reference = await exportRun('Cinzel Reference');
            return { activeBefore, activeAfter, assetIds: installed.assetIds, listed, uploaded, reference };
          }, { base64: files[format].bytes.toString('base64'), filename: files[format].name, system });

          // Where the case starts: an empty device on the shipped system, or the person's own.
          if (system === 'shipped') assert.equal(result.activeBefore, 'shipped');
          else assert.notEqual(result.activeBefore, 'shipped');

          // The reference itself outlines, so it is a fair yardstick.
          assert.doesNotMatch(result.reference.svg, /<text\b/, 'the declared face outlines');
          assert.ok(pathData(result.reference.svg).length > 0, 'the declared face drew paths');

          assert.doesNotMatch(result.uploaded.svg, /<text\b/, 'no <text> fallback in the SVG');
          assert.deepEqual(pathData(result.uploaded.svg), pathData(result.reference.svg), 'the SVG outlines are the uploaded face\'s');
          assert.deepEqual(pdfStreams(result.uploaded.pdf), pdfStreams(result.reference.pdf), 'the PDF draws the run in the uploaded face');

          if (system === 'shipped') {
            // An upload is an edit, and an edit under the shipped system starts the person's copy.
            assert.notEqual(result.activeAfter, 'shipped');
          } else {
            assert.equal(result.activeAfter, result.activeBefore, 'the person\'s own system stays active');
            for (const id of result.assetIds) assert.ok(id.startsWith(`user/ds/${result.activeBefore}/fonts/`), id);
          }
          assert.ok(result.listed.includes('Cinzel'), `the Fonts list of the active system holds the face: ${result.listed.join(', ')}`);
        } finally { await context.close(); }
      });
    }
  }
});
