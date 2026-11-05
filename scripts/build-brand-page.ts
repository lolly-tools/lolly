// SPDX-License-Identifier: MPL-2.0
/**
 * The live example of a brand page: Lolly Demo's page at /brand/lolly-demo/ on a
 * lolly-demo web build (plan 351 B6). It goes through `lolly system publish`, the same
 * path anyone's brand takes, so the example is what the command writes and nothing more.
 *
 * Only the lolly-demo profile builds this page. Any other build removes a stale copy and
 * stops, so another brand's build can never serve the page, and the page can never pull
 * another brand's files in: publish reads the profile it is given and nothing else.
 *
 * The folder goes to shells/web/public/brand/lolly-demo/, which is generated and gitignored,
 * as public/info is, and Vite copies the folder into dist. The hand-written /brand page
 * next to the folder stays as it is. /brand and everything under /brand bypass the service
 * worker, and each nginx config sends /brand/lolly-demo to the form with the slash, because
 * the page's links are relative so that a folder hosted anywhere still works.
 *
 * The web build runs this script, so a page that fails its checks fails the build.
 *
 *   node scripts/build-brand-page.ts                 build, if the profile is lolly-demo
 *   node scripts/build-brand-page.ts --out=<dir>     build into another folder
 *   node scripts/build-brand-page.ts --check <dir>   check a folder that is already built
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentRoots } from '../packages/node-shell/src/content-roots.ts';
import { readBrandPage } from '../packages/node-shell/src/brand-page-read.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE = 'lolly-demo';
const TARGET = join(ROOT, 'shells/web/public/brand', PROFILE);
const ORIGIN = `https://lolly.tools/brand/${PROFILE}`;

/** The ids of Lolly's own marks, which the build publishes as the owner's stated choice. */
export function lollyMarkIds(root = ROOT): string[] {
  const index = JSON.parse(readFileSync(join(root, 'brands', PROFILE, 'catalog/assets/index.json'), 'utf8')) as { assets: Array<{ id: string; deprecated?: boolean }> };
  return index.assets.filter(a => !a.deprecated && a.id.startsWith('lolly/logo/')).map(a => a.id);
}

/** What must hold before this page goes out. Returns each failure in words. */
export async function checkBrandPageFolder(dir: string): Promise<string[]> {
  const problems: string[] = [];
  let page: Awaited<ReturnType<typeof readBrandPage>>;
  try { page = await readBrandPage(dir); } catch (error) { return [(error as Error).message]; }
  const { manifest } = page;
  if (manifest.id !== PROFILE) problems.push(`the page is for "${manifest.id}", not ${PROFILE}`);
  const count = (role: string): number => manifest.files.filter(f => f.role === role).length;
  if (!count('example')) problems.push('no drawn examples: this machine could not draw them');
  if (!count('logo')) problems.push('no logos');
  for (const family of ['outfit', 'suse', 'suse-mono']) {
    if (!manifest.files.some(f => f.role === 'font' && f.path.startsWith(`fonts/${family}-`) && !f.path.endsWith('.txt'))) problems.push(`no font file for ${family}`);
    if (!manifest.files.some(f => f.path === `fonts/${family}-licence.txt`)) problems.push(`no licence text beside the ${family} font`);
  }
  // SUSE the typeface belongs here. SUSE the brand pack's asset ids never do.
  for (const file of manifest.files) {
    if (/(^|\/)suse\//.test(file.path)) problems.push(`${file.path} names a SUSE brand asset`);
    let bytes: Uint8Array;
    try { bytes = await page.file(file.path); } catch (error) { problems.push((error as Error).message); continue; }
    if (file.mediaType.startsWith('text/') || file.mediaType.includes('json') || file.mediaType.includes('svg')) {
      if (/\bsuse\/(logo|tokens|skill|font|demo|fauna|photo)\b/.test(new TextDecoder().decode(bytes))) problems.push(`${file.path} names a SUSE brand asset`);
    }
  }
  return problems;
}

/** The temporary folder can sit on another volume, where a rename is refused. */
function moveFolder(from: string, to: string): void {
  try { renameSync(from, to); return; } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
  }
  cpSync(from, to, { recursive: true });
  if (!existsSync(join(to, 'brand.json'))) throw new Error(`could not copy the folder to ${to}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === '--check') {
    const problems = await checkBrandPageFolder(resolve(args[1] ?? TARGET));
    for (const problem of problems) console.error(`brand page: ${problem}`);
    if (problems.length) process.exit(1);
    console.log('brand page: the folder checks out');
    return;
  }
  const target = resolve(args.find(a => a.startsWith('--out='))?.slice('--out='.length) || TARGET);
  const profile = contentRoots().profile;
  if (profile !== PROFILE) {
    rmSync(target, { recursive: true, force: true });
    console.log(`brand page: skipped, the example is for the ${PROFILE} profile and this build is ${profile}`);
    return;
  }
  const work = mkdtempSync(join(tmpdir(), 'lolly-brand-page-build-'));
  const out = join(work, 'page');
  try {
    const run = spawnSync(process.execPath, [
      join(ROOT, 'shells/cli/bin/lolly.ts'), 'system', 'publish', `--profile=${PROFILE}`, `--out=${out}`, `--origin=${ORIGIN}`,
      `--include=${lollyMarkIds().join(',')}`,
    ], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, LOLLY_PROFILE: PROFILE }, maxBuffer: 16 * 1024 * 1024 });
    if (run.status !== 0) throw new Error(`lolly system publish failed: ${run.stderr || run.stdout}`);
    const problems = await checkBrandPageFolder(out);
    if (problems.length) throw new Error(`the page failed its checks:\n  ${problems.join('\n  ')}`);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(dirname(target), { recursive: true });
    moveFolder(out, target);
    console.log(`brand page: wrote /brand/${PROFILE}/`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: Error) => { console.error(`brand page: ${error.message}`); process.exit(1); });
}
