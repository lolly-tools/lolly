// SPDX-License-Identifier: MPL-2.0
/**
 * A pasted lolly.tools link says what to draw, never which files on this computer
 * the terminal app reads (engine-render.ts `mountTool` with `fromLink`).
 *
 * Run with: node --test shells/tui/src/link-local-files.test.ts
 *
 * The bridge's `host.assets.bytes` reads `file:` URLs, and Logo Wall inlines what it
 * reads into the export, so a link with `logos=[{"logo":{"url":"file:///..."}}]`
 * copied a file of the person's into the SVG they then exported. The CLI already
 * refuses a local path or `file:` URL that a link chose (LINK_LOCAL_PATH); the
 * terminal app now refuses the link the same way and opens nothing:
 *
 *  - Open URL (`u` in the gallery) routes every link with `fromLink`;
 *  - a `file:` URL or an existing local path in a picture, top-level or in a blocks
 *    row, and a path in a file input are refused, inside a packed `z=` state too;
 *  - the same values from the person's own saved session still open, and a link
 *    whose pictures are inline or catalog ids opens as before.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const root = await mkdtemp(join(tmpdir(), 'lolly-tui-link-files-'));
after(() => rm(root, { recursive: true, force: true }));
process.env.LOLLY_STATE_DIR = join(root, 'state');

const SKIP = !existsSync(join(REPO, 'community', 'logo-wall', 'tool.json')) && 'community pack not mounted';
const CANARY = 'SECRET-TUI-CANARY-0451';
const secret = join(root, 'credentials');
await writeFile(secret, `[default]\naws_secret_access_key = ${CANARY}\n`);
const picture = join(root, 'logo.svg');
await writeFile(picture, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
const inline = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>').toString('base64');

const logos = (rows: unknown[]): string => 'logos=' + encodeURIComponent(JSON.stringify(rows));

test('Open URL routes a link as a link, so its state cannot choose local files', async () => {
  const { toolLinkRoute } = await import('./engine-render.ts');
  const known = (id: string): boolean => id === 'logo-wall';
  assert.deepEqual(toolLinkRoute(`https://lolly.tools/#/tool/logo-wall?${logos([{ logo: inline }])}`, known),
    { toolId: 'logo-wall', query: logos([{ logo: inline }]), fromLink: true });
  assert.deepEqual(toolLinkRoute('https://example.com/', known), { error: 'Not a recognised lolly.tools URL' });
  assert.deepEqual(toolLinkRoute('https://lolly.tools/#/tool/nope', known), { error: 'This build has no tool “nope”' });
});

test('a link that points at a file on this computer is refused, and nothing is mounted', { skip: SKIP }, async () => {
  const { createTuiBridge } = await import('./bridge.ts');
  const { mountTool, LinkLocalFileError } = await import('./engine-render.ts');
  const { packQuery } = await import('../../../engine/src/url-pack.ts');
  const { host } = await createTuiBridge({});
  const refused = async (toolId: string, query: string, value: RegExp): Promise<void> => {
    await assert.rejects(mountTool(toolId, host, query, undefined, { fromLink: true }), (err: unknown) => {
      assert.ok(err instanceof LinkLocalFileError, String(err));
      assert.match(err.message, value);
      assert.match(err.message, /a file on this computer\. A link cannot choose files for Lolly to read, so the tool was not opened\./);
      assert.doesNotMatch(err.message, new RegExp(CANARY));
      return true;
    });
  };
  const fileUrl = `file://${secret}`;
  await refused('logo-wall', logos([{ logo: { url: fileUrl, type: 'vector', format: 'svg' } }]), /a logo in logos to "file:\/\/.*credentials"/);
  await refused('logo-wall', logos([{ logo: fileUrl }]), /"file:\/\/.*credentials"/);
  await refused('logo-wall', logos([{ logo: picture }]), /a logo in logos to ".*logo\.svg"/);
  const token = await packQuery(logos([{ logo: { url: fileUrl, type: 'raster' } }]));
  assert.ok(token, 'the packer is available');
  await refused('logo-wall', `z=${token}`, /"file:\/\/.*credentials"/);
  if (existsSync(join(REPO, 'community', 'strip-data', 'tool.json'))) {
    await refused('strip-data', `source=${encodeURIComponent(secret)}`, /The link sets source to ".*credentials"/);
  }
});

test('the person\'s own state and an inline link still open', { skip: SKIP }, async () => {
  const { createTuiBridge } = await import('./bridge.ts');
  const { mountTool, renderSvg } = await import('./engine-render.ts');
  const { host, dom } = await createTuiBridge({});
  // A saved session (values) or a query this app wrote itself is the person's own.
  const own = await mountTool('logo-wall', host, logos([{ logo: { url: inline, type: 'vector', format: 'svg' } }]), undefined);
  assert.ok(await renderSvg(own.runtime, dom));
  const saved = await mountTool('logo-wall', host, '', { logos: [{ logo: { url: inline, type: 'vector', format: 'svg' } }] }, { fromLink: true });
  assert.ok(await renderSvg(saved.runtime, dom), 'values are the saved session, not the link');
  const linked = await mountTool('logo-wall', host, logos([{ logo: inline }]), undefined, { fromLink: true });
  assert.ok(await renderSvg(linked.runtime, dom), 'a link with an inline picture opens');
});
