// SPDX-License-Identifier: MPL-2.0
/**
 * Privacy claims, enforced as tests.
 *
 * docs/privacy.md makes several claims that are properties of the SOURCE, not of
 * a promise — "no analytics or trackers anywhere in the codebase", "grep -ri
 * cloudflare returns nothing", "the certificate service retains nothing". Those
 * are exactly the claims a reader can check for themselves, which makes them
 * exactly the claims that must not quietly rot when someone adds a dependency or
 * a debug log six months from now.
 *
 * So they live here. If one of these fails, either the change is wrong or the
 * privacy policy needs editing — never silence the test without doing one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

// Source we actually ship or run. Excludes generated bundles' inputs? No —
// api/ is INCLUDED deliberately: it's the code that really runs on the server,
// and a stale bundle is precisely the drift worth catching. Also deliberately
// included, because docs/verify-yourself.md tells readers this test covers
// "the code that ships": the chrome extension (no src/ dir — code sits at the
// top level), the Tauri bridge overrides, the web service worker (a lone file
// outside src/), and the tool packs (hooks.js/template.html ship to clients as
// executable tool data; community/*/lib vendored bundles are skipped via
// SKIP_DIR, and brands/suse may be unmounted on public clones — walk() just
// skips a missing dir). docs/ itself is NOT scanned: verify-yourself.md names
// the banned hostnames on purpose.
const SCAN_DIRS = [
  'engine/src', 'shells/web/src', 'shells/cli/src', 'shells/tui/src',
  'shells/chrome-extension', 'shells/tauri-desktop/bridge-overrides',
  // tauri-shared holds the state logic BOTH Tauri shells ship (state-fs.ts). It
  // is listed explicitly because this array is literal, not a `shells/*` glob —
  // the exact hand-add its own header warns about, and which was missed when it
  // was extracted (found 2026-07-30).
  'shells/tauri-mobile/bridge-overrides', 'shells/tauri-shared/bridge-overrides',
  'shells/web/public/sw.js',
  'services', 'packages', 'api', 'scripts',
  'community', 'brands/lolly-start/tools', 'brands/suse/tools',
];
const SCAN_EXT = new Set(['.ts', '.js', '.mjs', '.html']);
const SKIP_DIR = new Set(['node_modules', 'dist', '.git', 'lib', 'vendor']);

function* walk(dir: string): Generator<string> {
  // A SCAN_DIRS entry may be a single file (the service worker) — yield it as-is.
  try { if (statSync(dir).isFile()) { yield dir; return; } } catch { return; }
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    let s: ReturnType<typeof statSync>;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) yield* walk(full);
    else if (SCAN_EXT.has(extname(name))) yield full;
  }
}

function* sourceFiles(): Generator<{ path: string; rel: string; text: string }> {
  for (const dir of SCAN_DIRS) {
    for (const path of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, path);
      // This test file names the very strings it bans.
      if (rel.endsWith('no-trackers.test.ts')) continue;
      yield { path, rel, text: readFileSync(path, 'utf8') };
    }
  }
}

// Hosts/SDKs that would make the "no analytics or trackers" claim false. Matched
// against source text, not just imports, so a hand-rolled beacon is caught too.
const TRACKERS = [
  'google-analytics.com', 'googletagmanager.com', 'gtag(', 'ga(',
  '@vercel/analytics', '@vercel/speed-insights',
  'plausible.io', 'posthog', 'mixpanel', 'amplitude.com', 'segment.io', 'segment.com',
  'hotjar', 'fullstory', 'sentry.io', '@sentry/', 'fathom', 'umami',
  'facebook.net', 'doubleclick.net', 'clarity.ms',
];

test('no analytics or tracking SDK appears anywhere in shipped source', () => {
  const hits: string[] = [];
  for (const { rel, text } of sourceFiles()) {
    for (const needle of TRACKERS) {
      if (text.includes(needle)) hits.push(`${rel}: ${needle}`);
    }
  }
  assert.deepEqual(hits, [], `docs/privacy.md claims there are no trackers in the codebase:\n${hits.join('\n')}`);
});

test('no third-party DNS-over-HTTPS resolver is contacted', () => {
  // The web shell must never resolve DNS through someone else's server: that
  // hands the resolver operator the queried domain plus the user's IP. Node
  // shells resolve natively, which is why this bans the HTTPS resolvers only.
  const hits: string[] = [];
  const RESOLVERS = ['cloudflare-dns.com', 'dns.google', 'dns.quad9.net', 'doh.opendns.com', '/dns-query'];
  for (const { rel, text } of sourceFiles()) {
    for (const needle of RESOLVERS) {
      if (text.includes(needle)) hits.push(`${rel}: ${needle}`);
    }
  }
  assert.deepEqual(hits, [], `docs/privacy.md claims no DoH resolver is used:\n${hits.join('\n')}`);
});

test('the certificate service logs no personal data', () => {
  // Both the source and the GENERATED Vercel bundle — a rebuilt-but-unstaged
  // bundle is exactly how this claim would silently become false in production.
  for (const rel of ['services/ca/lib/enroll.mjs', 'services/ca/handler.mjs', 'api/ca/[...path].js']) {
    const text = readFileSync(join(ROOT, rel), 'utf8');
    assert.ok(!text.includes('logIssuance'), `${rel}: the issuance log is back — see docs/privacy.md`);
    assert.ok(!text.includes('CA_LOG_WEBHOOK'), `${rel}: the issuance webhook is back — see docs/privacy.md`);
  }
});

test('privacy policy states a controller, a legal basis and a right to complain', () => {
  // Art. 13 minimums, as a spelling test. Cheap, and it catches a well-meaning
  // copy edit that deletes a legally required sentence.
  // Collapse whitespace first: the prose is hard-wrapped, so a required phrase
  // can legitimately straddle a newline.
  const md = readFileSync(join(ROOT, 'docs/privacy.md'), 'utf8').replace(/\s+/g, ' ');
  for (const required of ['SUSE Software Solutions Germany GmbH', 'privacy@suse.com', 'Art. 6(1)(f)', 'supervisory authority', 'Standard Contractual Clauses']) {
    assert.ok(md.includes(required), `docs/privacy.md no longer mentions "${required}"`);
  }
});
