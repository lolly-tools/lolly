// SPDX-License-Identifier: MPL-2.0
/**
 * INERTNESS: mounting a tool must cost a single-player user nothing to be a collab
 * (plan 100 section 4.6, section 5, section 11.14).
 *
 * `views/tool.ts` now contains one block that can build an entire presence stack - a
 * session, an op wrapper, an overlay layer, two frame-driven components, a stage pill
 * and a document-level listener set. Nothing in this repo registers a session source,
 * so that block is dead code, and the whole value of this task rests on it STAYING
 * dead in a way you can check rather than a way you can assert in prose.
 *
 * WHY A SOURCE SCAN. mountTool cannot be imported outside Vite - it imports
 * stylesheets and reaches `tool-inputs.ts`, whose sibling imports use the `.js`
 * specifier convention Node cannot resolve (the reason `views/block-row-id.test.ts`
 * and `views/multi-edit-crash-guard.test.ts` scan rather than mount). So the proof is
 * split three ways, and this file owns only the third:
 *
 *   - `lib/collab-session-source.test.ts` drives the real registry: dormant by
 *     default, allocation-free while dormant, and unable to fail a mount.
 *   - `views/tool-collab.test.ts` mounts the real composition against jsdom and
 *     proves it stays out of the render surface and tears down to nothing.
 *   - THIS FILE proves the wiring in between: that the composition is reached only
 *     through the guard and only through a lazy `import()`, that the single-player
 *     paint path, resize path and teardown carry nothing but optional calls on
 *     holders that stay null, and that a navigation mid-import cannot leak a live
 *     transport.
 *
 * Run directly:  node --test shells/web/src/views/tool-collab-mount.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// tool.ts is an orchestrator plus feature modules under tool/ (2026-09-09 split)
const TOOL_TS = [readFileSync(join(HERE, 'tool.ts'), 'utf8'), ...readdirSync(join(HERE, 'tool')).filter((n) => n.endsWith('.ts') && n !== 'context.ts').sort().map((n) => readFileSync(join(HERE, 'tool', n), 'utf8'))].join('\n');

/**
 * Source with comments removed, so "is this reached outside the guard?" cannot be
 * answered by prose about it. Line comments are cut at a `//` that is not part of a
 * `://` scheme; block comments are dropped wholesale.
 */
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

/** The `{ … }` body that follows `head`, extracted by brace matching. */
function bodyAfter(src: string, head: string): string {
  const at = src.indexOf(head);
  assert.notEqual(at, -1, `expected to find \`${head}\` in tool.ts`);
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  assert.fail(`unbalanced braces while extracting \`${head}\``);
}

// context.ts only declares the shape; the alias and publish lines are the split's plumbing, not code
const PLUMBING = /^\s*const \{[^}]*\} = tview;\s*$|\btview\.(\w+) = \1(?: as [^;]+)?;/gm;
const CODE = stripComments(TOOL_TS).replace(PLUMBING, '');
const BLOCK = bodyAfter(CODE, 'if (collabHandle) {');
const OUTSIDE = CODE.replace(BLOCK, '\n/* block removed */\n');
/** Everything outside the guard that is not an import statement. */
const SINGLE_PLAYER = OUTSIDE.split('\n').filter(l => !/^\s*import\b/.test(l)).join('\n');

test('the presence stack is acquired exactly once, and that is the only entry point', () => {
  assert.equal([...CODE.matchAll(/acquireCollabSession\(/g)].length, 1,
    'one acquisition per mount - a second would be a second session');
  assert.match(
    CODE,
    /const collabHandle = acquireCollabSession\((?:tview\.)?tool\.manifest\.id, (?:tview\.)?slot \?\? null\);/,
    'asked with the tool + the resumed slot, which is what pins a private collab to a session',
  );
  // Positional args, not a context literal: the dormant path must allocate nothing.
  assert.equal(/acquireCollabSession\(\s*\{/.test(CODE), false,
    'a context OBJECT at the call site would be a per-mount allocation charged to every '
    + 'single-player user for a value nobody reads (section 11.14)');
});

test('the presence chunk is reached ONLY by a lazy import, inside the guard', () => {
  assert.match(BLOCK, /await import\('\.\.?\/tool-collab\.ts'\)/,
    'a static import would ride the tool chunk into every single-player mount - '
    + 'collab-pill.ts\'s own rule is that a collab costs a single-player build nothing');
  assert.equal(/^\s*import \{[^}]*\} from '\.\.?\/tool-collab\.ts';/m.test(CODE), false,
    'no VALUE import of the composition at the top of the file');
  assert.match(TOOL_TS, /import type \{ ToolCollab \} from '\.\.?\/tool-collab\.ts';/,
    'the type import is erased at build, so it costs nothing');
  // `import type` is erased at build, so it is not part of the emitted code.
  const emitted = CODE.split('\n').filter(l => !/^\s*import type\b/.test(l)).join('\n');
  assert.equal([...emitted.matchAll(/tool-collab\.ts/g)].length, 1,
    'one reference in the emitted code: the dynamic import itself');
});

test('nothing but the seam is statically imported from the collab stack', () => {
  // the feature modules import the same seams one directory deeper; compare the paths as the view sees them, once
  const statics = [...new Set([...TOOL_TS.matchAll(/^import (?!type )[^;]*?from '([^']*collab[^']*)';/gm)].map(m => (m[1] ?? '').replace(/^\.\.\/\.\.\//, '../').replace(/^\.\.\/(?=[\w-]+\.ts$)/, './')))];
  assert.deepEqual(
    statics,
    [
      '../lib/collab-plumbing.ts',
      '../lib/collab-session-source.ts',
      // Added 2026-08-09 with the three one-shot hand-offs a live collab arms before this
      // view is entered: the ephemeral `host.state` (section 11.17), and the model + slot carried
      // across the inviter's forced remount (section 6.2a). The rule this list enforces is "a
      // collab costs a single-player build nothing", and this import costs it nothing:
      // `main.ts` already imports the SAME module on the boot path for
      // `installLiveCollabMount()`, so it is in the entry chunk with or without this line
      // - and it pulls in nothing but `collab-mount.ts` + the registry, no pill, no
      // session, no presence engine. What the rule is actually protecting is the
      // composition (`./tool-collab.ts`), and the two tests around this one still pin
      // that to a single dynamic import.
      '../lib/collab-live-mount.ts',
      // The 2026-09-08 memory-only P2P history capture (plan 221 section 9) no longer reaches
      // this view statically: the app-history mount takes `collab: collabHandle?.history` and
      // wires the capture itself, so the two collab-history modules left this list on 2026-09-09.
    ],
    'the op plumbing (already there), the registry, and the mount hand-offs (already on '
    + 'the boot path) - the pill, rings, cursors and session must stay behind the '
    + 'dynamic import',
  );
});

test('the ONLY collab identifiers reaching single-player code are the two null holders', () => {
  const mentions = [...SINGLE_PLAYER.matchAll(/\bcollab[A-Za-z]*\b/g)].map(m => m[0]);
  // `collabHistory` is `collabHandle?.history` - a null-safe read that is null in single-player
  // (the capture around it is behind the runtime collabHandle guard); plan 221 section 9.
  // `collaborating` is the boolean the app-history mount takes (`!!collabHandle || !!ephemeralState`)
  // - two null-checks in single-player, no collab module behind it.
  const allowed = new Set(['collabReanchor', 'collabTeardown', 'collabHandle', 'collab', 'collabHistory', 'collaborating']);
  assert.deepEqual([...new Set(mentions)].filter(n => !allowed.has(n)), [],
    'a new collab-aware statement outside the guard is a cost every single-player mount pays');
  assert.match(CODE, /(?:let collabReanchor: \(\(\) => void\) \| null = null;|tview\.collabReanchor = null;)/);
  assert.match(CODE, /(?:let collabTeardown: \(\(\) => void\) \| null = null;|tview\.collabTeardown = null;)/);
});

test('both re-anchor hooks are optional calls on a holder that stays null', () => {
  assert.match(
    CODE,
    // `refitStage` is the re-fit entry point since plan 179 C5 (at Fit it runs the full
    // fit - canvas, then the artboard union; a user-zoomed view is left alone). What is
    // pinned here is unchanged: ONE observer, the re-fit first, the re-anchor after it.
    /const ro = new ResizeObserver\(\(\) => \{\s*(?:tview\.\w+\.)?refitStage\((?:tview)?\);\s*(?:tview\.)?collabReanchor\?\.\(\);\s*\}\);/,
    'the stage ResizeObserver re-anchors the overlay after the canvas re-fits',
  );
  // The rAF paint: the canvas rebuild moves every rect the rings are anchored from.
  const paintAt = CODE.indexOf('function paint(tview: ToolViewCtx): void {');
  assert.notEqual(paintAt, -1);
  const paintBody = CODE.slice(paintAt, CODE.indexOf('function flushRender', paintAt));
  assert.match(paintBody, /collabReanchor\?\.\(\);/, 'the rAF paint re-anchors');

  const optional = [...CODE.matchAll(/collabReanchor\?\.\(\)/g)].length;
  assert.equal(optional, 2, 'exactly two hooks: the paint and the stage resize');
  assert.equal(/collabReanchor\(\)/.test(CODE), false,
    'never called unguarded - the holder is null on every single-player mount');
});

test('teardown runs from _cleanup, before the op plumbing detaches', () => {
  const cleanup = bodyAfter(CODE.slice(CODE.lastIndexOf('viewEl._cleanup = () => {')), 'viewEl._cleanup = () => {');
  assert.match(cleanup, /collabTeardown\?\.\(\);\s*(?:tview\.)?collabTeardown = null;/,
    'a navigation away mid-collab must leave zero timers, listeners and frames behind');
  assert.ok(
    cleanup.indexOf('collabTeardown') < cleanup.indexOf('collab?.detach()'),
    'chrome comes down before the transport, so presence can still send its leave frame',
  );
});

test('a navigation DURING the import cannot leak a live transport', () => {
  // The teardown holder is armed before the await; the composition that lands after
  // an abort is torn straight back down instead of taking over a dead view.
  assert.ok(
    BLOCK.search(/(?:tview\.)?collabTeardown = \(\) => \{/) < BLOCK.indexOf('await import('),
    'the teardown holder is armed BEFORE the first await - otherwise _cleanup finds '
    + 'nothing to call and the presence heartbeat runs on in a detached tree',
  );
  assert.match(BLOCK, /aborted = true;/);
  assert.match(BLOCK, /if \(aborted\) built\.teardown\(\);/,
    'and what lands after the abort is disposed on arrival');
  assert.match(BLOCK, /else \{\s*mounted = built;\s*(?:tview\.)?collabReanchor = \(\) => built\.reanchor\(\);\s*\}/);
});

test('a presence stack that fails to load costs the collab, never the tool', () => {
  assert.match(BLOCK, /catch \(e\) \{/);
  assert.match(BLOCK, /console\.warn\('\[lolly:collab\] presence failed to mount', e\);/);
  assert.match(BLOCK, /try \{\s*collabHandle\.close\(\);\s*\}/,
    'the transport is closed rather than left dangling');
  assert.match(BLOCK, /(?:tview\.)?collabTeardown = null;/,
    'and the holder is cleared so _cleanup does not call a half-built teardown');
});

test('one transport per mount: the session takes over the op plumbing', () => {
  assert.match(BLOCK, /collab\?\.detach\(\);/,
    'the bare plumbing detaches - two attachments over one adapter would emit every edit twice');
  assert.ok(
    BLOCK.indexOf('collab?.detach()') < BLOCK.indexOf('await import('),
    'and it detaches BEFORE the session attaches its own',
  );
});

test('the composition is handed the stage to mount in and the canvas to measure', () => {
  assert.match(BLOCK, /stage: stageEl,/,
    'the pill and the overlay layer live on the stage, siblings of the render surface');
  assert.match(BLOCK, /canvas: (?:tview\.)?contentEl,/, 'the render surface is passed to be READ');
  assert.match(BLOCK, /sidebar: (?:tview\.)?inputsEl,/,
    'one delegated focusin/focusout pair on #tool-inputs is what makes focus the default '
    + 'presence primitive on every tool (section 4.1)');
  assert.match(BLOCK, /runtime(?:: tview\.runtime)?,/);
  assert.match(BLOCK, /toolManifest: (?:tview\.)?tool\.manifest,/);
  assert.match(BLOCK, /^\s*host(?:: tview\.host)?,$/m, 'the mount packs an outgoing beam from THIS mount\'s host');
  assert.match(BLOCK, /^\s*libraryHost(?:: tview\.libraryHost)?,$/m,
    'and lands a received one in the un-swapped library (section 6.4) - without this an acceptor '
    + 'kept the assets and lost the session they belong to, while the toast said both landed');
  assert.match(BLOCK, /exportSettings: \(\) => (?:\{ const \{ actionsApi \} = tview; return )?(?:tview\.)?actionsApi\?\.sessionState\?\.\(\) \?\? null(?:; \})?,/,
    'the `__export_*` markers live in the export bar\'s DOM and nowhere else, so a beamed '
    + 'session without them reopens at tool defaults rather than at A3/300 DPI');
  // The two ways presence could leak into an exported file.
  for (const sink of ['contentEl.appendChild', 'canvasEl.appendChild', 'contentEl.innerHTML', 'contentEl.classList']) {
    assert.equal(BLOCK.includes(sink), false,
      `the presence block must never write into the render surface (${sink})`);
  }
});

test('the library host is captured BEFORE the acceptor swap, and used by nothing else', () => {
  // The ordering IS the property: `views/tool.ts` replaces `host.state` with a memory
  // bridge for an acceptor (section 11.17), so a reference taken after that line is the
  // ephemeral store wearing the library's name - and a beam the human accepted would
  // land in a store that dies with the mount.
  const capture = CODE.search(/const libraryHost = (?:tview\.)?host;/);
  const swap = CODE.search(/if \((?:tview\.)?ephemeralState\) (?:tview\.)?host = \{ \.\.\.(?:tview\.)?host, state: (?:tview\.)?ephemeralState \};/);
  assert.notEqual(capture, -1, 'the pre-swap bridge is still captured');
  assert.notEqual(swap, -1, 'the ephemeral swap is still the one interception point');
  assert.ok(capture < swap, 'captured before the swap, or it is not the library at all');

  // Exactly three mentions: the capture, the hand-off to the composition, and the
  // app-history mount's `copyState: libraryHost.state` (2026-09-09) - a READ of the library
  // store so a copy of a library creation can be taken while `host` points at the ephemeral
  // one. Any fourth would be a save path routing around the interception the swap exists to be.
  assert.match(CODE, /copyState: libraryHost\.state\b/, 'the third mention is the history copy source, nothing else');
  assert.equal([...CODE.matchAll(/\blibraryHost\b/g)].length, 3,
    'the un-swapped bridge is for the beam\'s INGEST and nothing else - every other save '
    + 'in this view must go through `host`, which is what section 11.17 intercepts');
});
