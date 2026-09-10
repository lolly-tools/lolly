// SPDX-License-Identifier: MPL-2.0
/**
 * THE TEMPLATE CHOOSER IS NOT IN THE MOUNT PATH.
 *
 * A tool that ships `templates/` (today: Design, four of them) used to open like
 * this: `views/tool.ts` awaited `openTemplateChooser`, and `createRuntime` - the whole
 * mount - could not begin until a human clicked a tile. In that same window the chooser
 * eagerly rendered a live preview per template, each one a real off-screen tool mount +
 * walker export. Measured on a cache-cold first open: ~1 s per template, 3972 / 3999 /
 * 4355 ms for the four, main-thread, before the editor had drawn a single pixel. Layout
 * Studio and Sequence Studio are within noise of each other at every engine phase; this
 * was the difference a user could feel.
 *
 * The fix is structural, so the guard is structural: the chooser is STARTED where it
 * always was (the modal appears just as early) but never awaited, and the pick lands
 * afterwards as an `applyPatch` seed on the already-mounted runtime. Three properties
 * have to hold together, and any one of them regressing silently restores the stall:
 *
 *   1. nothing awaits the chooser before `createRuntime`;
 *   2. the chooser is still started BEFORE it, or the modal arrives late instead;
 *   3. the pick is applied through `applyPatch`, not `setInput` - `setInput` is
 *      mountTool's undo-history wrapper (and collab's op wrapper), so seeding through it
 *      would make ⌘Z erase the template the user just chose.
 *
 * WHY A SOURCE SCAN: `mountTool` cannot be imported outside Vite - it imports
 * stylesheets and reaches `tool-inputs.ts`, whose sibling imports use the `.js` specifier
 * convention Node cannot resolve. `views/tool-collab-mount.test.ts`, `views/block-row-id
 * .test.ts` and `views/multi-edit-crash-guard.test.ts` all scan for the same reason; this
 * file follows them. The chooser's own runtime behaviour is covered by
 * `views/template-chooser.test.ts`.
 *
 * Run directly:  node --test shells/web/src/views/tool-template-mount.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Source with comments removed, so "is this awaited?" cannot be answered by prose that
 * merely says it isn't. Line comments are cut at a `//` that is not part of a `://`
 * scheme; block comments are dropped wholesale. (Same helper, same reasoning, as
 * views/tool-collab-mount.test.ts - duplicated rather than exported, so neither file's
 * guard can be weakened by an edit made for the other.)
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

// tool.ts is an orchestrator plus feature modules under tool/ (2026-09-09 split)
// context.ts only declares the shape; the alias and publish lines are the split's plumbing, not code
const PLUMBING = /^\s*const \{[^}]*\} = tview;\s*$|\btview\.(\w+) = \1(?: as [^;]+)?;/gm;
const CODE = stripComments([readFileSync(join(HERE, 'tool.ts'), 'utf8'), ...readdirSync(join(HERE, 'tool')).filter((n) => n.endsWith('.ts') && n !== 'context.ts').sort().map((n) => readFileSync(join(HERE, 'tool', n), 'utf8'))].join('\n')).replace(PLUMBING, '');
// The inspector's dock/float controller (plans/208): the column requests live here now.
const INSPECTOR_FLOAT = stripComments(readFileSync(join(HERE, 'design-inspector-float.ts'), 'utf8'));
const CHOOSER = stripComments(readFileSync(join(HERE, 'template-chooser.ts'), 'utf8'));

test('nothing awaits the template chooser - the mount is never gated on a human click', () => {
  assert.match(CODE, /openTemplateChooser\s*\(/, 'the chooser is still opened from mountTool');
  assert.ok(
    !/\bawait\s+openTemplateChooser\s*\(/.test(CODE),
    'the chooser is never awaited - anywhere, handle included. Awaiting it puts ' +
      'createRuntime behind a human click, which IS the open delay this guards',
  );
  assert.ok(
    !/\bawait\s+(?:tview\.)?templatePick\b/.test(CODE),
    'awaiting the pick promise anywhere in the mount is the same stall by another name',
  );
  assert.ok(
    !/\bawait\s*\(\s*async/.test(CODE),
    'the chooser IIFE must stay un-awaited (its lazy import + CSS chunk are on it)',
  );
});

test('the chooser is still STARTED before the mount, and only APPLIED after it', () => {
  const start = CODE.indexOf('tview.templatePick = (async');
  const create = CODE.indexOf('await createRuntime(');
  const apply = CODE.indexOf('if (tview.templatePick) {');
  assert.notEqual(start, -1, 'the chooser is started via a `templatePick = (async …)()` handle');
  assert.notEqual(create, -1, 'mountTool still awaits createRuntime');
  assert.notEqual(apply, -1, 'the pick is applied from a `if (templatePick)` block');
  assert.ok(start < create, 'the modal must open BEFORE the mount work, or it arrives late');
  assert.ok(create < apply, 'the seed can only be applied once the runtime exists');
});

test('the pick is seeded with applyPatch - no undo step, no collab echo, one render', () => {
  const block = bodyAfter(CODE, 'if (tview.templatePick) {');
  assert.match(block, /runtime\.applyPatch\(/, 'the seed goes through the engine atomic apply');
  assert.match(block, /migrateBlockRowIds\(runtime\)/,
    'rows arriving after the mount-time migration still need their stable ids');
  assert.ok(
    !/setInput/.test(block),
    'setInput is the undo-history wrapper - seeding through it makes ⌘Z erase the template',
  );
  // Precedence must match the pre-mount merge it replaced (`{...chosen, ...initialValues}`):
  // a key the URL/profile already supplied wins, so it never reaches the patch.
  assert.match(block, /!\(k in (?:tview\.)?initialValues\)/,
    'a profile/URL-supplied key must still win over the template, as it did pre-mount');
});

test('the deterministic `?template=` seed stays awaited - export remounts depend on it', () => {
  // No human in the loop there: an off-screen scene/export remount re-parses the URL and
  // must have the values in the model before the first hydrate, or it renders blank.
  // The shipped-file fetch itself moved into lib/template-ref.ts with plans/226 WP-0
  // (resolveTemplateSeed = the person's own store, then fetchTemplateSeed - which is
  // fetchTemplateValues + the ?preset= overlay merge, plans/142 - then inline metadata),
  // so what this file pins is the ONE resolver call and its position in the mount.
  assert.match(CODE, /await\s+resolveTemplateSeed\(/,
    '?template= must remain a pre-createRuntime seed, unlike the chooser');
  const named = CODE.indexOf('await resolveTemplateSeed(');
  assert.ok(named < CODE.indexOf('await createRuntime('), '…and it must resolve before the mount');
});

test('the chooser yields the main thread around every preview render', () => {
  // Each tile preview is a real off-screen mount + walker export (~1 s). With the tool now
  // mounting UNDERNEATH the modal, running them back-to-back would starve exactly the paint
  // this change exists to let through, and hold a tile click behind the whole queue.
  assert.match(CHOOSER, /function whenIdle\(/, 'the yield helper exists');
  const drain = bodyAfter(CHOOSER, 'const drain = async ()');
  assert.match(drain, /await whenIdle\(\)[\s\S]*await import\('\.\.\/lib\/featured-render\.ts'\)/,
    'yield BEFORE the render-engine chunk is even requested');
  assert.equal((drain.match(/await whenIdle\(\)/g) ?? []).length, 2,
    'exactly two yields: once before the chunk, once between renders');
});

// ── Navigate-away guard ──────────────────────────────────────────────────────
// The chooser is un-awaited and outlives nothing else in this mount, so leaving the
// tool before a tile is picked must not (a) leave the modal floating over whatever view
// loads next, or (b) let a late resolution (Escape armed by the close below, or a tile
// click already in flight) run `applyPatch`/`migrateBlockRowIds` against a runtime
// `_cleanup` already tore down. Same shape as the collab `aborted` latch pinned by
// `tool-collab-mount.test.ts`'s "a navigation DURING the import cannot leak a live
// transport" - a holder armed before the awaits it needs to survive, checked on both
// sides of the one await (`applyPatch`) a navigation can straddle.

test('a navigate-away before the pick lands cannot patch a torn-down runtime', () => {
  assert.match(CODE, /(?:let |tview\.)templatePickTornDown = false;/,
    'the latch - set once by _cleanup, read by both the open path and the pick handler');
  assert.match(CODE, /(?:let templatePickClose: \(\(\) => void\) \| null = null;|tview\.templatePickClose = null;)/,
    'the modal-close handle, armed once the chooser actually opens (onOpen, below)');

  // Opening: a navigate-away while the chunk was still loading must not open the modal
  // at all (nothing would ever call the close it would hand back); one that lands after
  // the modal exists is closed immediately instead of stored, so it can never point at a
  // reference nobody will call.
  const openCall = bodyAfter(CODE, 'tview.templatePick = (async () => {');
  assert.match(openCall, /if \((?:tview\.)?templatePickTornDown\) return \{\};/,
    'a navigate-away during the chunk load must skip opening the chooser entirely');
  assert.match(
    openCall,
    /onOpen:\s*\(close\)\s*=>\s*\{\s*if \((?:tview\.)?templatePickTornDown\) close\(\);\s*else (?:tview\.)?templatePickClose = close;\s*\}/,
    'the close handle is armed onto the holder - or fired immediately if teardown already landed',
  );

  // Applying: the SAME latch is checked before the patch (skips it outright) and again
  // after (skips the row-id re-stamp) - `applyPatch` is the one await a navigation can
  // land in the middle of.
  const pickBlock = bodyAfter(CODE, 'if (tview.templatePick) {');
  const applyAt = pickBlock.indexOf('runtime.applyPatch(');
  assert.notEqual(applyAt, -1);
  assert.match(pickBlock.slice(0, applyAt), /if \((?:tview\.)?templatePickTornDown\) return;/,
    'must not seed a patch onto a runtime this mount already tore down');
  assert.match(pickBlock.slice(applyAt), /if \((?:tview\.)?templatePickTornDown\) return;/,
    'must not re-stamp row ids if a navigation landed while applyPatch was in flight');

  // Tearing down: _cleanup is what makes the latch true and takes the modal, which lives
  // outside viewEl's own subtree (template-chooser.ts appends to document.body), down
  // with the view - nothing else here would otherwise touch it.
  const cleanup = bodyAfter(CODE.slice(CODE.lastIndexOf('viewEl._cleanup = () => {')), 'viewEl._cleanup = () => {');
  assert.match(cleanup, /(?:tview\.)?templatePickTornDown = true;/);
  assert.match(cleanup, /(?:tview\.)?templatePickClose\?\.\(\);\s*(?:tview\.)?templatePickClose = null;/);
});

// ── Surface 1: the chooser also opens for user-template-only tools ────────────
// The blank-fresh-open gate used to hard-require built-in `hasTemplates`, so a tool whose
// only starting points were the user's own saved templates never opened the chooser. It now
// opens on `hasTemplates || hasUserTemplates`, where the user count is read from the store
// only when a chooser is otherwise possible (blank open, no resume/seed/link).

test('the chooser gate opens on built-in OR user templates', () => {
  assert.match(
    CODE,
    /else if \(\s*!(?:tview\.)?slot\s*&&\s*!(?:tview\.)?seededDirect\s*&&\s*Object\.keys\((?:tview\.)?values\)\.length === 0\s*&&\s*\(!(?:tview\.)?reachedViaLink \|\| (?:tview\.)?templateParam === ''\)\s*\) \{/,
    'the gate condition dropped the hard hasTemplates requirement so a user-template-only tool reaches it'
    + ' (an EMPTY ?template= - the gallery card + New button - is an explicit chooser ask that overrides reachedViaLink)',
  );
  assert.match(CODE, /hasUserTemplates = mine\.length > 0;/,
    'the user templates are counted from the store list()');
  assert.match(CODE, /createUserTemplateStore\([\s\S]{0,200}?\)\.list\(toolId\)/,
    'the count comes from the user-template store scoped to this tool id');
  assert.match(CODE, /if \(!startSeeded && \((?:tview\.)?hasTemplates \|\| (?:tview\.)?hasUserTemplates\) && !hasPendingDesignImport\(\)\) \{/,
    'the chooser opens for built-in OR user templates - for neither, this guard leaves templatePick null -'
    + ' and never over a pending design import, whose drop front door owns this mount (2026-09-02),'
    + ' and never once a "Start with" already seeded the document (plans/226)');
});

test('the built-in fast path skips the user-template store read before mount', () => {
  // A tool WITH built-in templates always opens, so it must not pay the async store read on
  // the mount path - the count is guarded behind `if (!hasTemplates)`, and the chooser
  // promise below still fetches the user templates off the mount path as it always did.
  const head = CODE.match(/else if \(\s*!(?:tview\.)?slot\s*&&\s*!(?:tview\.)?seededDirect\s*&&\s*Object\.keys\((?:tview\.)?values\)\.length === 0\s*&&\s*\(!(?:tview\.)?reachedViaLink \|\| (?:tview\.)?templateParam === ''\)\s*\)/)?.[0];
  assert.ok(head, 'the blank-fresh-open chooser branch exists');
  const branch = bodyAfter(CODE, head!);
  const countAt = branch.indexOf('hasUserTemplates = mine.length > 0;');
  assert.notEqual(countAt, -1, 'the user-template count is inside this branch');
  assert.match(branch.slice(0, countAt), /if \(!startSeeded && !(?:tview\.)?hasTemplates\) \{/,
    'the store read only runs when there are no built-in templates (Design stays fast) and no '
    + '"Start with" already answered the question');
});

// ── Surface 2: the blank fresh-open ladder (plans/226 section 3) ──────────────
//
// A person can tell a tool how to open: a template of theirs, a shipped one, "Blank", or
// nothing (ask). The rungs have to stay in this order, because each one exists to beat the
// one below it, and each is a single line that a later edit can drop without noticing:
//
//   a. an EMPTY `?template=` asks, always - that is what the gallery card's "+ New" means,
//      and it must beat a "Start with" or the button silently stops working;
//   b. a "Start with" REF seeds the document directly, through the SAME applier the
//      `?template=` launcher uses, and opens no chooser;
//   c. a ref that no longer resolves clears itself and falls through to the ask, so a
//      deleted template can never wedge a tool open on something nobody chose;
//   d. "blank" seeds the manifest defaults (declared artboards kept) and opens no chooser;
//   e. anything the URL already decided - a resume, a seed, a link with params - never
//      reaches the ladder at all (the else-if gate above is what guarantees that).
//
// Same source-scan reasoning as the rest of this file: mountTool cannot be imported
// outside Vite. The pieces the ladder calls are unit-tested where they live
// (lib/template-start.ts, lib/template-ref.ts, lib/template-actions.ts).

/** The blank-fresh-open branch body - the ladder's home. */
function ladderBranch(): string {
  const head = CODE.match(/else if \(\s*!(?:tview\.)?slot\s*&&\s*!(?:tview\.)?seededDirect\s*&&\s*Object\.keys\((?:tview\.)?values\)\.length === 0\s*&&\s*\(!(?:tview\.)?reachedViaLink \|\| (?:tview\.)?templateParam === ''\)\s*\)/)?.[0];
  assert.ok(head, 'the blank-fresh-open branch exists');
  return bodyAfter(CODE, head!);
}

test('an empty `?template=` still asks, whatever the "Start with" says', () => {
  const branch = ladderBranch();
  const gate = branch.indexOf("if (templateParam !== '') {");
  assert.notEqual(gate, -1,
    'the whole "Start with" read is behind an explicit-ask check - an empty ?template= '
    + 'is the gallery "+ New" button and must reach the chooser with the setting untouched');
  const startAt = branch.indexOf('loadTemplateStart(');
  assert.ok(gate < startAt, 'the setting is only read once the ask has been ruled out');
});

test('a "Start with" ref seeds through the SAME applier as `?template=`', () => {
  const branch = ladderBranch();
  assert.match(branch, /const start = loadTemplateStart\(mountProfile, toolId\);/,
    'the setting comes from lib/template-start.ts, off the profile read above it');
  assert.match(branch, /if \(start && start !== START_BLANK\) \{[\s\S]{0,600}?await resolveTemplateSeed\(/,
    'a ref is resolved through the one resolver (their own store, the shipped file, inline metadata)');
  // Both rungs and the ?template= launcher apply their seed through applyTemplateSeed, so
  // the pose, the URL/profile precedence and templateSeededIds can never disagree.
  assert.equal((CODE.match(/await applyTemplateSeed\(/g) ?? []).length, 3,
    'exactly three appliers: the ?template= launcher, the start-with ref, and start-with blank');
  const applier = bodyAfter(CODE, 'const applyTemplateSeed = async (seed: Record<string, InputValue>): Promise<void> => {');
  assert.match(applier, /templateSeededIds\.add\(id\)/, 'a seeded field stays in later share URLs');
  assert.match(applier, /\{ \.\.\.seed, \.\.\.tview\.initialValues \}/,
    'a URL/profile-supplied key still wins over the template, as it always has');
});

test('a "Start with" that no longer resolves clears itself and asks', () => {
  const branch = ladderBranch();
  assert.match(branch, /\} else \{[\s\S]{0,400}?await setStartWith\((?:[\s\S]{0,120}?)toolId, null\);/,
    'a ref that resolves to nothing (deleted, hidden, unsynced) is cleared, not carried');
  const cleared = branch.indexOf('setStartWith(');
  const seeded = branch.indexOf('startSeeded = true;');
  assert.ok(seeded < cleared,
    'the clear is the ELSE of the found case - clearing must not run on a good ref');
  // …and having cleared it, the branch falls through with startSeeded false, so the
  // chooser gate below decides exactly as it would for a person who never set one.
  assert.doesNotMatch(branch.slice(cleared, branch.indexOf('} else if (start === START_BLANK)')), /startSeeded = true;/,
    'a cleared setting must NOT count as seeded, or the tool opens blank with no chooser');
});

test('"Start with: blank" keeps the declared artboards and opens no chooser', () => {
  const branch = ladderBranch();
  assert.match(branch, /else if \(start === START_BLANK\) \{[\s\S]{0,500}?blankTemplateSeed\(tview\.tool\.manifest\.inputs\)/,
    'blank is the manifest defaults through blankTemplateSeed - a frame tool keeps its artboards');
  const blankAt = branch.indexOf('start === START_BLANK');
  assert.match(branch.slice(blankAt), /startSeeded = true;/,
    'and it settles the ladder, so nothing opens over it');
});

test('the ladder never runs for a link that carries its own intent', () => {
  // Resume, in-process seed and URL values are excluded by the else-if gate itself - the
  // ladder lives INSIDE it, so a seeded/parameterised open cannot reach a "Start with".
  const branch = ladderBranch();
  assert.ok(branch.includes('loadTemplateStart('), 'the setting is read inside the gate, not before it');
  const beforeGate = CODE.slice(0, CODE.indexOf(branch));
  assert.ok(!/loadTemplateStart\(/.test(beforeGate),
    'nothing reads "Start with" ahead of the resume/seed/link checks');
});

test('the ladder costs ONE profile read, shared with the profile-fill loop', () => {
  const pick = bodyAfter(CODE, 'export async function templatePick(tview: ToolViewCtx): Promise<void> {');
  assert.match(pick, /let mountProfile: Profile \| null = null;/, 'the one record is held for the mount');
  assert.match(pick, /mountProfile = await tview\.host\.profile\.get\(\);/, 'the ladder fills it');
  assert.match(pick, /const profile = mountProfile \?\? await tview\.host\.profile\.get\(\);/,
    'the profile-fill loop reuses it instead of reading a second time');
  assert.equal((pick.match(/tview\.host\.profile\.get\(\)/g) ?? []).length, 2,
    'those two sites are the only profile reads on the mount path');
});

test('the chooser list is built from the shared ref-carrying builders', () => {
  // Every tile has to carry its ref, or the chooser cannot offer hide / start-with /
  // rename / delete on it (plans/226 WP-3) - which is why the list is assembled by
  // lib/template-ref.ts and not by hand here.
  assert.match(CODE, /const templates = shippedVariants\(toolId, templateMeta\);/,
    'the shipped tiles come from shippedVariants (ref + own:false)');
  assert.match(CODE, /templates\.push\(\.\.\.userVariants\(mine, t\('Yours'\)\)\);/,
    "the person's own come from userVariants under one group name");
  assert.match(CODE, /hiddenDefaults: defaultHiddenTemplateRefs\(\),/,
    "the brand's hidden-by-default refs are handed over - the chooser owns the filtering");
});

test('the chooser hands back a working close only once the modal is real', () => {
  // onOpen must fire after `finish` is defined (the close it hands back closes over it)
  // - a close handle that could throw or close nothing would defeat the whole guard.
  const finishAt = CHOOSER.indexOf('const finish = (values');
  const onOpenAt = CHOOSER.indexOf('opts.onOpen?.(');
  assert.notEqual(finishAt, -1);
  assert.notEqual(onOpenAt, -1);
  assert.ok(finishAt < onOpenAt, 'onOpen must fire after `finish` exists, since it closes over it');
  assert.match(CHOOSER, /opts\.onOpen\?\.\(\(\) => finish\(\{\}\)\);/,
    'closing resolves blank - identical to Escape / backdrop / ×, and idempotent (settled guard)');
});

// ── Design chrome mount gate (plan 179 M1-M3) ────────────────────────────────────────
//
// The top bar and the two side columns belong to ONE layout - `render.layout:"editor"`
// with a canvas blocks input. Mounting any of them anywhere else would put a document
// name field, a slide list and an inspector over a tool that has no boxes to inspect, and
// (because they write `--stage-reserve-*`) would shrink its canvas to make room for
// chrome that does nothing. They also hold listeners, a ResizeObserver and a stage
// reserve each, so a mount with no matching destroy leaks all three past a navigation.
//
// Same source-scan reasoning as the rest of this file: `mountTool` cannot be imported
// outside Vite. The modules' own behaviour is covered by design-topbar.test.ts,
// design-navigator.test.ts and design-inspector.test.ts.

/** The `{ … }` bodies of EVERY occurrence of `head`, concatenated. */
function bodiesAfter(src: string, head: string): string {
  const out: string[] = [];
  for (let from = src.indexOf(head); from !== -1; from = src.indexOf(head, from + head.length)) {
    out.push(bodyAfter(src.slice(from), head));
  }
  assert.notEqual(out.length, 0, `expected at least one \`${head}\` in tool.ts`);
  return out.join('\n');
}

const EDITOR_BLOCK_HEAD = 'if (editorLayout && canvasEditInput && canvasEl && stageEl) {';

test('the design chrome mounts ONLY inside the editor-layout block', () => {
  const block = bodyAfter(CODE, EDITOR_BLOCK_HEAD);
  for (const fn of ['mountDesignTopbar', 'initDesignNavigator', 'initDesignInspector']) {
    const calls = CODE.match(new RegExp(`${fn}\\s*\\(`, 'g')) ?? [];
    assert.equal(calls.length, 1, `${fn} is called exactly once in tool.ts (found ${calls.length})`);
    assert.match(block, new RegExp(`${fn}\\s*\\(`),
      `${fn} must be called from inside \`${EDITOR_BLOCK_HEAD}\` - it is that layout's chrome`);
  }
});

test('every design chrome part is destroyed in the view teardown', () => {
  const block = bodyAfter(CODE, EDITOR_BLOCK_HEAD);
  const teardown = bodiesAfter(block, 'viewEl._cleanup = () => {');
  for (const handle of ['designTopbar', 'designNav', 'designInspector']) {
    assert.match(teardown, new RegExp(`\\b${handle}\\b`),
      `${handle} must be reached from a _cleanup body, or its listeners and stage reserve outlive the view`);
  }
  assert.match(teardown, /destroy\(\)/, 'the parts are destroyed, not merely dropped');
  assert.match(teardown, /setInspector\(null\)/,
    'the overlay must stop routing its object bar at a column that is about to be destroyed');
});

// ── One right-hand panel (Andy, 2026-09-02) ──────────────────────────────────
//
// "lets only have a single left sidebar and a single right sidebar." The inspector used
// to append itself to the stage, which put a second right-hand panel INSIDE the canvas
// surface next to the edge dock the export sheet already used: two columns over the
// artwork, the inner one clipping it. It is an occupant of that one column now
// (lib/edge-dock.ts), so three things have to hold together and each of them silently
// restores the old double column on its own:
//
//   1. the inspector is DOCKED, never appended to the stage;
//   2. the stage's right reserve stays 0 - the dock already nudges `#view` with
//      `--dock-w`, so a reserve on top of it takes the same space twice and leaves the
//      canvas off-centre on its own surface;
//   3. the dock can hand a panel back on its own (the user undocks it, or the window
//      drops below the mobile breakpoint where the whole column is inert), so the
//      release path - not only the bar's toggle - is what records the state.

test('the inspector takes a slot in the ONE right-hand column, and is never a stage child', () => {
  // The dock request moved out of this view into the detachable controller
  // (design-inspector-float.ts), which owns the edge-column / float-box choice. The
  // invariants are the same; only where each one lives has changed.
  const docked = INSPECTOR_FLOAT.match(/requestDock\('inspector'/g) ?? [];
  assert.equal(docked.length, 1, `the inspector is docked exactly once (found ${docked.length})`);
  assert.equal((CODE.match(/requestDock\('inspector'/g) ?? []).length, 0,
    'the view itself makes no dock request - the controller is the one writer');
  assert.match(INSPECTOR_FLOAT, /requestDock\('inspector', panel,/,
    'the column element itself goes into the dock');
  assert.match(INSPECTOR_FLOAT, /const released = \(reason: DockReleaseReason\)[\s\S]{0,700}?notify\(false, /,
    'a release the dock initiates must clear the open flag, or the bar keeps claiming it is open');
  // …and it must only write the device preference for a release the USER asked for. A
  // route change and the mobile-breakpoint undock both hand the panel back, and recording
  // "closed" for either meant leaving the editor once turned the inspector off forever.
  assert.match(CODE, /if \(reason === 'user'\) writeColumnPref\(INSP_KEY, open\)/,
    'a host-driven release must not record a preference the user never set');
  assert.match(INSPECTOR_FLOAT, /releaseAction = 'destroy';\s*releaseDock\('inspector', 'host'\)/,
    'the controller teardown takes it back out of a column that outlives the view, as the HOST');
  assert.match(CODE, /designInspectorFloat\?\.destroy\(\)/,
    'the view teardown destroys the controller, which is what releases the column');
  assert.match(CODE, /if \(readColumnPref\(INSP_KEY\)\) setInspectorOpen\(true\)/,
    'the panel is built detached and opened from the device preference afterwards: '
    + 'constructing it "open" made it rebuild itself on every selection change for a node '
    + 'that was never in the document');
  // Nothing may put it on the stage - that IS the second column.
  assert.ok(
    !/stageEl\.appendChild\(designInspector/.test(CODE) && !/stageEl\.append\(designInspector/.test(CODE),
    'the inspector is never appended to the stage',
  );
  assert.ok(!/stageEl/.test(INSPECTOR_FLOAT), 'the controller never touches the stage either');
});

test('the stage reserves NO right band - the dock nudges the view instead', () => {
  assert.match(CODE, /design\.setColumnWidths\(navW, 0\)/,
    'the arbiter is told the right band is zero, so --stage-reserve-right stays unset');
  assert.ok(
    !/--stage-reserve-right/.test(CODE),
    'fitCanvas must not read a right reserve either: with the dock nudging #view, the stage '
    + 'it measures is already narrower, and subtracting again double-counts the column',
  );
});

test('the Inspector toggle and the object bar\'s reveal both go through the dock gate', () => {
  assert.match(CODE, /toggle: \(\) => setInspectorOpen\(!inspectorOpen\)/,
    'the bar\'s toggle is a dock request, not a setOpen on the panel');
  assert.match(CODE, /reveal: \(section\) => \{\s*setInspectorOpen\(true\);\s*designInspector\?\.reveal\(section\);\s*\}/,
    'the object bar can reveal a section while the column is out of the dock, so it asks for a slot first');
  assert.match(CODE, /onClose: \(\) => \{\s*setInspectorOpen\(false\);\s*designTopbar\?\.focusInspectorToggle\(\);\s*\}/,
    'the column\'s own header close comes back to the one writer, or the toggle and the panel '
    + 'disagree - and it hands the keyboard to the only control that re-opens the panel, '
    + 'because closing removes the subtree that held focus');
  // Docked is not the same as visible: a docked panel can be behind a tab or inside a
  // collapsed rail, and the object bar's Text / More / Dims / Stroke were dead in both.
  assert.match(CODE, /const setInspectorOpen = \(open: boolean\): void => \{\s*designInspectorFloat\?\.setOpen\(open\);/,
    'the single writer hands every open/close to the controller');
  assert.match(INSPECTOR_FLOAT, /if \(open\) \{\s*if \(mode === 'edge'\) showPanel\('inspector'\)/,
    'asking for an already-docked inspector must bring it to the front');
});

test('the top bar follows the dock, so one screen never carries two zoom clusters', () => {
  assert.match(CODE, /zoomDocked: \(\) => isDocked\('zoom'\) && !edgeDockCollapsed\(\)/,
    'a live read, and one that counts a collapsed column as carrying nothing - otherwise '
    + 'collapsing the dock left the editor with no zoom control anywhere on screen');
  assert.match(CODE, /subscribe: \(cb\) => onDockChange\(cb\)/,
    'and it follows every occupancy change - the compact bar can dock from its own drag');
});

test('the profile avatar is created once, and exactly one surface may claim it', () => {
  // It is ADOPTED (moved), not cloned, so two claimants means one of them silently ends up
  // empty - and the bug this replaced was the avatar drawn over the bar's Export button.
  assert.equal((CODE.match(/\bprofileToggle\b/g) ?? []).length, 3,
    'exactly three mentions: the one construction, the stage-nav HUD, and the bar\'s slot');
  // Both surfaces are handed the ONE element; the stage-nav HUD holds it while docked
  // in the right column and the bar's slot hides itself meanwhile (design-topbar
  // syncDock), so the avatar is never drawn twice (Andy, 2026-09-03).
  assert.doesNotMatch(CODE, /designChrome \? undefined : profileToggle/,
    'the stage-nav HUD gets it in the design layout too - it docks with the zoom bar');
  assert.match(CODE, /profileEl: profileToggle \?\? undefined/,
    '…and so does the top bar');
});

test('the export sheet re-syncs the bar on the way OUT as well as in', () => {
  assert.match(CODE, /dispatchEvent\(new CustomEvent\('lolly:export-close'\)\)/,
    'closing the sheet announces itself, the mirror of lolly:export-open');
  assert.match(CODE, /addEventListener\('lolly:export-close', onExportOpen\)/,
    'and the bar re-reads the name on it - the sheet can normalise or revert a rename as it closes');
  assert.match(CODE, /removeEventListener\('lolly:export-close', onExportOpen\)/,
    '…removed with the view, like its sibling');
});

test('the editor layout hands its Home pill to the top bar, and builds no zoom HUD', () => {
  // Two Home pills (the view corner and the bar) would sit on top of each other, and two
  // zoom controls on one stage is the duplication M1 exists to retire. Both are one-line
  // gates, which is exactly the kind of line a later edit drops without noticing.
  assert.match(CODE, /!designChrome \? backPillHtml\(backPillOpts\) : ''/,
    'the free-floating corner pill is gated off for the design chrome');
  assert.match(CODE, /backPillHtml:\s*backHomeHtml\(backPillOpts\)/,
    '…and the bar emits it instead, so mountBackPill still finds a [data-back-pill]');
  assert.match(CODE, /hud:\s*!designChrome/, 'setupStageNav builds no floating HUD in this layout');
});
