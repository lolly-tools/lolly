// SPDX-License-Identifier: MPL-2.0
// Web page boxes (plan 288): what a Design box may frame, and in what form.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOSTED_FRAME_ORIGINS, allowedOnHostedWeb, parseWebEmbed } from '../engine/src/web-embed.ts';

const ctx = { appOrigin: 'https://lolly.tools' };
const src = (input: string) => parseWebEmbed(input, ctx)?.src ?? null;

test('refuses anything that could run as the app or carry secrets', () => {
  for (const input of [
    'javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<script>1</script>', 'blob:https://lolly.tools/x',
    'file:///etc/passwd', 'ftp://example.com/x', 'http://example.com/', 'https://user:pw@example.com/',
    'https://lolly.tools/api/v1/org-config', 'https://lolly.tools/catalog/x.html', 'https://lolly.tools/',
    '', '   ', 'not a url', 'x'.repeat(20_000),
  ]) assert.equal(parseWebEmbed(input, ctx), null, input);
  assert.equal(parseWebEmbed(42, ctx), null);
});

test('Lolly tool links become same-origin iframe-mode frames on this app, with export triggers removed', () => {
  const local = { appOrigin: 'http://localhost:5173' };
  const sandbox = parseWebEmbed('https://lolly.tools/#/tool/sandbox?html=%3Ch1%3Ehi&export&format=png&full', local)!;
  assert.equal(sandbox.provider, 'sandbox');
  assert.equal(sandbox.sameOrigin, true);
  assert.equal(sandbox.sandbox, null, 'a same-origin Lolly frame runs as the app');
  assert.equal(sandbox.src, 'http://localhost:5173/#/tool/sandbox?html=%3Ch1%3Ehi&iframe', 'rehomed to this app, flags reduced to iframe');
  assert.equal(parseWebEmbed('http://localhost:5173/t/chart?ct=bar', local)!.src, 'http://localhost:5173/#/tool/chart?ct=bar&iframe');
  const long = 'https://lolly.tools/#/tool/sandbox?html=' + 'x'.repeat(9000);
  assert.ok(parseWebEmbed(long, local), 'a long Sandbox link is still a Lolly link');
  assert.equal(parseWebEmbed('https://lolly.tools/#/tool/nope', { ...local, knownTool: (id) => id === 'chart' }), null, 'unknown tools are refused');
  assert.equal(parseWebEmbed('https://lolly.tools/#/tool/Bad_ID', local), null);
  assert.equal(parseWebEmbed('https://example.com/about', local)!.kind, 'page', 'a bare path on another host is not a Lolly tool');
});

test('providers turn share links into their embed forms', () => {
  assert.equal(src('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1&start=90');
  assert.equal(src('youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1');
  assert.equal(src('https://youtube.com/shorts/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1');
  assert.equal(src('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871');
  assert.equal(src('https://vimeo.com/76979871/8272103f6e#t=30s'), 'https://player.vimeo.com/video/76979871?h=8272103f6e#t=30s');
  assert.equal(src('https://www.loom.com/share/0123456789abcdef0123456789abcdef'), 'https://www.loom.com/embed/0123456789abcdef0123456789abcdef');
  assert.equal(src('https://www.google.com/maps?q=Nuremberg'), 'https://www.google.com/maps?q=Nuremberg&output=embed');
  assert.match(src('https://www.figma.com/design/ABC123/Deck')!, /^https:\/\/www\.figma\.com\/embed\?embed_host=lolly&url=/);
  assert.equal(src('https://codepen.io/team/pen/abcXYZ'), 'https://codepen.io/team/embed/abcXYZ?default-tab=result');
  assert.equal(src('https://stackblitz.com/edit/vitejs-vite?file=main.ts'), 'https://stackblitz.com/edit/vitejs-vite?file=main.ts&embed=1');
  assert.equal(src('https://codesandbox.io/s/abc123'), 'https://codesandbox.io/embed/abc123');
  assert.equal(src('https://asciinema.org/a/335480'), 'https://asciinema.org/a/335480/iframe');
  assert.equal(src('https://observablehq.com/@d3/gallery'), 'https://observablehq.com/embed/@d3/gallery');
  assert.equal(src('<iframe width="560" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=x&amp;start=5" allowfullscreen></iframe>'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1&start=5', 'a pasted embed snippet keeps only its src');
  const code = parseWebEmbed('https://codepen.io/team/pen/abcXYZ', ctx)!;
  assert.equal(code.authorCode, true, 'author code is flagged for the hosted CSP decision');
});

test('unknown pages get the strict sandbox, loopback dev servers are allowed, refusers are flagged', () => {
  const page = parseWebEmbed('https://example.com/slides', ctx)!;
  assert.equal(page.kind, 'page');
  assert.doesNotMatch(page.sandbox!, /allow-top-navigation/);
  assert.equal(page.viewport, 1280);
  const dev = parseWebEmbed('localhost:3000/demo', ctx)!;
  assert.equal(dev.src, 'http://localhost:3000/demo');
  assert.equal(dev.loopback, true);
  assert.match(dev.allow, /local-network-access/);
  assert.equal(parseWebEmbed('https://github.com/lolly-tools/lolly', ctx)!.refuses, true);
  assert.equal(parseWebEmbed('https://docs.google.com/document/d/x/edit', ctx)!.refuses, true);
  assert.equal(parseWebEmbed('https://docs.google.com/presentation/d/x/embed', ctx)!.refuses, undefined);
});

test('the hosted list is exactly the frame-src the web CSP adds, and nothing that runs author code', () => {
  const headers = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { headers: { headers: { key: string; value: string }[] }[] };
  const csp = headers.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')!.value;
  const frameSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('frame-src '))!.split(/\s+/).slice(1);
  assert.deepEqual(frameSrc.filter((s) => s.startsWith('https://')).sort(), [...HOSTED_FRAME_ORIGINS].sort());
  for (const origin of HOSTED_FRAME_ORIGINS) {
    const host = new URL(origin).hostname;
    assert.ok(!['codepen.io', 'stackblitz.com', 'codesandbox.io', 'jsfiddle.net', 'observablehq.com'].includes(host), origin);
  }
  assert.equal(allowedOnHostedWeb(parseWebEmbed('https://youtu.be/dQw4w9WgXcQ', ctx)!), true);
  assert.equal(allowedOnHostedWeb(parseWebEmbed('https://codepen.io/team/pen/abcXYZ', ctx)!), false);
  assert.equal(allowedOnHostedWeb(parseWebEmbed('https://lolly.tools/#/tool/sandbox', ctx)!), true);
});
