// SPDX-License-Identifier: MPL-2.0
/**
 * The live example at /brand/lolly-demo/ (plan 351 B6). This runs the same step a web
 * build runs, so a lane that never builds the lolly-demo profile still proves the page
 * would build and pass its checks, with examples drawn and fonts carrying their licences.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { after, before, test } from 'node:test';

import { OWNER_PUBLISHED, redistribution } from '../engine/src/asset-rights.ts';
import { checkBrandPageFolder, lollyMarkIds } from '../scripts/build-brand-page.ts';

const ROOT = resolve(import.meta.dirname, '..');
const SCRIPT = join(ROOT, 'scripts/build-brand-page.ts');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

function build(args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise(done => {
    execFile(process.execPath, [SCRIPT, ...args], { cwd: ROOT, env: { ...process.env, ...env }, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      done({ code: error ? Number((error as { code?: number }).code ?? 1) : 0, stdout, stderr });
    });
  });
}

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path, base) : [relative(base, path)];
  });
}

let root = '';
let page = '';
let built = { code: 1, stdout: '', stderr: '' };

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'lolly-brand-page-example-'));
  page = join(root, 'page');
  built = await build([`--out=${page}`], { LOLLY_PROFILE: 'lolly-demo', LOLLY_STATE_DIR: join(root, 'state') });
});
after(() => { rmSync(root, { recursive: true, force: true }); });

test('the web build step writes the Lolly Demo page, and it passes its checks', async () => {
  assert.equal(built.code, 0, built.stderr);
  assert.match(built.stdout, /wrote \/brand\/lolly-demo\//);
  assert.deepEqual(await checkBrandPageFolder(page), []);
  const manifest = JSON.parse(readFileSync(join(page, 'brand.json'), 'utf8'));
  assert.equal(manifest.id, 'lolly-demo');
  assert.equal(manifest.origin, 'https://lolly.tools/brand/lolly-demo');
});

test('every font travels on its recorded licence, with the text beside it', () => {
  const manifest = JSON.parse(readFileSync(join(page, 'brand.json'), 'utf8'));
  assert.ok(!manifest.held.some((h: { item: string }) => /^Font /.test(h.item)), 'no font is held back');
  const html = readFileSync(join(page, 'index.html'), 'utf8');
  for (const family of ['outfit', 'suse', 'suse-mono']) {
    assert.ok(existsSync(join(page, `fonts/${family}-licence.txt`)), family);
    assert.match(readFileSync(join(page, `fonts/${family}-licence.txt`), 'utf8'), /SIL OPEN FONT LICENSE/i);
    assert.ok(html.includes(`fonts/${family}-licence.txt`), `the page links to the ${family} licence`);
    assert.ok(html.includes(`fonts/${family}-100-900-normal.ttf`), `the ${family} font link names the upright file`);
  }
});

const MARKS_STATEMENT = "The Lolly name and marks belong to Andy Fitzsimon. They are not under an open licence: the Mozilla Public License 2.0 on Lolly's source code grants no rights in them (section 2.3). You may show these files unaltered to refer to Lolly. For any other use, ask at https://github.com/lolly-tools/lolly/issues.";

test('each Lolly mark records its owner and terms, not an open licence', () => {
  const index = JSON.parse(read('brands/lolly-demo/catalog/assets/index.json')) as { assets: Array<Record<string, unknown> & { id: string }> };
  const marks = index.assets.filter(a => a.id.startsWith('lolly/logo/'));
  assert.equal(marks.length, 7);
  for (const mark of marks) {
    assert.equal(mark.license, 'LicenseRef-Lolly-Marks', mark.id);
    const answer = redistribution(mark);
    assert.equal(answer.travels, true, mark.id);
    assert.equal(answer.licence, OWNER_PUBLISHED, mark.id);
    assert.deepEqual(answer.owner, { holder: 'Andy Fitzsimon', terms: MARKS_STATEMENT }, mark.id);
    assert.ok(answer.notices.includes(MARKS_STATEMENT), mark.id);
  }
});

test('Lolly\'s own marks are published with their terms and no --include, and "Made with Lolly" is on', () => {
  const manifest = JSON.parse(readFileSync(join(page, 'brand.json'), 'utf8'));
  assert.equal(lollyMarkIds().length, 7);
  for (const id of lollyMarkIds()) assert.ok(manifest.logos.some((l: { id: string; licence?: string }) => l.id === id && l.licence === OWNER_PUBLISHED), id);
  assert.ok(!manifest.held.some((h: { item: string }) => h.item.startsWith('lolly/logo/')), 'no mark is held back');
  assert.equal(manifest.usage.statement, MARKS_STATEMENT);
  assert.ok(!read('scripts/build-brand-page.ts').includes('--include'), 'the build states no include');
  const html = readFileSync(join(page, 'index.html'), 'utf8');
  assert.match(html, /<section id="usage"><h2>Using this brand<\/h2>/);
  assert.ok(html.includes(MARKS_STATEMENT.replaceAll("'", '&#39;')) || html.includes(MARKS_STATEMENT), 'the page shows the exact statement');
  assert.match(html, /Owner-published, not an open licence\. <a href="#usage">/);
  const primaries = manifest.logos.filter((l: { primary?: boolean }) => l.primary).map((l: { id: string }) => l.id).sort();
  assert.deepEqual(primaries, ['lolly/logo/horizontal', 'lolly/logo/horizontal-reverse'], 'a reader takes the logo the brand declares for each surface');
  assert.match(readFileSync(join(page, 'index.html'), 'utf8'), /Made with <a href="https:\/\/lolly\.tools\/"/);
});

test('nothing in the page comes from another brand pack', () => {
  const files = walk(page);
  assert.ok(files.length > 40);
  for (const file of files) assert.doesNotMatch(file, /(^|\/)suse\//, file);
  for (const file of files.filter(f => /\.(html|md|json|txt|svg|css)$/.test(f))) {
    assert.doesNotMatch(readFileSync(join(page, file), 'utf8'), /\bsuse\/(logo|tokens|skill|font|demo|fauna|photo)\b|brands\/suse/, file);
  }
});

test('a page that names a SUSE asset, or a file that changed, fails the check', async () => {
  const copy = join(root, 'tampered');
  const { cpSync } = await import('node:fs');
  cpSync(page, copy, { recursive: true });
  const css = join(copy, 'assets/page.css');
  writeFileSync(css, `${readFileSync(css, 'utf8')}/* changed */`);
  assert.ok((await checkBrandPageFolder(copy)).some(p => /does not match its digest/.test(p)));
  writeFileSync(css, readFileSync(join(page, 'assets/page.css')));

  // Re-seal the file row, so only the SUSE id is left for the check to find.
  const llms = join(copy, 'llms.txt');
  const changed = Buffer.from(`${readFileSync(llms, 'utf8')}\nsuse/logo/primary\n`);
  writeFileSync(llms, changed);
  const { brandPageDigest } = await import('../engine/src/brand-page.ts');
  const manifest = JSON.parse(readFileSync(join(copy, 'brand.json'), 'utf8'));
  const row = manifest.files.find((f: { path: string }) => f.path === 'llms.txt');
  row.sha256 = createHash('sha256').update(changed).digest('hex');
  row.size = changed.byteLength;
  manifest.digest = await brandPageDigest(manifest);
  writeFileSync(join(copy, 'brand.json'), JSON.stringify(manifest));
  assert.ok((await checkBrandPageFolder(copy)).some(p => /names a SUSE brand asset/.test(p)));
});

test('any other profile skips the step and removes a stale copy', async () => {
  const stale = join(root, 'stale');
  const { mkdirSync } = await import('node:fs');
  mkdirSync(stale);
  writeFileSync(join(stale, 'index.html'), 'old');
  const run = await build([`--out=${stale}`], { LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(root, 'state') });
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /skipped/);
  assert.ok(!existsSync(stale), 'a lolly-start build cannot serve this page');
});

test('the web build runs the step, the output is generated, and every host serves the address', () => {
  const buildWeb = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts['build:web']!;
  assert.ok(buildWeb.indexOf('build-brand-page.ts') > -1 && buildWeb.indexOf('build-brand-page.ts') < buildWeb.indexOf('--filter ./shells/web run build'), 'the page is written before Vite copies public/');
  assert.match(read('.gitignore'), /^shells\/web\/public\/brand\/lolly-demo\/$/m);
  assert.match(read('shells/web/public/sw.js'), /\^\\\/brand\(\?:\\\/\|\$\)/, 'the service worker leaves /brand and all under it to the network');
  for (const conf of ['deploy/helm/profiles/sovereign/files/public.nginx.conf', 'deploy/docker/public.nginx.conf', 'deploy/docker/nginx.conf', 'shells/web/rpm/lolly-web.nginx.conf', 'deploy/yunohost/conf/nginx.conf']) {
    assert.match(read(conf), /location = \/brand\/lolly-demo \{ absolute_redirect off; return 308 \/brand\/lolly-demo\/\$is_args\$args; \}/, `${conf}: relative links need the slash, and the inner port must not reach the address`);
  }
  const standards = read('shells/web/public/brand/index.html');
  assert.match(standards, /<a href="https:\/\/lolly\.tools\/brand\/lolly-demo\/">/, 'the standards page links to the example');
});
