// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI's browser-free Design page export (plan 295, P3d): the Node host for the
 * engine's `designPageSvg`, when it draws a page and when it hands one to the browser
 * tier, and the CLI run that delivers the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { designPageSvg } from '../engine/src/design-page-svg.ts';
import { designOpsSvgNode } from '../packages/node-shell/src/design-ops-svg.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { createNodeTextShaper } from '../packages/node-shell/src/text-measure.ts';

const ROOT = repoRoot();
const boxes = [
  { id: 'cover', kind: 'frame', x: 0, y: 0, w: 640, h: 400, bg: '#f4f1ea', order: 0 },
  { id: 'title', kind: 'text', x: 40, y: 40, w: 560, h: 120, text: 'Drawn **without** a browser', fontSize: 40, frame: 'cover' },
  { id: 'chip', kind: 'box', x: 40, y: 200, w: 200, h: 80, bg: '#1c7ed6', shape: 'rounded', radius: 16, stroke: '#0b7285', strokeW: 4, frame: 'cover' },
  { id: 'second', kind: 'frame', x: 700, y: 0, w: 300, h: 200, order: 1 },
];
const frameNode = (id: string | null) => ({ getAttribute: (name: string) => (name === 'data-frame-id' ? id : null) }) as unknown as Element;
const text = createNodeTextAPI({ repoRoot: ROOT });
const host = { text, assets: { get: async (id: string) => { throw new Error(`no asset ${id}`); } } } as unknown as HostV1;
const doc = (rows: unknown[]) => ({ sourceDocument: { toolId: 'design', values: { boxes: rows } } });

test('a frame draws from the operations in Node, byte for byte the engine pipeline', async () => {
  const page = await designOpsSvgNode(frameNode('cover'), doc(boxes), host, { repoRoot: ROOT });
  assert.ok(page && 'svg' in page, `the page is drawn (${page && 'reason' in page ? page.reason : 'no page'})`);
  const expected = await designPageSvg({ boxes }, 'cover', { shaper: createNodeTextShaper({ repoRoot: ROOT }), toPath: (o) => text.toPath(o), picture: async () => null },
    { dpi: 96, size: { width: '640px', height: '400px', px: { w: 640, h: 400 } } });
  assert.equal(page.svg, expected.svg);
  assert.ok(!page.svg.includes('<text'), 'the words are outlines');
});

test('Node hands a page to the browser tier, with the reason, whenever it cannot draw all of it', async () => {
  assert.equal(await designOpsSvgNode(frameNode('cover'), {}, host, { repoRoot: ROOT }), null, 'not a Design document: not this path at all');
  const reason = async (node: Element, opts: object, rows: unknown[] = boxes) => {
    const out = await designOpsSvgNode(node, { ...doc(rows), ...opts }, host, { repoRoot: ROOT });
    return out && 'reason' in out ? out.reason : '';
  };
  assert.match(await reason(frameNode(null), {}), /not a single frame/);
  assert.match(await reason(frameNode('cover'), { watermark: true }), /watermark/);
  assert.match(await reason(frameNode('gone'), {}), /no visible frame "gone"/);
  const withEmoji = boxes.map((row) => (row.id === 'title' ? { ...row, text: 'Hello 👋' } : row));
  assert.match(await reason(frameNode('cover'), {}, withEmoji), /text-emoji \(title\)/);
  const withBrandColor = boxes.map((row) => (row.id === 'chip' ? { ...row, bg: 'var(--brand-primary)' } : row));
  assert.match(await reason(frameNode('cover'), {}, withBrandColor), /color-unresolved \(chip\)/, 'a brand colour only the live page can read');
  const withPicture = [...boxes, { id: 'pic', kind: 'image', x: 300, y: 200, w: 100, h: 100, image: 'missing/asset', frame: 'cover' }];
  assert.match(await reason(frameNode('cover'), {}, withPicture), /image-unread \(pic\)/, 'a picture the host cannot read is never left out');
});

test('the CLI exports a Design frame as SVG without a browser', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-design-ops-'));
  try {
    const out = join(dir, 'cover.svg');
    const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', `--boxes=${JSON.stringify(boxes)}`, '--s=cover', '--export=svg', `--output=${out}`], {
      cwd: ROOT, encoding: 'utf8',
      // No web build to escalate to: success here can only be the browser-free path.
      env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), NO_COLOR: '1' },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stderr, /Escalating/);
    const svg = await readFile(out, 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="640px" height="400px" viewBox="0 0 640 400"/);
    assert.ok(svg.includes('<metadata>') && svg.includes('fill="#1c7ed6"') && !svg.includes('<text'), 'the export metadata, the box and outlined words');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
