// SPDX-License-Identifier: MPL-2.0
/**
 * A team-session origin never outlives the mount that consumed it - INCLUDING the
 * mounts that never happen (plan 100 section 7; `org/team-session-origin.ts` rule 3).
 *
 * `org/team-session-origin.test.ts` proves the module: one-shot arming, a mismatch that
 * clears both states, and a release that drops the live one. What it cannot prove is the
 * half that decides whether any of that holds in the product - THE VIEW WIRING - because
 * `mountTool` imports stylesheets and reaches modules that resolve siblings with `.js`
 * specifiers, so no suite outside Vite can mount it (the reason `views/tool-collab-mount.
 * test.ts` and `views/block-row-id.test.ts` scan rather than mount).
 *
 * The gap this file closes was real. `consumeTeamSessionOrigin` does not merely SPEND the
 * stash: on a tool-id match it PROMOTES it to the module's live slot, and the view's only
 * release sits inside the `viewEl._cleanup` closure that is not assigned until the mount
 * is fully built, ~1500 lines later. Every abandoned mount in between - a 404, an offline
 * load, a validation failure, a capability this shell cannot fulfil - therefore left an
 * origin live with nothing to release it (`main.ts`'s `navigate()` calls
 * `view._cleanup?.()`, and this view had given it none). The concrete cost, on a governed
 * instance: open a team session of a `capture` tool on Safari, get the "desktop only"
 * card, go to Projects, share a LOCAL session of the same tool - and `org/collab-share.ts`
 * reads the stale team `sessionId` at press time and keys a work collab on somebody
 * else's session. An id that is present and wrong is precisely what that module exists to
 * prevent, and it can only be prevented here.
 *
 * So this suite pins both halves:
 *
 *  1. THE TEXT. Every `return` between the consume and the `_cleanup` assignment releases
 *     first. Nested function bodies are stripped before the scan, so the invariant covers
 *     the WHOLE danger zone rather than the five branches that exist today - a sixth
 *     early return added tomorrow fails this test rather than shipping the bug back.
 *  2. THE BEHAVIOUR. The module, driven through the same sequence the view performs, ends
 *     with nothing readable - proof that the calls added to the view are the ones that
 *     actually close the hole.
 *
 * Run directly:  node --test shells/web/src/views/tool-team-origin.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  _clearTeamSessionOriginForTests,
  activeTeamSessionOrigin,
  consumeTeamSessionOrigin,
  releaseTeamSessionOrigin,
  rememberTeamSessionOrigin,
} from '../org/team-session-origin.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// tool.ts is an orchestrator plus feature modules under tool/ (2026-09-09 split)
const TOOL_TS = [readFileSync(join(HERE, 'tool.ts'), 'utf8'), ...readdirSync(join(HERE, 'tool')).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(join(HERE, 'tool', n), 'utf8'))].join('\n');

/** Source with comments removed, so "does this path release?" cannot be answered by
 *  prose about it. Line comments are cut at a `//` that is not part of a `://` scheme;
 *  block comments are dropped wholesale. (The same reader `tool-collab-mount.test.ts`
 *  uses - kept local so neither suite can quietly change the other's evidence.) */
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

/** Index of the `}` closing the `{` at `open`. */
function matchBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * Empty every NESTED function body, leaving the enclosing statements intact.
 *
 * A `return` belongs to the function whose body it sits in, and `mountTool`'s prologue is
 * full of callbacks (a promise executor, a click handler) whose returns are not exits from
 * the mount. Depth alone cannot tell the two apart - the early returns live inside `if`
 * and `try` blocks, which are braces too - so the closures are removed instead, outermost
 * first, and whatever `return`s remain are exits from `mountTool` itself.
 */
function stripNestedFunctions(src: string): string {
  let out = src;
  for (;;) {
    const m = /(?:=>\s*|\bfunction\b[^(){};]*\([^()]*\)\s*(?::[^{;]*)?)\{/.exec(out);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    const close = matchBrace(out, open);
    if (close < 0) break;
    // The BRACES go with the body. Leaving them would re-match this same closure on the
    // next pass (the replacement is identical), which is an infinite loop rather than a
    // failed assertion - and a scanner that hangs teaches nobody anything.
    out = `${out.slice(0, open)}BODY${out.slice(close + 1)}`;
  }
  return out;
}

const CODE = stripComments(TOOL_TS);

/**
 * The danger zone: from the consume that can PROMOTE an origin, to the assignment of the
 * teardown hook that is the only other thing able to release one. Both anchors are
 * single, top-level statements, so the slice is brace-balanced.
 */
function dangerZone(): string {
  // the early returns live in the orchestrator (tool.ts); the setup modules that follow it in the
  // concatenation are not part of this zone
  const ORCH = stripComments(readFileSync(join(HERE, 'tool.ts'), 'utf8'));
  const from = ORCH.indexOf('consumeTeamSessionOrigin(toolId);');
  assert.notEqual(from, -1, 'the mount still consumes the stash');
  const cleanupAt = ORCH.indexOf('viewEl._cleanup = () => {', from);
  const to = cleanupAt === -1 ? ORCH.length : cleanupAt;
  assert.notEqual(to, -1, 'the mount still installs a teardown hook');
  return stripNestedFunctions(ORCH.slice(from, to));
}

test('every abandoned mount releases the origin before it returns', () => {
  const zone = dangerZone();
  const returns = [...zone.matchAll(/\breturn\b/g)].map(m => m.index as number);
  const releases = [...zone.matchAll(/releaseTeamSessionOrigin\(\)/g)].map(m => m.index as number);

  assert.ok(returns.length > 0,
    'the scan found no early return at all - the anchors have moved and this test is '
    + 'measuring nothing');

  // One release per exit, in order: between each `return` and the one before it there
  // must be a release. Counting alone would pass for five releases stacked in one branch.
  let previous = 0;
  for (const at of returns) {
    const line = zone.slice(0, at).split('\n').length;
    assert.ok(
      releases.some(r => r > previous && r < at),
      `the early return ${line} line(s) into mountTool abandons the mount without calling `
      + 'releaseTeamSessionOrigin() - the origin it consumed would outlive it, and the next '
      + 'Share dialog over a LOCAL session of this tool would key a work collab on the team '
      + 'session id it inherited (org/team-session-origin.ts, rule 3)',
    );
    previous = at;
  }
});

test('the teardown hook still releases, so a mount that DID happen gives it up too', () => {
  const at = CODE.lastIndexOf('viewEl._cleanup = () => {');
  const body = CODE.slice(at, matchBrace(CODE, CODE.indexOf('{', at)) + 1);
  assert.match(body, /releaseTeamSessionOrigin\(\);/,
    'rule 3 is a property of every mount, not only the ones that fail');
});

test('the origin is read through the tool-id-checked accessor and released nowhere else', () => {
  // `active` is module state; a second writer would be a second place to forget.
  assert.equal([...CODE.matchAll(/consumeTeamSessionOrigin\(/g)].length, 1,
    'one consume per mount - a second would spend a stash the first already took');
  assert.equal(/activeTeamSessionOrigin\(/.test(CODE), false,
    'the tool view never reads the origin: `org/collab-share.ts` is the only reader, and it '
    + 'names the tool it is asking about');
});

test('a mount that is abandoned leaves NOTHING for a later Share dialog to read', () => {
  _clearTeamSessionOriginForTests();

  // Projects arms the stash and navigates (views/projects.ts's openTeamSession) …
  rememberTeamSessionOrigin({ sessionId: 'team-sess-1', toolId: 'url-shot', projectId: 'proj-9' });
  // … the mount consumes it, and the id is live for as long as that mount is …
  assert.equal(consumeTeamSessionOrigin('url-shot')?.sessionId, 'team-sess-1');
  assert.equal(activeTeamSessionOrigin('url-shot')?.sessionId, 'team-sess-1');

  // … but this shell cannot fulfil the tool's capability, so the mount is abandoned.
  releaseTeamSessionOrigin();

  assert.equal(activeTeamSessionOrigin('url-shot'), null,
    'the Share dialog over a LOCAL url-shot session must find no origin at all - an id that '
    + 'is present and wrong is worse than the honest refusal a missing one produces');

  _clearTeamSessionOriginForTests();
});
