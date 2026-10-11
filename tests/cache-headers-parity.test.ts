// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cachePolicy } from '../packages/core/src/delivery-v1.ts';
import { nginxDeliveryMaps } from '../scripts/build-delivery.ts';

const yuno = readFileSync(new URL('../deploy/yunohost/conf/nginx.conf', import.meta.url), 'utf8');
const hosted = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  rewrites: Array<{ source: string; destination: string }>;
};
interface Location { mode: string; path: string; body: string; }

function withoutComments(text: string): string {
  let result = '', quote = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '\\') { result += char + (text[++i] ?? ''); continue; }
    if (quote) { if (char === quote) quote = ''; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === '#') { while (i < text.length && text[i] !== '\n') i++; result += '\n'; continue; }
    result += char;
  }
  return result;
}
function locations(text: string): Location[] {
  const result: Location[] = [], clean = withoutComments(text);
  for (const match of clean.matchAll(/\blocation\s+(?:(=|\^~|~\*?)\s+)?("[^"]+"|[^\s{]+)\s*\{/g)) {
    const start = match.index! + match[0].length;
    let end = start, depth = 1, quote = '';
    for (; end < clean.length && depth; end++) {
      const char = clean[end]!;
      if (char === '\\') { end++; continue; }
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '{') depth++;
      else if (char === '}') depth--;
    }
    assert.equal(depth, 0, 'Unclosed Nginx location block');
    result.push({ mode: match[1] ?? '', path: match[2]!.replace(/^"|"$/g, ''), body: clean.slice(start, end - 1) });
  }
  return result;
}
const blocks = locations(yuno), base = blocks.find(block => block.mode === '' && block.path === '/')!;
function selected(path: string): Location {
  const exact = blocks.find(block => block.mode === '=' && block.path === path);
  if (exact) return exact;
  const prefix = blocks.filter(block => ['', '^~'].includes(block.mode) && path.startsWith(block.path)).sort((a, b) => b.path.length - a.path.length)[0]!;
  if (prefix.mode === '^~') return prefix;
  return blocks.find(block => block.mode.startsWith('~') && new RegExp(block.path, block.mode === '~*' ? 'i' : '').test(path)) ?? prefix;
}
function applied(body: string, status: number, headers: Record<string, string>): void {
  const own = body.split(/\blocation\s+(?:[=~^]|\/|"|\()/)[0]!;
  for (const command of own.matchAll(/more_set_headers\s+(?:-s\s+"([0-9 ]+)"\s+)?((?:"[^"\n]*"\s*)+);/g)) {
    if (command[1] && !command[1].split(' ').includes(String(status))) continue;
    for (const header of command[2]!.matchAll(/"([A-Za-z-]+): ([^"]*)"/g)) headers[header[1]!.toLowerCase()] = header[2]!;
  }
}
function yunoHeaders(path: string, status: number): Record<string, string> {
  const headers: Record<string, string> = {}, location = selected(path);
  applied(base.body, status, headers);
  if (location !== base) applied(location.body, status, headers);
  return headers;
}
function vercelHeaders(path: string): Record<string, string> {
  return Object.fromEntries(hosted.headers.filter(row => new RegExp('^' + row.source + '$').test(path))
    .flatMap(row => row.headers.map(header => [header.key.toLowerCase(), header.value])));
}

test('YunoHost immutable successes match the core policy and errors fail closed', () => {
  const immutable = ['/_app/main-a1b2.js', '/ort-hf/1.24.3/ort.min.mjs', '/tools/demo@0123456789abcdef/lib/main.js',
    '/models/depth@0123456789abcdef/model.onnx', '/catalog/assets/logo.0123456789abcdef.svg', '/info/shots/demo.0123456789abcdef.webp'];
  for (const path of immutable) for (const status of [200, 206, 304, 302, 400, 401, 403, 404, 405, 413, 429, 500, 503]) {
    const actual = yunoHeaders(path, status), expected = cachePolicy('public-immutable', { status });
    assert.equal(actual['cache-control'], expected.cacheControl, `${path} status ${status}`);
    assert.equal(actual['cdn-cache-control'], expected.cdnCacheControl, `${path} CDN status ${status}`);
  }
});
test('YunoHost legacy aliases revalidate while service workers never enter a shared cache', () => {
  for (const path of ['/fonts/plain.woff2', '/catalog/fonts/plain.woff2', '/ort/ort.wasm', '/models/depth/model.onnx',
    '/tools/demo/template.html', '/catalog/previews/demo.svg', '/catalog/tools/index.sig.json', '/profile', '/any-site/']) {
    for (const status of [200, 206, 304, 403, 404, 500]) {
      const expected = cachePolicy('public-revalidate', { status }), actual = yunoHeaders(path, status);
      assert.equal(actual['cache-control'], expected.cacheControl, `${path} status ${status}`);
      assert.equal(actual['cdn-cache-control'], expected.cdnCacheControl);
    }
  }
  for (const status of [200, 206, 304, 404, 500]) {
    const headers = yunoHeaders('/sw.js', status);
    assert.equal(headers['cache-control'], status < 400 ? 'no-cache, s-maxage=0, no-transform' : cachePolicy('person-private').cacheControl);
    assert.equal(headers['cdn-cache-control'], 'no-store');
    assert.equal(headers['service-worker-allowed'], '/');
  }
});
test('reserved YunoHost files cannot fall back to the SPA and every header scope preserves security', () => {
  for (const path of ['/catalog/assets/missing.png', '/tools/demo@0123456789abcdef/missing.js', '/models/depth/model.onnx',
    '/ort/missing.wasm', '/ort-hf/1.24.3/missing.js', '/_app/missing.js', '/fonts/missing.woff2', '/info/missing.svg', '/view/missing.html']) {
    const body = selected(path).body;
    assert.match(body, /try_files[^;]*=404;/, path);
    assert.doesNotMatch(body, /try_files[^;]*\/index\.html;/, path);
  }
  for (const path of ['/api/missing', '/live/room', '/tool/design.svg', '/.delivery-etags.conf', '/catalog/.hidden.0123456789abcdef.svg', '/_app/.hidden.js']) {
    assert.match(selected(path).body, /return 404;/, path);
    assert.equal(yunoHeaders(path, 404)['cdn-cache-control'], 'no-store');
  }
  for (const block of blocks) {
    const own = block.body.split(/\blocation\s+(?:[=~^]|\/|"|\()/)[0]!;
    if (/more_set_headers/.test(own)) assert.match(own, /__APP__\.headers\.inc;/, block.path);
  }
  assert.doesNotMatch(yuno, /\badd_header\b/);
});
test('generic Vercel static rules fail closed uniformly because they cannot inspect status', () => {
  for (const path of ['/', '/sw.js', '/_app/missing.js', '/ort-hf/1.24.3/missing.js', '/fonts/plain.woff2',
    '/catalog/previews/demo.svg', '/catalog/tools/index.sig.json', '/models/depth@0123456789abcdef/model.onnx', '/tools/demo/lib.js']) {
    const headers = vercelHeaders(path);
    assert.equal(headers['cache-control'], cachePolicy('person-private').cacheControl, path);
    assert.equal(headers['cdn-cache-control'], 'no-store', path);
  }
  for (const path of ['/api/mcp', '/tool/demo.svg', '/live/room']) assert.equal(vercelHeaders(path)['cache-control'], undefined, 'Dynamic origins own their response policy');
  const fallback = hosted.rewrites.find(row => row.destination === '/index.html')!;
  for (const path of ['/catalog/missing.svg', '/models/missing.onnx', '/tools/demo/missing.js', '/view/missing.html', '/live/missing', '/tool/missing.svg']) {
    assert.equal(new RegExp('^' + fallback.source + '$').test(path), false, `${path} must not become the SPA`);
  }
});
test('generated Nginx maps cover status and no-transform independently of platform path rules', () => {
  const maps = nginxDeliveryMaps();
  const error = cachePolicy('person-private'), immutable = cachePolicy('public-immutable');
  assert.ok(maps.includes(`default "${error.cacheControl}"`));
  assert.ok(maps.includes(`default "${error.cdnCacheControl}"`));
  assert.ok(maps.includes(`"${immutable.cacheControl}"`));
  assert.ok(maps.includes(`"${immutable.cdnCacheControl}"`));
  assert.match(maps, /\(200\|206\|304\)/);
});
