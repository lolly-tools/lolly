// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly run` and a theme choice the tool ignores (plans/319 A4, manifest `tokenAxes`).
 *
 * The runtime decides (tests/tool-token-axes.test.ts pins that); the CLI's part is
 * to report the override and to paint the canvas from what the runtime applied. What these pin:
 *   - each ignored choice is one usage warning, THEME_CHOICE_IGNORED, carrying the
 *     group, kind, requested and applied option for a machine reader, and
 *     `--strict` fails the run on it like any other usage warning;
 *   - a runtime that overrode nothing warns about nothing;
 *   - the canvas variables come from the runtime's selection when it differs from
 *     the link's, so `var(--brand-primary)` and a hook's token read agree.
 *
 * Run with: node --test tests/cli-token-axes.test.ts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canvasTokenHost, reportIgnoredThemeChoices, THEME_CHOICE_IGNORED } from '../shells/cli/src/token-axes-report.ts';
import { configureOutput, recordedWarnings, resetOutput, strictExitCode } from '../shells/cli/src/output.ts';
import { addColourway, liftToColourways } from '../engine/src/colourway.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { scopedTokenOptions } from '../engine/src/token-context.ts';
import type { HostV1 } from '../packages/core/src/host-v1.ts';

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

/** A host scoped to the link's `_themes`, the way the CLI bridge is built. */
function bridgeLike(doc: Rec, linkSelection: Record<string, string>): HostV1 {
  const set = (opts = {}) => createTokenSet(doc, scopedTokenOptions(linkSelection, opts));
  return {
    tokens: {
      get: async (opts = {}) => set(opts),
      colors: async (opts = {}) => set(opts).colors(),
      resolve: async (ref: string, opts = {}) => set(opts).resolve(ref),
      themes: async () => set().themes(),
    },
  } as unknown as HostV1;
}

test('the canvas is painted from the runtime\'s selection when a pin moved it off the link\'s', async () => {
  const doc = colourwayDoc();
  const link = { '': 'light', colourway: 'persimmon' };
  const host = bridgeLike(doc, link);
  assert.equal(canvasTokenHost(host, undefined, link), host);
  assert.equal(canvasTokenHost(host, { colourway: 'persimmon', '': 'light' }, link), host, 'the same choices in another order need no second scope');
  const pinned = canvasTokenHost(host, { '': 'light', colourway: 'main' }, link);
  assert.notEqual(pinned, host);
  const canonical = createTokenSet(doc, { selection: { '': 'light', colourway: 'main' } }).resolve('{color.semantic.primary}');
  assert.equal(await pinned.tokens!.resolve('{color.semantic.primary}'), canonical);
  assert.equal(await host.tokens!.resolve('{color.semantic.primary}'), '#c2410c', 'the bridge itself still answers in the link\'s colourway');
});
