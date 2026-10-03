// SPDX-License-Identifier: MPL-2.0
/**
 * The canonical-origin guard at the top of index.html: an alias host the lolly.tools
 * project parks (and its www.*) moves to lolly.tools before any module loads, and
 * every other host keeps the shell where it is. lolly.ing is a private instance that
 * serves this same shell through its own proxy, so the guard must leave it alone or
 * nobody there could stay signed in. The guard's alias list and vercel.json's
 * domain-family redirect are one list, so they are checked against each other.
 *   node --import ./tests/css-stub.mjs --test shells/web/src/canonical-origin-guard.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const guard = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
const hosted = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8')) as {
  redirects: Array<{ source: string; destination: string; has?: Array<{ type: string; value: string }> }>;
};

/** Run the guard on a host; the address it moved to, or null when it stayed. */
function run(hostname: string, at: { pathname?: string; search?: string; hash?: string } = {}): string | null {
  let replaced: string | null = null;
  const location = {
    hostname, pathname: at.pathname ?? '/', search: at.search ?? '', hash: at.hash ?? '',
    replace: (u: string) => { replaced ??= u; },
  };
  const window: Record<string, unknown> = {};
  window.parent = window;
  runInNewContext(guard, {
    location, window,
    localStorage: { getItem: () => null },
    document: { documentElement: { setAttribute: () => {} } },
  });
  return replaced;
}

test('lolly.ing keeps its own shell, deep links included', () => {
  assert.equal(run('lolly.ing'), null);
  assert.equal(run('lolly.ing', { hash: '#/team/ses_abc123' }), null, 'a team session link stays on the instance');
  assert.equal(run('lolly.ing', { hash: '#/team/project/prj_1' }), null);
  assert.equal(run('lolly.ing', { pathname: '/t/design', search: '?z=1a' }), null);
});

test('a parked alias and the www hosts still move to lolly.tools, keeping the address', () => {
  assert.equal(run('lolly.art'), 'https://lolly.tools/');
  assert.equal(run('lolly.art', { pathname: '/t/design', search: '?z=1a', hash: '#x' }), 'https://lolly.tools/t/design?z=1a#x');
  assert.equal(run('www.lolly.art'), 'https://lolly.tools/');
  assert.equal(run('www.lolly.to', { hash: '#/profile' }), 'https://lolly.tools/#/profile');
  assert.equal(run('www.lolly.tools'), 'https://lolly.tools/');
});

test('the canonical host, previews and local hosts are never touched', () => {
  assert.equal(run('lolly.tools'), null);
  assert.equal(run('lolly-git-main.vercel.app'), null);
  assert.equal(run('localhost'), null);
  assert.equal(run('lolly.example'), null, 'an unknown lolly.* host is not a parked alias');
});

test('the guard moves exactly the hosts vercel.json redirects, and neither includes lolly.ing', () => {
  const family = hosted.redirects.find((r) => r.destination === 'https://lolly.tools/:path*' && r.has?.some((h) => h.value.startsWith('.*lolly')));
  assert.ok(family, 'vercel.json keeps a domain-family redirect');
  const redirected = /\(([a-z|]+)\)/.exec(family.has![0]!.value)![1]!.split('|').sort();
  const guarded = /lolly\\\.\(([a-z|]+)\)\$/.exec(guard)![1]!.split('|').filter((tld) => tld !== 'tools').sort();
  assert.deepEqual(guarded, redirected);
  assert.equal(redirected.includes('ing'), false, 'lolly.ing is its own project now');
  for (const tld of redirected) assert.equal(run(`lolly.${tld}`), 'https://lolly.tools/', `lolly.${tld}`);
});
