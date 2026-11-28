// SPDX-License-Identifier: MPL-2.0
/**
 * The text formats the engine fills from a tool's sibling template render on this
 * server with no browser (plans/371, M1.5), as they do in the CLI and the TUI since
 * M1.2. The server kept a list of its own that lagged the engine, so an MCP render of
 * `captions` to srt or `color-palette` to css went looking for the browser tier, and
 * the public GET route refused them.
 *
 * Run with no web shell built and none running. Every render below also asserts the
 * tier that made it, and the route tests use the route's own no-browser rule, so a
 * format that reached for a browser fails here rather than passing on a machine that
 * happens to have one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_FORMATS } from '../../../engine/src/runtime.ts';
import { ENGINE_TEXT_FORMATS, TIER_A, isTextFormat, mimeForFormat, render } from '../src/render.ts';
import { renderGet } from '../src/render-get.ts';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';

process.env.LOLLY_WEB_DIST = '/nonexistent/lolly-web-dist';
delete process.env.LOLLY_WEB_BASE;

const env = {} as NodeJS.ProcessEnv;
let ipSeq = 0;
const ip = (): string => `10.37.1.${++ipSeq}`;
const text = (bytes: Uint8Array | string | undefined): string =>
  bytes === undefined ? '' : typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes);
/** A query the route will not redirect: URLSearchParams spelling, keys sorted. */
const query = (params: Record<string, string>): string => { const q = new URLSearchParams(params); q.sort(); return q.toString(); };

/**
 * What the public GET route serves for each engine text format, written out. A new
 * engine format reaches the route through ENGINE_TEXT_FORMATS on its own, so this
 * table is where somebody has to look at its type first: a type a browser runs as a
 * script or renders as a document from the route's origin needs more than the
 * sandbox and nosniff headers the route sends.
 */
const SERVED: Record<string, string> = {
  json: 'application/json', csv: 'text/csv', ics: 'text/calendar', vcf: 'text/vcard',
  srt: 'text/plain', vtt: 'text/vtt', ttml: 'application/ttml+xml', scc: 'text/plain',
  css: 'text/css', scss: 'text/x-scss', gpl: 'text/plain',
};

test('every text format the engine writes renders on this server with no browser', () => {
  for (const format of Object.keys(DATA_FORMATS)) {
    assert.ok(TIER_A.has(format), `${format} must be in TIER_A in services/mcp/src/render.ts`);
    assert.equal(mimeForFormat(format), DATA_FORMATS[format], `mimeForFormat("${format}") must be the engine's type`);
    assert.ok(isTextFormat(format), `${format} is text: the route adds charset=utf-8 and lolly_render returns text`);
  }
  assert.deepEqual([...ENGINE_TEXT_FORMATS].sort(), Object.keys(DATA_FORMATS).sort());
});

test('the engine text formats the public route serves, and their types, are the reviewed list', () => {
  const served = Object.fromEntries(ENGINE_TEXT_FORMATS.map(format => [format, mimeForFormat(format)]));
  assert.deepEqual(served, SERVED,
    'the engine gained or changed a text format: check the type and the headers render-get.ts sends for it, then update SERVED');
});

const cases: Array<[tool: string, format: string, starts: RegExp]> = [
  ['captions', 'srt', /^1\n00:00:00,000 --> /],
  ['captions', 'vtt', /^WEBVTT\n/],
  ['captions', 'ttml', /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<tt /],
  ['captions', 'scc', /^Scenarist_SCC V1\.0\n/],
  ['color-palette', 'css', /^:root \{\n\s+--color-/],
  ['color-palette', 'scss', /^\$color-/],
  ['color-palette', 'gpl', /^GIMP Palette\n/],
];

for (const [tool, format, starts] of cases) {
  test(`${tool} renders ${format} in process, with the engine's type`, async () => {
    const r = await render(tool, '', { format, noBrowser: true });
    assert.equal(r.tier, 'A');
    assert.equal(r.mime, DATA_FORMATS[format]);
    assert.equal(r.format, format);
    assert.match(text(r.bytes), starts);
  });
}

let nextId = 1;
interface ToolResult { content: { type: string; text?: string; resource?: { uri: string; mimeType: string; text?: string; blob?: string } }[]; isError?: boolean }

for (const [tool, format, starts] of cases) {
  test(`lolly_render returns ${tool} as ${format} text`, async () => {
    // Checked first: a format missing from TIER_A would otherwise try to start a browser.
    assert.ok(TIER_A.has(format));
    const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_render', arguments: { toolId: tool, format } } })) as JsonRpcResponse;
    assert.ok(!res.error, JSON.stringify(res.error));
    const r = res.result as unknown as ToolResult;
    assert.ok(!r.isError, JSON.stringify(r.content));
    assert.match(r.content[0]!.text ?? '', /, tier A\)\./);
    const resource = r.content.find(c => c.type === 'resource')?.resource;
    assert.ok(resource, 'a resource block');
    assert.equal(resource.mimeType, DATA_FORMATS[format]);
    assert.equal(resource.blob, undefined, 'text, not base64');
    assert.match(resource.text ?? '', starts);
  });
}

for (const [tool, format, starts] of cases) {
  test(`GET /tool/${tool}.${format} serves the file with the route's headers`, async () => {
    const r = await renderGet(`/tool/${tool}.${format}`, '', { ip: ip(), env });
    assert.equal(r.status, 200, text(r.body));
    assert.equal(r.headers['content-type'], `${DATA_FORMATS[format]}; charset=utf-8`);
    // The headers html and svg rely on, on every one of these too: nothing the route
    // serves runs in its origin when opened directly, and no browser second-guesses
    // the type, so scss and the plain-text formats are never read as a stylesheet.
    assert.equal(r.headers['content-security-policy'], 'sandbox');
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['content-disposition'], `inline; filename="${tool}.${format}"`);
    assert.match(r.headers.etag!, /^"[0-9a-f]{32}"$/);
    assert.match(text(r.body), starts);
  });
}

// What a hostile query can make the route serve as a stylesheet. The palette files
// come from the engine's writers (engine/src/palette-export.ts): names are slugged to
// [a-z0-9-] and every value is a colour the engine checked, so no rule, import, url()
// or markup can come through from an input.
const CSS_LINE = new RegExp([
  /^:root \{$/, /^\}$/, /^ {2}--[a-z0-9-]+: #[0-9a-f]{6};$/,
  /^@supports \(color: [a-z0-9(). %/-]+\) \{$/, /^ {2}:root \{$/, /^ {4}--[a-z0-9-]+: [a-z0-9(). %/-]+;$/, /^ {2}\}$/,
  /^\.(?:bg|text|border)-[a-z0-9-]+ \{(?: [a-z-]+: [#a-z0-9(). %/-]+;){1,2} \}$/,
].map(re => re.source).join('|'));

test('a hostile palette query cannot put its own CSS into the stylesheet the route serves', async () => {
  const hostile = 'red;}@import url(//evil.example/x.css);:root{--a:';
  const queries: Array<Record<string, string>> = [
    { seed: hostile },
    { seed: `${hostile}</style><script>alert(1)</script>`, harmony: '}*{background:url(//evil.example/t)}' },
    { seed: '#ff0000', cs: 'classes', lc: '}@import "//evil.example/x.css";' },
    { seed: 'oklch(0.7 0.3 150)', cs: 'classes' },
  ];
  for (const params of queries) {
    const r = await renderGet('/tool/color-palette.css', query(params), { ip: ip(), env });
    assert.equal(r.status, 200, text(r.body));
    assert.equal(r.headers['content-type'], 'text/css; charset=utf-8');
    const body = text(r.body);
    for (const line of body.split('\n').filter(Boolean)) {
      assert.match(line, CSS_LINE, `unexpected stylesheet line for ${JSON.stringify(params)}`);
    }
    assert.doesNotMatch(body, /@import|url\(|evil|<|>/);
  }
});

test('caption text reaches a ttml file from the route as escaped text, never as markup', async () => {
  const transcript = '1\n00:00:00,000 --> 00:00:02,000\nTom & "Jerry" ]]> <script>alert(1)</script> 1 < 2\n';
  const r = await renderGet('/tool/captions.ttml', query({ transcript }), { ip: ip(), env });
  assert.equal(r.status, 200, text(r.body));
  assert.equal(r.headers['content-type'], 'application/ttml+xml; charset=utf-8');
  assert.equal(r.headers['content-security-policy'], 'sandbox');
  const body = text(r.body);
  const cue = /<p xml:id="c1" [^>]*>([^\n]*)<\/p>/.exec(body)?.[1];
  assert.ok(cue !== undefined, body);
  assert.doesNotMatch(cue, /<(?!br\/>)/, 'no element but a line break inside a cue');
  assert.match(cue, /^Tom &amp; &quot;Jerry&quot; \]\]&gt; /);
  assert.doesNotMatch(body, /<script/);
});

test('a tool that does not declare a text format is a 400 on the route, not a render', async () => {
  const r = await renderGet('/tool/qr-code.css', '', { ip: ip(), env });
  assert.equal(r.status, 400);
  assert.match(text(r.body), /does not support format \\"css\\"/);
});
