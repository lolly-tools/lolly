// SPDX-License-Identifier: MPL-2.0
/**
 * host.net allowlist conformance - the fail-closed network invariant, across shells.
 *
 * Run with: npm test  (node --test over the tests/ globs)
 * No test framework - uses node:test built-in. No DOM, no jsdom, no real network.
 *
 * `host.net` is the ONLY way a tool reaches the network, and it is fail-closed:
 * a tool without the `network` capability (or without a `network.allowlist`
 * block) gets every fetch rejected, and a tool with one gets exactly the URLs
 * its manifest named. The awkward part is WHERE that is enforced. It is not in
 * the engine - the engine only calls `host.net.fetch` - it is in each shell's
 * bridge. Today all of them route through one module
 * (packages/node-shell/src/net.ts `createNetAPI`, which the web bridge re-exports
 * from shells/web/src/bridge/net.ts and the CLI and TUI import directly), but
 * nothing stopped a new shell from writing its own `host.net` and silently
 * omitting the check. That is the drift this file exists to catch.
 *
 * WHAT THIS PROVES
 *
 * Behaviourally, against the real shared module (no mock of the thing under
 * test), with `globalThis.fetch` swapped for a counting fake:
 *   1. no network capability / no allowlist  → every fetch rejects, and the
 *      underlying fetch is never called (deny happens before any I/O),
 *   2. `allowlist: []` - the exact fail-closed boot default the web shell wires
 *      in bridge/index.ts - → same,
 *   3. an allowlist that no entry matches → rejects, including the lookalike-host
 *      case the `/*` boundary rule exists for (api.example.com.evil.io),
 *   4. a matching URL DOES pass through (so 1-3 are not vacuous),
 *   5. tool code cannot widen the allowlist at runtime: the NetAPI handed to a
 *      tool exposes `fetch` and nothing else - no allowlist property, no setter,
 *      nothing on its prototype chain - and the per-mount scoped clone pattern
 *      (`{ ...host, net: createNetAPI({ allowlist }) }`, used by views/tool.ts,
 *      views/multi-edit.ts, pro/render-export.ts and tui/engine-render.ts)
 *      leaves the shared host's denying net untouched.
 *
 * Structurally, over the source (because the invariant is cross-shell and most
 * shell bridges cannot be imported here - the web bridge is DOM-bound and the
 * CLI/TUI bridges need a jsdom window on globalThis before they will build):
 *   6. every `host.net = …` / `net:` assignment anywhere under shells/ is
 *      `createNetAPI(…)`, i.e. no shell hand-rolls a network API,
 *   7. `createNetAPI` is defined in exactly one place, searching packages/ as well
 *      as shells/ (the module lives in the shared node-shell package now),
 *   8. the set of shells is pinned. A NEW shells/<name>/ directory fails this
 *      test with instructions, rather than shipping an unchecked host.net,
 *   9. the Tauri bridge overrides carry no net override (they inherit the web
 *      bridge's), and
 *  10. schemas/tool.schema.json still makes `network.allowlist` required with
 *      minItems 1 - a tool cannot declare an empty allowlist and have it read as
 *      "anything".
 *
 * WHAT THIS DOES NOT PROVE
 *
 * It does not exercise the web/CLI/TUI bridges end-to-end: assertions 6-9 are a
 * lexical source scan, so a shell that imported `createNetAPI` and then never
 * called it, or that handed tools some other fetch-shaped object under a
 * different property name, would pass. It says nothing about the 64 MB
 * response cap (that is `capResponse`, tested by its own callers) and nothing
 * about the ENGINE's behaviour when a shell omits `host.net` entirely. And the
 * allowlist array is held by reference inside `createNetAPI`, so a SHELL that
 * kept a mutable array could widen its own allowlist later - assertion 5 covers
 * the reachability that matters (tool code never receives that array), not
 * immutability of the array itself.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// The shared module's real home. shells/web/src/bridge/net.ts is a re-export of
// this, kept so the web shell's import sites did not have to change.
import { createNetAPI } from '../packages/node-shell/src/net.ts';

const ROOT = join(import.meta.dirname, '..');

// ─── behaviour: the shared allowlist checker ─────────────────────────────────

/**
 * Swap globalThis.fetch for a counting fake and run `body`. Nothing here may
 * touch the real network: a denied URL must never reach fetch at all, and an
 * allowed one must reach only the fake.
 */
async function withFakeFetch(
  body: (calls: () => number) => Promise<void>,
): Promise<void> {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (): Promise<Response> => {
    calls++;
    return new Response('ok', { status: 200 });
  };
  try {
    await body(() => calls);
  } finally {
    globalThis.fetch = saved;
  }
}

const DENIED = /disallowed URL/;

test('no network capability: every host.net fetch rejects, fetch is never called', async () => {
  await withFakeFetch(async calls => {
    // A tool without the capability normally gets no net API at all, but the
    // shells that always attach one (web boot default, CLI without a manifest
    // allowlist) construct it with nothing allowed. Both spellings, since the
    // parameter is optional.
    for (const net of [createNetAPI({}), createNetAPI({ allowlist: [] })]) {
      await assert.rejects(() => net.fetch('https://example.com/anything'), DENIED);
      await assert.rejects(() => net.fetch('http://localhost:3000/'), DENIED);
      await assert.rejects(() => net.fetch('data:text/plain,hi'), DENIED);
    }
    assert.equal(calls(), 0, 'a denied URL must be refused before any I/O happens');
  });
});

test('an allowlist rejects every URL no entry matches', async () => {
  await withFakeFetch(async calls => {
    const net = createNetAPI({
      allowlist: ['https://api.example.com/*', 'https://exact.example.com/one.json'],
    });
    const denied = [
      'https://other.example.com/tiles/1.png',      // different host entirely
      'http://api.example.com/v1/x',                // scheme is part of the prefix
      'https://api.example.com.evil.io/v1/x',       // lookalike host — the /* boundary rule
      'https://api.example.com.evil.io/',
      'https://exact.example.com/two.json',         // exact entry allows one URL only
      'https://exact.example.com/one.json?x=1',     // ...not a query-string variant
      'https://EXACT.example.com/one.json',         // no case folding on an exact entry
    ];
    for (const url of denied) {
      await assert.rejects(() => net.fetch(url), DENIED, `${url} should be denied`);
    }
    assert.equal(calls(), 0, 'no denied URL may reach fetch');
  });
});

test('a wildcard entry with no trailing slash is still anchored at the host boundary', async () => {
  // The manifest schema requires the "/*" form, but the CLI and the TUI accept
  // a hand-fed allowlist, so an entry like "https://api.example.com*" reaches
  // the matcher. It must be read as "https://api.example.com/*", never as a
  // bare string prefix that a lookalike host satisfies.
  await withFakeFetch(async calls => {
    const net = createNetAPI({ allowlist: ['https://api.example.com*'] });
    for (const url of [
      'https://api.example.com.evil.io/v1/x',
      'https://api.example.com.evil.io/',
      'https://api.example.com-evil.io/x',
    ]) {
      await assert.rejects(() => net.fetch(url), DENIED, `${url} should be denied`);
    }
    assert.equal(calls(), 0, 'no lookalike host may reach fetch');
    // The intended host still passes, so the denials above are not vacuous.
    assert.equal((await net.fetch('https://api.example.com/v1/x')).status, 200);
    assert.equal(calls(), 1);
  });
});

test('a URL the allowlist matches does pass through (the deny tests are not vacuous)', async () => {
  await withFakeFetch(async calls => {
    const net = createNetAPI({ allowlist: ['https://api.example.com/*', 'https://exact.example.com/one.json'] });
    const wild = await net.fetch('https://api.example.com/v1/tiles/1.png');
    assert.equal(wild.status, 200);
    const exact = await net.fetch('https://exact.example.com/one.json');
    assert.equal(exact.status, 200);
    assert.equal(calls(), 2, 'both allowed URLs should have reached fetch exactly once');
  });
});

test('tool code cannot widen the allowlist through the NetAPI it is handed', async () => {
  const allowlist = ['https://api.example.com/*'];
  const net = createNetAPI({ allowlist });

  // The object a tool receives carries the method and nothing else - no
  // allowlist, no config, nothing to push onto or reassign.
  assert.deepEqual(Object.keys(net), ['fetch']);
  assert.deepEqual(Object.getOwnPropertyNames(net), ['fetch']);
  assert.equal(Object.getPrototypeOf(net), Object.prototype,
    'the NetAPI should be a plain object — no class carrying accessors');
  const exposed = JSON.stringify(net);
  assert.equal(exposed, '{}', `the NetAPI must not serialise any config: ${exposed}`);

  await withFakeFetch(async calls => {
    // The per-mount scoped clone the shells build (views/tool.ts,
    // views/multi-edit.ts, pro/render-export.ts, tui/engine-render.ts) must not
    // leak back into the shared, denying host.
    const sharedHost = { net: createNetAPI({ allowlist: [] }) };
    const scoped = { ...sharedHost, net: createNetAPI({ allowlist: ['https://api.example.com/*'] }) };
    assert.equal((await scoped.net.fetch('https://api.example.com/x')).status, 200);
    await assert.rejects(() => sharedHost.net.fetch('https://api.example.com/x'), DENIED,
      'a scoped per-mount net must not widen the shared host default');
    assert.equal(calls(), 1);
  });
});

// ─── structure: no shell may hand-roll host.net ──────────────────────────────

const NET_MODULE = 'packages/node-shell/src/net.ts';
/** The web shell's stable re-export of NET_MODULE - not a second implementation. */
const NET_REEXPORT = 'shells/web/src/bridge/net.ts';

/**
 * The shells that exist today. This list is the tripwire: a new shell shows up
 * here as a failure naming what has to happen, instead of quietly shipping a
 * host.net that nobody checked.
 */
// tauri-shared is not a shell: it's the parent-repo composition point both Tauri
// shells' bridge-overrides call into (state-fs only today). It defines no
// host.net - the definer/hand-rolled scans below cover it like everything else.
const KNOWN_SHELLS = ['chrome-extension', 'cli', 'tauri-desktop', 'tauri-mobile', 'tauri-shared', 'tui', 'web'];

const SKIP_DIR = new Set(['node_modules', 'dist', 'target', '.git', 'gen', 'lib', 'vendor']);
const SCAN_EXT = ['.ts', '.tsx', '.js', '.mjs'];

function* walk(dir: string): Generator<string> {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.') || SKIP_DIR.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (SCAN_EXT.some(x => e.name.endsWith(x))) yield p;
  }
}

test('the set of shells is pinned (a new shell must wire host.net deliberately)', () => {
  const found = readdirSync(join(ROOT, 'shells'), { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort();
  assert.deepEqual(found, KNOWN_SHELLS,
    'shells/ changed. A new shell must route host.net through ' + NET_MODULE
    + " (the CLI's `import { createNetAPI } from '../../../packages/node-shell/src/net.ts'` is the pattern),"
    + ' then be added to KNOWN_SHELLS here.');
});

test('createNetAPI is defined in exactly one module', () => {
  const definers: string[] = [];
  // packages/ as well as shells/: the implementation moved into the shared
  // node-shell package, so a scan of shells/ alone would now find nothing and
  // pass for the wrong reason.
  for (const file of [...walk(join(ROOT, 'shells')), ...walk(join(ROOT, 'packages'))]) {
    const src = readFileSync(file, 'utf8');
    if (/(?:export\s+)?function\s+createNetAPI\b/.test(src)) definers.push(relative(ROOT, file));
  }
  assert.deepEqual(definers, [NET_MODULE],
    'the allowlist checker must have exactly one implementation — two copies drift');
});

/** Assignments of the net API: `host.net = X` or `net: X` in a host literal/clone. */
const NET_ASSIGN = /(?:^|[^\w.])(?:host\.net|net)\s*[:=]\s*([^;,\n]+)/g;

/**
 * Is this right-hand side a net API built by the shared checker? Legal shapes:
 * a direct `createNetAPI(...)` call, the web shell's lazy facade (an object whose
 * fetch delegates to a memoised `createNetAPI` behind a dynamic import), or a
 * bare TYPE annotation in an interface.
 */
function routesThroughSharedChecker(rhs: string, fileCode: string): boolean {
  if (rhs.startsWith('createNetAPI(')) return true;
  if (/^(?:NetAPI|WebHost\[)/.test(rhs)) return true;
  return rhs.startsWith('{')
    && /\(await loadNet\(\)\)\.fetch\(/.test(fileCode)
    && /createNetAPI\(/.test(fileCode);
}

/** Line + block comments removed, so prose about `host.net` is never scanned. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('the shell scan actually rejects a hand-rolled net (not vacuous)', () => {
  const handRolled = "host.net = { fetch: (u: string) => fetch(u) };";
  const code = stripComments(handRolled);
  NET_ASSIGN.lastIndex = 0;
  const m = NET_ASSIGN.exec(code);
  assert.ok(m, 'the assignment matcher should see a plain host.net assignment');
  assert.equal(routesThroughSharedChecker(m![1]!.trim(), code), false,
    'an object literal with its own fetch must NOT be accepted as allowlisted');
  // ...while the real shapes in the tree are accepted.
  assert.equal(routesThroughSharedChecker('createNetAPI({ allowlist })', ''), true);
});

test('every host.net assignment in every shell goes through createNetAPI', () => {
  const offenders: string[] = [];
  const sites: string[] = [];
  for (const file of walk(join(ROOT, 'shells'))) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (rel === NET_MODULE || rel === NET_REEXPORT) continue;
    const code = stripComments(readFileSync(file, 'utf8'));
    NET_ASSIGN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = NET_ASSIGN.exec(code)) !== null) {
      const rhs = m[1]!.trim();
      sites.push(rel);
      if (!routesThroughSharedChecker(rhs, code)) offenders.push(`${rel}: net = ${rhs.slice(0, 80)}`);
    }
  }
  // Six construction sites today: cli/src/bridge.ts, tui/src/engine-render.ts,
  // web/src/bridge/index.ts (the fail-closed boot default) and the three per-mount
  // scoped clones (web views/tool.ts, views/multi-edit.ts, pro/render-export.ts).
  assert.ok(sites.length >= 6,
    `expected at least 6 host.net construction sites, found ${sites.length} (${sites.join(', ')}) — did the scan paths move?`);
  assert.deepEqual(offenders, [],
    'a shell is building a network API without the shared allowlist checker ('
    + NET_MODULE + '). host.net must be fail-closed in EVERY shell.');
});

test('the Tauri bridge overrides carry no net override', () => {
  for (const shell of ['tauri-desktop', 'tauri-mobile']) {
    const dir = join(ROOT, 'shells', shell, 'bridge-overrides');
    let names: string[] = [];
    try { if (statSync(dir).isDirectory()) names = readdirSync(dir); } catch { continue; }
    assert.equal(names.some(n => /^net\./.test(n)), false,
      `${shell}/bridge-overrides declares its own net — Tauri must inherit the web shell's allowlisted fetch`);
  }
});

// ─── the manifest contract the allowlist is read from ────────────────────────

test('tool.schema.json keeps network.allowlist required and non-empty', () => {
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas/tool.schema.json'), 'utf8')) as {
    properties: {
      capabilities: { items: { enum: string[] } };
      network: { required: string[]; properties: { allowlist: { type: string; minItems: number } } };
    };
  };
  assert.ok(schema.properties.capabilities.items.enum.includes('network'),
    "the 'network' capability must stay declarable in a manifest");
  const net = schema.properties.network;
  assert.deepEqual(net.required, ['allowlist'],
    'a network block without an allowlist would be a capability with no bound');
  assert.equal(net.properties.allowlist.type, 'array');
  assert.equal(net.properties.allowlist.minItems, 1,
    'minItems 1 stops an empty allowlist being authored as if it meant "anything"');
});
