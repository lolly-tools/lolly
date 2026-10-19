// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly run` and a theme choice the tool ignores (plans/319 A4, manifest `tokenAxes`).
 *
 * The runtime decides (tests/tool-token-axes.test.ts pins that); the CLI's part is
 * to report the override and to move its bridge to what the runtime applied. What
 * these pin:
 *   - each ignored choice is one usage warning, THEME_CHOICE_IGNORED, carrying the
 *     group, kind, requested and applied option for a machine reader, and
 *     `--strict` fails the run on it like any other usage warning;
 *   - a runtime that overrode nothing warns about nothing;
 *   - a real CLI bridge built on the link's `_themes` answers in the runtime's
 *     selection once it follows, and moves for nothing else.
 * tests/token-axes-run.test.ts runs a whole `lolly run` and MCP render through
 * the same seams.
 *
 * Run with: node --test tests/cli-token-axes.test.ts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reportIgnoredThemeChoices, settleThemeChoices, THEME_CHOICE_IGNORED } from '../shells/cli/src/token-axes-report.ts';
import { createCliBridge, followRuntimeSelection } from '../shells/cli/src/bridge.ts';
import { configureOutput, recordedWarnings, resetOutput, strictExitCode } from '../shells/cli/src/output.ts';
import { addColourway, liftToColourways } from '../engine/src/colourway.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import type { HostV1 } from '../packages/core/src/host-v1.ts';
import { JSDOM } from 'jsdom';

type Rec = Record<string, unknown>;

beforeEach(() => { resetOutput(); configureOutput({ quiet: true }); });

const IGNORED = { group: 'colourway', kind: 'colourway' as const, canonical: 'main', requested: 'persimmon' };

test('each ignored choice is one usage warning with the facts a script keys on', () => {
  assert.equal(reportIgnoredThemeChoices({ ignoredTokenChoices: [IGNORED] }, 'Ramp'), 1);
  assert.deepEqual(recordedWarnings(), [{
    code: THEME_CHOICE_IGNORED,
    message: 'Ramp ignores the colourway, so persimmon was not applied. It renders in main, the canonical option.',
    kind: 'usage',
    extra: { group: 'colourway', kind: 'colourway', requested: 'persimmon', applied: 'main' },
  }]);
  assert.equal(strictExitCode(), null, 'a plain run still succeeds');
  configureOutput({ strict: true });
  assert.equal(strictExitCode(), 2, '--strict fails on it as a usage warning');
});

test('a runtime that overrode nothing, or predates the field, warns about nothing', () => {
  assert.equal(reportIgnoredThemeChoices({ ignoredTokenChoices: [] }, 'Chart'), 0);
  assert.equal(reportIgnoredThemeChoices({}, 'Chart'), 0);
  assert.deepEqual(recordedWarnings(), []);
});

function colourwayDoc(): Rec {
  const start = JSON.parse(readFileSync(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8')) as Rec;
  const lifted = liftToColourways(start, { id: 'main', name: 'Main' });
  assert.ok(lifted.ok);
  const added = addColourway(lifted.doc, { id: 'persimmon', name: 'Persimmon', values: {
    light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
    dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
  } });
  assert.ok(added.ok);
  return added.doc;
}

/** A real CLI bridge over `doc`, scoped to the link's `_themes` the way `lolly run` builds its bridge. */
async function bridgeFor(doc: Rec, linkSelection: Record<string, string>): Promise<HostV1> {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>');
  return createCliBridge({ dom: dom as never, tokenSelection: linkSelection, tokensDocument: doc });
}

const lead = (host: HostV1): Promise<unknown> => host.tokens!.resolve('{color.semantic.primary}');

test('a bridge built on the link\'s choice answers in the runtime\'s once it follows, and only then', async () => {
  const doc = colourwayDoc();
  const link = { '': 'light', colourway: 'persimmon' };
  const canonical = createTokenSet(doc, { selection: { '': 'light', colourway: 'main' } }).resolve('{color.semantic.primary}');
  const host = await bridgeFor(doc, link);
  assert.equal(await lead(host), '#c2410c', 'the bridge starts on the link\'s colourway');
  assert.equal(followRuntimeSelection(host, undefined, link), false, 'a runtime with no selection moves nothing');
  assert.equal(followRuntimeSelection(host, { colourway: 'persimmon', '': 'light' }, link), false, 'the same choices in another order are no move');
  assert.equal(await lead(host), '#c2410c');
  assert.equal(followRuntimeSelection(host, { '': 'light', colourway: 'main' }, link), true);
  assert.equal(await lead(host), canonical, 'every read after the move, the bridge\'s own included, is the canonical colourway');
  assert.equal((await host.tokens!.colors()).find((c) => c.path === 'color.semantic.primary')?.value, canonical);
  assert.equal(followRuntimeSelection({} as HostV1, { colourway: 'main' }, link), false, 'a host that is not a CLI bridge is left alone');
});

test('settling a mount moves the bridge and reports the override in one step', async () => {
  const doc = colourwayDoc();
  const link = { '': 'light', colourway: 'persimmon' };
  const host = await bridgeFor(doc, link);
  const runtime = { tokenSelection: { '': 'light', colourway: 'main' }, ignoredTokenChoices: [IGNORED] };
  assert.equal(settleThemeChoices(host, runtime, link, 'Ramp'), 1);
  assert.deepEqual(recordedWarnings().map((w) => w.code), [THEME_CHOICE_IGNORED]);
  assert.notEqual(await lead(host), '#c2410c');
});
