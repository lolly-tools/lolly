// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly system context` and `lolly system check` with no terminal system (plan 291 W3):
 * the content profile answers, the result records where its tokens came from, and the
 * check reports house-rule findings next to the brand findings. Run as CI runs, on the
 * public lolly-start profile with an empty state directory.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = new URL('..', import.meta.url);
const FIXTURE = new URL('./fixtures/design-brief/tokens.json', import.meta.url).pathname;

function lolly(args: string[], state: string, profile = 'lolly-start'): { status: number | null; json: Record<string, unknown>; stderr: string } {
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, LOLLY_PROFILE: profile, LOLLY_STATE_DIR: state },
  });
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(run.stdout); } catch { /* the assertion on status reports stderr */ }
  return { status: run.status, json, stderr: run.stderr };
}

test('system context answers from the content profile when no terminal system is active', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-brief-cli-'));
  try {
    const run = lolly(['system', 'context', '--json'], join(dir, 'state'));
    assert.equal(run.status, 0, run.stderr);
    const result = run.json.result as Record<string, any>;
    assert.equal(run.json.ok, true);
    assert.deepEqual(result.origin, { kind: 'profile', profile: 'lolly-start', tokensAsset: 'lolly/tokens/brand' });
    assert.equal(result.catalog.profile, 'lolly-start');
    assert.equal(result.name, result.catalog.label);
    assert.equal(result.format, 'lolly-design-context');
    for (const key of ['colors', 'fonts', 'assets', 'rules', 'tokens', 'themes', 'combinations', 'type', 'logos', 'icons', 'media', 'master', 'houseRules']) {
      assert.ok(key in result, key);
    }
    // lolly-start declares no pairings, icons or house rules: derived or empty, never a crash.
    assert.equal(result.coverage.houseRules, 'unavailable');
    assert.equal(result.coverage.icons, 'unavailable');
    assert.ok(['derived', 'unavailable'].includes(result.coverage.combinations));
    assert.ok(result.master.archetypes.length > 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('lolly://design-context is the brief `system context --json` prints, origin included', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-brief-mcp-'));
  try {
    const state = join(dir, 'state');
    const cli = lolly(['system', 'context', '--json'], state);
    assert.equal(cli.status, 0, cli.stderr);
    const mcp = spawnSync(process.execPath, ['--input-type=module', '-e',
      "import { readResource } from './services/mcp/src/resources.ts'; process.stdout.write((await readResource('lolly://design-context')).text);"], {
      cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: state },
    });
    assert.equal(mcp.status, 0, mcp.stderr);
    const resource = JSON.parse(mcp.stdout) as Record<string, any>;
    assert.deepEqual(resource.origin, { kind: 'profile', profile: 'lolly-start', tokensAsset: 'lolly/tokens/brand' });
    assert.equal(resource.tokens?.$metadata?.activeThemeSelection, undefined, 'the raw document, as the CLI reads it');
    assert.deepEqual(resource, cli.json.result);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('system check reports house rules beside brand findings and records the design system it used', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-brief-check-'));
  try {
    const design = join(dir, 'design.json');
    await writeFile(design, JSON.stringify({ boxes: [
      { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
      { id: 'reef', kind: 'text', frame: 'a1', x: 100, y: 600, w: 600, h: 60, text: 'Reef on white', fontSize: 28, weight: '400', align: 'left', fg: '#2fb8ac', font: 'Fixture Sans' },
      { id: 'heavy', kind: 'text', frame: 'a1', role: 'title', x: 100, y: 100, w: 1500, h: 150, text: 'A heavy headline', fontSize: 96, weight: '700', align: 'left', fg: '#13294b' },
      { id: 'centred', kind: 'text', frame: 'a1', x: 100, y: 800, w: 600, h: 60, text: 'Centred words', fontSize: 28, weight: '400', align: 'center', fg: '#13294b' },
      { id: 'card', kind: 'box', frame: 'a1', x: 1200, y: 600, w: 400, h: 300, shape: 'rounded', radius: 16, bg: '#ffffff', stroke: '#2fb8ac', strokeW: 2 },
      { id: 'upload', kind: 'image', frame: 'a1', x: 0, y: 0, w: 10, h: 10, image: 'user/media/abc' },
    ] }));
    const run = lolly(['system', 'check', design, `--file=${FIXTURE}`, '--json'], join(dir, 'state'));
    assert.equal(run.status, 0, run.stderr);
    const result = run.json.result as Record<string, any>;
    // The same shape as CheckReportV1's designSystem, which `lolly check` prints.
    assert.deepEqual(result.designSystem, { origin: 'file' });
    assert.deepEqual(result.findings, []);
    assert.equal(result.uploads, 1);
    const found = (result.houseRules.findings as Array<{ ruleId: string; layerId: string }>).map((f) => `${f.ruleId}:${f.layerId}`).sort();
    assert.deepEqual(found, ['align-left:centred', 'headline-weight:heavy', 'pairings:reef', 'rounded-edges:card']);
    assert.deepEqual(result.houseRules.unknown, ['clear-space']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the profile fallback is for reading only: sync still needs a terminal system', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-brief-sync-'));
  try {
    const run = lolly(['system', 'sync', FIXTURE, '--json'], join(dir, 'state'));
    assert.equal(run.status, 2, run.stderr);
    assert.equal((run.json.error as { kind?: string } | undefined)?.kind, 'NO_TOKENS');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

const START_TOKENS = new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url).pathname;
const SUSE_PRESENT = existsSync(new URL('../brands/suse/catalog/assets/suse/tokens/brand.json', import.meta.url));
/** One artboard carrying the SUSE horizontal mark. */
const LOGO_DESIGN = { boxes: [
  { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
  { id: 'logo', kind: 'image', frame: 'a1', x: 100, y: 100, w: 300, h: 100, image: 'suse/logo/hor-pos-green' },
] };

test('a --file design system that is another brand gets none of the active profile catalog', async (t) => {
  if (!SUSE_PRESENT) { t.skip('brands/suse is not checked out, so the suse profile cannot be resolved here'); return; }
  const dir = await mkdtemp(join(tmpdir(), 'lolly-brief-foreign-'));
  try {
    const state = join(dir, 'state');
    const context = lolly(['system', 'context', `--file=${FIXTURE}`, '--json'], state, 'suse');
    assert.equal(context.status, 0, context.stderr);
    const brief = context.json.result as Record<string, any>;
    assert.deepEqual(brief.origin, { kind: 'file' });
    assert.equal(brief.catalog, null, 'the SUSE catalog does not describe the Tidewater tokens');
    assert.equal(brief.master.asset, undefined);
    assert.ok(!String(brief.master.id).startsWith('suse/'), 'no SUSE master');
    assert.equal(brief.logos.onLight, undefined);
    assert.equal(brief.logos.onDark, undefined);
    assert.ok(!(brief.logos.variants as Array<{ id: string }>).some((v) => v.id.startsWith('suse/')), 'no SUSE logos');
    assert.equal(brief.icons.count, 0);
    for (const key of ['master', 'type']) assert.equal(brief.coverage[key], 'neutral', key);
    for (const key of ['icons', 'media']) assert.equal(brief.coverage[key], 'unavailable', key);

    // The check gives the same answer under every profile: a SUSE mark is not a Tidewater asset.
    const design = join(dir, 'logo.json');
    await writeFile(design, JSON.stringify(LOGO_DESIGN));
    const verdicts = ['suse', 'lolly-start'].map((profile) => {
      const run = lolly(['system', 'check', design, `--file=${FIXTURE}`, '--json'], state, profile);
      assert.equal(run.status, 0, run.stderr);
      return (run.json.result as { findings: Array<{ layerId: string; kind: string; status: string }> }).findings
        .filter((f) => f.layerId === 'logo').map((f) => `${f.kind}:${f.status}`);
    });
    assert.deepEqual(verdicts[0], ['asset:review']);
    assert.deepEqual(verdicts[0], verdicts[1]);

    // `lolly check` reads the same scoped catalog.
    const check = lolly(['check', design, `--file=${FIXTURE}`, '--browser=off', '--json'], state, 'suse');
    const report = check.json.result as { designSystem: unknown; findings: Array<{ code: string; layerId?: string }> };
    assert.deepEqual(report.designSystem, { origin: 'file' });
    assert.ok(report.findings.some((f) => f.layerId === 'logo' && f.code.startsWith('brand.asset')), JSON.stringify(report.findings));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a terminal system that is another brand gets none of the profile catalog either', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-brief-terminal-'));
  try {
    const state = join(dir, 'state');
    const imported = lolly(['system', 'import', FIXTURE, '--json'], state);
    assert.equal(imported.status, 0, imported.stderr);
    const run = lolly(['system', 'context', '--json'], state);
    assert.equal(run.status, 0, run.stderr);
    const brief = run.json.result as Record<string, any>;
    assert.deepEqual(brief.origin, { kind: 'terminal' });
    assert.equal(brief.catalog, null);
    assert.equal(brief.coverage.master, 'neutral');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a --file that is the profile own tokens asset keeps the profile catalog', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-brief-own-'));
  try {
    const run = lolly(['system', 'context', `--file=${START_TOKENS}`, '--json'], join(dir, 'state'));
    assert.equal(run.status, 0, run.stderr);
    const brief = run.json.result as Record<string, any>;
    assert.deepEqual(brief.origin, { kind: 'file' });
    assert.deepEqual(brief.catalog, { profile: 'lolly-start', label: brief.catalog?.label, tokensAsset: 'lolly/tokens/brand' });
    assert.ok(brief.catalog.label);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
