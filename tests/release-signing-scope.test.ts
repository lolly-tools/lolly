// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { releaseCompilerEnvironment, validateReleaseEnvironment } from '../scripts/build-release-web.ts';
import { verifyFrontendReceipt, writeFrontendReceipt } from '../scripts/release-frontend-receipt.ts';

const source = 'a'.repeat(40);
const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privateMaterial = pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const publicMaterial = JSON.stringify(pair.publicKey.export({ format: 'jwk' }));

function fixture(t: { after(fn: () => void): void }): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lolly-signed-frontend-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'catalog/tools'), { recursive: true });
  writeFileSync(join(root, 'catalog/tools/index.sig.json'), '{}');
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>sample</title>');
  return root;
}
const stamp = (root: string) => writeFrontendReceipt(root, source, 'tauri-desktop', 'lolly-start', privateMaterial, publicMaterial);
const check = (root: string) => verifyFrontendReceipt(root, source, 'tauri-desktop', 'lolly-start', publicMaterial);

test('frontend receipt binds every byte to its source, target, profile and public pin', t => {
  const root = fixture(t); stamp(root); assert.doesNotThrow(() => check(root));
  for (const [sha, target, profile] of [
    ['b'.repeat(40), 'tauri-desktop', 'lolly-start'], [source, 'tauri-mobile', 'lolly-start'], [source, 'tauri-desktop', 'other'],
  ]) assert.throws(() => verifyFrontendReceipt(root, sha!, target!, profile!, publicMaterial), /signature/);
  const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  assert.throws(() => verifyFrontendReceipt(root, source, 'tauri-desktop', 'lolly-start', JSON.stringify(other.publicKey.export({ format: 'jwk' }))), /signature/);
  const receipt = JSON.parse(readFileSync(join(root, 'release-frontend.sig.json'), 'utf8'));
  receipt.source = 'b'.repeat(40);
  writeFileSync(join(root, 'release-frontend.sig.json'), JSON.stringify(receipt));
  assert.throws(() => verifyFrontendReceipt(root, receipt.source, 'tauri-desktop', 'lolly-start', publicMaterial), /signature/);
});

test('signed frontend edits, added files and symbolic links are refused', t => {
  const root = fixture(t); stamp(root);
  writeFileSync(join(root, 'index.html'), '<title>changed</title>');
  assert.throws(() => check(root), /bytes differ/);
  stamp(root);
  writeFileSync(join(root, 'extra.txt'), 'sample');
  assert.throws(() => check(root), /bytes differ/);
  symlinkSync(join(root, 'index.html'), join(root, 'linked.html'));
  assert.throws(() => stamp(root), /symbolic links/);
});

test('frontend compiler environment drops all native and catalog signing credentials', () => {
  const env = {
    PATH: 'sample', VITE_CATALOG_PUBLIC_KEY_JWK: publicMaterial, LOLLY_CATALOG_SIGNING_KEY: privateMaterial,
    IOS_DIST_CERT_P12: 'sample', ASC_KEY_P8: 'sample', APPLE_API_KEY_PATH: '/sample/key', TAURI_SIGNING_PRIVATE_KEY: 'sample',
  };
  const build = releaseCompilerEnvironment(env);
  assert.deepEqual(build, { PATH: 'sample', VITE_CATALOG_PUBLIC_KEY_JWK: publicMaterial });
  assert.ok(env.LOLLY_CATALOG_SIGNING_KEY);
  assert.doesNotThrow(() => validateReleaseEnvironment(build, false));
});

test('release orchestration exposes catalog material only to the signing subprocess', t => {
  const root = fixture(t);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'bin'));
  for (const name of ['build-release-web.ts', 'webgpu-release-gate.ts', 'webgpu-qualification.ts']) {
    writeFileSync(join(root, 'scripts', name), readFileSync(new URL(`../scripts/${name}`, import.meta.url)));
  }
  const record = `import{appendFileSync}from'node:fs';appendFileSync('children.jsonl',JSON.stringify({name:process.argv[1],catalog:process.env.LOLLY_CATALOG_SIGNING_KEY??null,native:process.env.APPLE_API_KEY_PATH??null,pin:process.env.VITE_CATALOG_PUBLIC_KEY_JWK??null})+'\\n');`;
  for (const name of ['sign-catalog.ts', 'build-catalog-renditions.ts', 'verify-release-catalog.ts', 'build-delivery.ts']) writeFileSync(join(root, 'scripts', name), record);
  writeFileSync(join(root, 'bin', 'pnpm'), '#!' + process.execPath + '\n' + record, { mode: 0o755 });
  const result = spawnSync(process.execPath, [join(root, 'scripts/build-release-web.ts'), 'web'], {
    cwd: root, encoding: 'utf8', env: { PATH: join(root, 'bin') + ':' + process.env.PATH,
      LOLLY_CATALOG_SIGNING_KEY: 'sample-catalog', APPLE_API_KEY_PATH: 'sample-native', VITE_CATALOG_PUBLIC_KEY_JWK: publicMaterial },
  });
  assert.equal(result.status, 0, result.stderr);
  const records = readFileSync(join(root, 'children.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(records.filter(child => child.name.endsWith('/sign-catalog.ts')).length, 2);
  for (const child of records) {
    assert.equal(child.catalog, child.name.endsWith('/sign-catalog.ts') ? 'sample-catalog' : null);
    assert.equal(child.native, null);
    assert.equal(child.pin, publicMaterial);
  }
});

test('native packaging jobs receive signed artifacts and signing jobs run no compilers', () => {
  const read = (name: string) => parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));
  const reusable = read('release-frontend');
  for (const name of ['source-catalog', 'sign-artifact']) {
    const job = reusable.jobs[name];
    assert.equal(job.environment, 'release-catalog-signing');
    assert.ok(job.steps.some((step: any) => step.env?.LOLLY_CATALOG_SIGNING_KEY));
    for (const step of job.steps) assert.doesNotMatch(step.run ?? '', /\b(?:pnpm|npm|cargo|vite|tauri)\b/);
  }
  assert.equal(reusable.jobs.compile.environment, undefined);
  assert.equal(reusable.jobs.compile.needs, 'source-catalog');
  assert.ok(reusable.jobs.compile.steps.every((step: any) => !step.env?.LOLLY_CATALOG_SIGNING_KEY));
  for (const name of ['flatpak', 'linux-arm64', 'linux-rpm', 'desktop-extra', 'macos-intel', 'ios-release']) {
    const workflow = read(name), job = workflow.jobs[name === 'flatpak' ? 'build-deb' : 'build'];
    assert.equal(workflow.jobs.frontend.uses, './.github/workflows/release-frontend.yml');
    assert.equal(job.needs, 'frontend');
    assert.equal(job.env.LOLLY_RELEASE_FRONTEND_PHASE, 'verified-artifact');
    assert.equal(job.env.LOLLY_CATALOG_SIGNING_KEY, undefined);
    assert.ok(job.steps.every((step: any) => !step.env?.LOLLY_CATALOG_SIGNING_KEY));
    assert.ok(job.steps.some((step: any) => step.with?.name?.startsWith('release-frontend-')));
    assert.equal(workflow.permissions.contents, 'read');
    if (name === 'ios-release') assert.equal(job.environment, 'release-native-signing');
  }
});
