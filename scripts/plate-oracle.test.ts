// SPDX-License-Identifier: MPL-2.0
/**
 * Print plate oracle (plan 342 D4). Each scene in tests/fixtures/plate-scenes/ is a Design document exported by
 * Lolly's own CLI as a CMYK Print PDF (`lolly run design --export=pdf-cmyk`, through the built web shell), then
 * separated by Ghostscript's `tiffsep` device, and each named region of each plate is sampled against the inks the
 * scene expects.
 *
 * Ghostscript is licensed AGPL-3.0. Lolly only ever runs it as an external process, the way pdf-oracle.test.ts runs
 * qpdf and poppler. Nothing here bundles, links or vendors Ghostscript, and no Ghostscript code or output ships.
 *
 * Policy, the same as scripts/pdf-oracle.test.ts: a missing tool is a declared skip locally, named by tool, and a
 * failure when LOLLY_ORACLES_REQUIRED=1. It is never a silent pass. The tools are `gs` and the built web shell
 * (`pnpm --filter ./shells/web run build`, plus `lolly install-browser` or LOLLY_BROWSER_CHANNEL=chrome).
 *
 * Off hosted CI: this file is in scripts/, which is not one of TEST_ROOTS in scripts/run-test-suite.ts, so `pnpm test`
 * and every CI shard never discover this file. The run is on request:
 *   pnpm run test:plates
 *   LOLLY_ORACLES_REQUIRED=1 pnpm run test:plates    (fails if gs or the web shell build is absent)
 *   LOLLY_PLATES_REPORT=out.json pnpm run test:plates  (also writes every sampled number as JSON)
 *   LOLLY_PLATES_ONLY=07,10 pnpm run test:plates       (only scenes whose id starts with one of these)
 * As a second guard, when GITHUB_ACTIONS is set it is a declared skip unless LOLLY_ORACLES_REQUIRED=1.
 *
 * A scene may carry `knownFailing` with a reason: the run still checks it and expects a failure, so a fixed exporter
 * turns the scene red until the marker is removed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pressSeparationFor } from '../packages/node-shell/src/press-separation-node.ts';
import {
  boundsFor, loadScenes, maxTotalInk, pdfFacts, plateFile, plateSetFailures, platesWritten, readPlateTiff, regionStats, structureFailures,
  type PlateImage, type Scene, type ScenePass,
} from '../tests/helpers/plate-scene.ts';

const required = process.env.LOLLY_ORACLES_REQUIRED === '1';
const hostedCi = process.env.GITHUB_ACTIONS === 'true' && !required;
const root = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(root, 'shells/cli/bin/lolly.ts');
const SCENES = join(root, 'tests/fixtures/plate-scenes');
const DPI = 96;
const CONCURRENCY = 2;
const only = process.env.LOLLY_PLATES_ONLY?.split(',').filter(Boolean);

type Tool = 'gs' | 'web shell build';

function probeGs(): string | null {
  const r = spawnSync('gs', ['--version'], { encoding: 'utf8' });
  return r.error ? null : `Ghostscript ${r.stdout.trim()}`;
}
const webShellPresent = (): boolean => Boolean(process.env.LOLLY_WEB_BASE) || existsSync(join(process.env.LOLLY_WEB_DIST ?? join(root, 'shells/web/dist'), 'index.html'));
const found: Record<Tool, string | null> = { gs: probeGs(), 'web shell build': webShellPresent() ? 'present' : null };

/** A skip reason for a missing tool, or false. With LOLLY_ORACLES_REQUIRED=1 a missing tool is a failure inside the test body. */
const skipFor = (...tools: Tool[]): string | false => {
  if (hostedCi) return 'declared skip: hosted CI does not run plate oracles (set LOLLY_ORACLES_REQUIRED=1 to force)';
  if (required) return false;
  const gone = tools.filter(t => !found[t]);
  return gone.length ? `declared skip: oracle ${gone.join(' and ')} not available (install it, or set LOLLY_ORACLES_REQUIRED=1 to make this a failure)` : false;
};
const need = (...tools: Tool[]): void => {
  for (const t of tools) if (!found[t]) throw new Error(`oracle ${t} is not available and LOLLY_ORACLES_REQUIRED=1`);
};

const work = mkdtempSync(join(tmpdir(), 'lolly-plate-oracle-'));
test.after(() => rmSync(work, { recursive: true, force: true }));
const scenes = loadScenes(SCENES).filter(s => !only || only.some(o => s.id.startsWith(o)));
const report: unknown[] = [];
test.after(() => { if (process.env.LOLLY_PLATES_REPORT) writeFileSync(process.env.LOLLY_PLATES_REPORT, `${JSON.stringify({ gs: found.gs, scenes: report }, null, 2)}\n`); });


const renders = new Map<string, Promise<string>>();
let running = 0;
const waiting: Array<() => void> = [];
async function slot<T>(job: () => Promise<T>): Promise<T> {
  while (running >= CONCURRENCY) await new Promise<void>(res => waiting.push(res));
  running++;
  try { return await job(); } finally { running--; waiting.shift()?.(); }
}

/** One CLI attempt. The headless shell sometimes misses its start-up window when the machine is busy, so a render is tried twice. */
function renderOnce(scene: Scene, attempt: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const dir = join(work, scene.id); mkdirSync(dir, { recursive: true });
    const rows = join(dir, 'rows.json'), out = join(dir, 'scene.pdf');
    writeFileSync(rows, JSON.stringify(scene.boxes));
    const args = [CLI, 'run', 'design', `--boxes-data=${rows}`, `--width=${scene.page.width}`, `--height=${scene.page.height}`,
      '--export=pdf-cmyk', '--no-provenance', `--output=${out}`, ...(scene.pressProfile ? [`--press-profile=${scene.pressProfile}`] : []),
      ...(scene.args ?? [])];
    const env = { ...process.env, LOLLY_PROFILE: scene.profile, LOLLY_STATE_DIR: join(dir, `state-${attempt}`), NO_COLOR: '1' };
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (c: Buffer) => { err += c.toString('utf8'); });
    const timer = setTimeout(() => child.kill('SIGKILL'), 280_000);
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0 && existsSync(out)) resolve(out); else reject(new Error(`lolly run design exited ${code} for ${scene.id}\n${err.slice(-1500)}`));
    });
  });
}

function renderScene(scene: Scene): Promise<string> {
  let hit = renders.get(scene.id);
  if (!hit) {
    hit = slot(() => renderOnce(scene, 1).catch(() => renderOnce(scene, 2)));
    renders.set(scene.id, hit);
    hit.catch(() => undefined);
  }
  return hit;
}


function separate(pdf: string, pass: ScenePass, dir: string): string {
  mkdirSync(dir, { recursive: true });
  const r = spawnSync('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', ...(pass.rip ?? []), '-sDEVICE=tiffsep', '-sCompression=none', `-r${DPI}`, `-sOutputFile=${join(dir, 'p%d.tif')}`, pdf], { encoding: 'utf8' });
  assert.equal(r.status, 0, `gs tiffsep exit ${r.status}\n${r.stdout}${r.stderr}`);
  return join(dir, 'p1');
}

interface Row { region: string; plate: string; stat: string; expected: string; got: number; ok: boolean }
const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();

async function samplePass(scene: Scene, pass: ScenePass, pdf: string): Promise<{ failures: string[]; rows: Row[] }> {
  const base = separate(pdf, pass, join(work, scene.id, `sep-${scene.passes.indexOf(pass)}`));
  const sep = await pressSeparationFor(scene.pressProfile ?? null);
  const cache = new Map<string, PlateImage | null>();
  const plate = (name: string): PlateImage | null => {
    if (!cache.has(name)) { const f = plateFile(base, name); cache.set(name, existsSync(f) ? readPlateTiff(new Uint8Array(readFileSync(f))) : null); }
    return cache.get(name)!;
  };
  const failures: string[] = [], rows: Row[] = [];
  const first = plate('K')!;
  assert.deepEqual([first.width, first.height], [scene.page.width, scene.page.height], 'plate size matches the page at 96 dpi');
  if (pass.plates || pass.inked) {
    const written = platesWritten(readdirSync(dirname(base)), basename(base));
    const maxInk = (name: string): number => regionStats(plate(name), [0, 0, scene.page.width, scene.page.height], scene.page).max;
    const plateFailures = plateSetFailures(written, pass, maxInk);
    rows.push({ region: 'whole page', plate: written.join(','), stat: 'plates', expected: (pass.plates ?? pass.inked ?? []).join(','), got: written.length, ok: plateFailures.length === 0 });
    for (const f of plateFailures) failures.push(`${pass.name} / ${f}`);
  }
  for (const region of pass.regions) {
    for (const b of boundsFor(region, pass.tol, sep.separate as never)) {
      const s = regionStats(plate(b.plate), region.rect, scene.page)[b.stat];
      const ok = s >= b.lo && s <= b.hi;
      rows.push({ region: region.name, plate: b.plate, stat: b.stat, expected: `${fmt(b.lo)}..${fmt(b.hi)}`, got: Math.round(s * 10) / 10, ok });
      if (!ok) failures.push(`${pass.name} / ${region.name} / plate ${b.plate}: ${b.stat} ink ${fmt(s)}%, expected ${fmt(b.lo)} to ${fmt(b.hi)}%`);
    }
    if (region.tac) {
      const peak = maxTotalInk({ C: plate('C'), M: plate('M'), Y: plate('Y'), K: plate('K') }, region.rect, scene.page);
      const ok = peak <= region.tac.max + 0.5;
      rows.push({ region: region.name, plate: 'TAC', stat: 'max', expected: `<=${region.tac.max}`, got: Math.round(peak * 10) / 10, ok });
      if (!ok) failures.push(`${pass.name} / ${region.name}: total ink peaks at ${fmt(peak)}%, limit ${region.tac.max}%`);
    }
  }
  return { failures, rows };
}

async function runScene(scene: Scene): Promise<{ failures: string[]; rows: Row[] }> {
  const pdf = await renderScene(scene);
  const failures: string[] = [], rows: Row[] = [];
  if (scene.structure) {
    const facts = await pdfFacts(new Uint8Array(readFileSync(pdf)), scene.structure.overprintStates ?? []);
    failures.push(...structureFailures(facts, scene.structure).map(f => `structure: ${f}`));
  }
  for (const pass of scene.passes) { const r = await samplePass(scene, pass, pdf); failures.push(...r.failures); rows.push(...r.rows); }
  return { failures, rows };
}

for (const scene of scenes) {
  const name = `${scene.id}: ${scene.title}${scene.knownFailing ? ' (known failing)' : ''}`;
  test(name, { skip: skipFor('gs', 'web shell build'), timeout: 600_000 }, async () => {
    need('gs', 'web shell build');
    const { failures, rows } = await runScene(scene);
    report.push({ id: scene.id, title: scene.title, knownFailing: scene.knownFailing?.reason ?? null, failures, rows });
    if (scene.knownFailing) {
      assert.ok(failures.length > 0, `${scene.id} is marked knownFailing but every check now passes. Remove knownFailing from the scene.`);
      return;
    }
    assert.deepEqual(failures, [], failures.join('\n'));
  });
}
