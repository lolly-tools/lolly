// SPDX-License-Identifier: MPL-2.0
/**
 * link-base - every production call site that opens the ceremony dialog must pass
 * an explicit `linkBase` (plan 100 section 6.1, section 11.25; the pre-stitch concerns pass,
 * 2026-08-09).
 *
 * `components/collab-ceremony.ts` is i18n-owned right now, so the trap it carries
 * cannot be fixed at its source in this pass: `buildInvite`/`buildAnswer` fall back
 * to `defaultLinkBase()` - `location.origin + location.pathname` - whenever a caller
 * omits `linkBase`. That default is exactly wrong from a tool page: production
 * serves a crawler stub at the tool view's own `/t/<id>` pathname whose inline
 * redirect does `location.replace('/#/tool/<id>' + location.search)`, which DROPS
 * the fragment - so an invite or reply link minted with no explicit `linkBase` from
 * that context would silently point the other device at something else, with
 * nothing on screen to explain why (`collab/join-route.ts`'s `appLinkBase()` spells
 * the same trap out, and is the fix both shipping callers already apply).
 *
 * Both shipping callers - `collab/join-route.ts`'s `mountJoinRoute` (via
 * `deps.linkBase ?? appLinkBase()`) and `collab/private-opener.ts`'s
 * `openPrivateCollab` (via `deps.linkBase ?? wiring?.appLinkBase()`) - already pass
 * `linkBase` today. This test is not about them; it is about the NEXT caller, who
 * will not have read this comment and will not know the component's own default is
 * a trap rather than a convenience. Since the component itself is off-limits (and
 * even a fix there would only change the DEFAULT, not force a future caller to
 * think about it), this scans the other direction: every production `.ts` file
 * that reaches `openCollabCeremony` - by direct import, or through a dynamic
 * `import()`'s namespace object the way `private-opener.ts` does - must ALSO write
 * `linkBase:` somewhere in that same file. No allowlist: a new caller that omits it
 * fails this test in CI, rather than shipping a link that quietly opens the wrong
 * page for a stranger who has no way to know it happened.
 *
 * SCOPE, STATED HONESTLY. This is a per-FILE scan, not a per-call-site one - it
 * cannot see whether the `linkBase:` a file contains is the one actually reaching
 * the SAME call that opens the ceremony (a file could, in principle, declare a
 * `linkBase?` field it never forwards). That is the trade a grep-based guard makes
 * everywhere else in this codebase (see `primitive-guards.test.ts`'s own note on
 * ratchets over content rules): a false negative here is a file that half-wires the
 * option, which is a smaller, more visible bug than the one this guard exists to
 * catch - a caller that never thought about `linkBase` at all.
 *
 * `*.test.ts` files are excluded on purpose: several of
 * `components/collab-ceremony.test.ts`'s own cases open the dialog with NO
 * `linkBase`, deliberately, to exercise `defaultLinkBase()` itself - that is a unit
 * test of the fallback, not a production caller inheriting it by accident. Comments
 * are stripped before matching, so `collab/qr-skin.ts`'s doc-comment usage example
 * (which demonstrates `scan`/`onClose` wiring, not the link plumbing, and omits
 * `linkBase` because it is not that example's point) does not trip this - the
 * identifier appears only inside a `/** … *\/` block, which the strip removes
 * before the scan ever runs.
 *
 * Run directly:  node --test shells/web/src/collab/link-base.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// this file lives at src/collab/ - SRC_DIR is src/
const SRC_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'vendor') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Comments stripped (block + line), the same discipline as
 *  `views/tool-collab-mount.test.ts` / `views/tool-template-mount.test.ts` - a line
 *  comment is cut at a `//` that is not part of a `://` scheme, and a block comment
 *  is dropped wholesale so a doc-comment usage example can never masquerade as a
 *  real call site. */
function stripComments(src: string): string {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlocks
    .split('\n')
    .map((line) => {
      const at = line.search(/(^|[^:])\/\//);
      return at === -1 ? line : line.slice(0, at === 0 ? 0 : at + 1);
    })
    .join('\n');
}

interface SrcFile { rel: string; code: string }

const FILES: SrcFile[] = walk(SRC_DIR).map((p): SrcFile => ({
  rel: relative(SRC_DIR, p).split(sep).join('/'),
  code: stripComments(readFileSync(p, 'utf8')),
}));

test('sanity: the scan actually found the tree (a broken walk must not vacuously pass)', () => {
  assert.ok(FILES.length > 100, `only ${FILES.length} .ts files found under ${SRC_DIR} - the walk is broken`);
});

const OPEN_CEREMONY = /\bopenCollabCeremony\b/;
const LINK_BASE = /\blinkBase\s*:/;

/**
 * Production files that reach the ceremony opener. `components/collab-ceremony.ts`
 * is excluded by name - it is the DEFINITION (`export function openCollabCeremony`),
 * not a caller of it - and every `*.test.ts` is excluded per the header.
 */
const CALL_SITES = FILES.filter(
  (f) => f.rel !== 'components/collab-ceremony.ts' && !f.rel.endsWith('.test.ts') && OPEN_CEREMONY.test(f.code),
);

test('sanity: the known shipping call sites are still in the scan', () => {
  // A floor against the scan silently finding nothing to check - either of these
  // going missing means the wiring moved and this guard needs updating with it,
  // not that there is nothing left to guard.
  const rels = CALL_SITES.map((f) => f.rel);
  assert.ok(
    rels.includes('collab/join-route.ts'),
    'collab/join-route.ts no longer reaches openCollabCeremony - has the ceremony wiring moved?',
  );
  assert.ok(
    rels.includes('collab/private-opener.ts'),
    'collab/private-opener.ts no longer reaches openCollabCeremony - has the ceremony wiring moved?',
  );
});

test('every production call site that opens the ceremony passes an explicit linkBase', () => {
  const missing = CALL_SITES.filter((f) => !LINK_BASE.test(f.code)).map((f) => f.rel);
  assert.deepEqual(
    missing,
    [],
    `${missing.join(', ')} reaches openCollabCeremony but never writes "linkBase:" anywhere in the file. ` +
    'Omitting it falls back to components/collab-ceremony.ts\'s defaultLinkBase() ' +
    '(location.origin + location.pathname), which silently opens the wrong page when the caller ' +
    "runs from a tool view's /t/<id> crawler-stub pathname (see this file's header). Pass linkBase " +
    'explicitly - e.g. `deps.linkBase ?? appLinkBase()` (collab/join-route.ts\'s own pattern).',
  );
});
