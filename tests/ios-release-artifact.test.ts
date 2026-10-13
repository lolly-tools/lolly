// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const expression = (value: string) => '$' + '{{ ' + value + ' }}';

test('native archive and profile validators qualify artifact admission without live credentials', {
  skip: process.platform === 'win32' ? 'archive permission checks require a Unix filesystem' : false,
}, () => {
  const result = spawnSync('python3', ['-I', fileURLToPath(new URL('./ios-release-artifact-fixture.py', import.meta.url)), '-v'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /Ran 16 tests/);
});

test('the native compiler has no signing environment or release credentials', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/ios-release.yml', import.meta.url), 'utf8'));
  const build = workflow.jobs.build;
  assert.equal(build.environment, undefined);
  assert.equal(build.needs, 'frontend');
  assert.match(build.steps.find((step: any) => step.name === 'Compile an unsigned device archive').run, /--no-sign --archive-only/);
  for (const step of build.steps) {
    assert.doesNotMatch(JSON.stringify(step), /secrets\.|security (?:import|create-keychain)|APPLE_API_|IOS_DIST_CERT|ASC_KEY/);
  }
  assert.ok(build.outputs.archive_id.includes('artifact-id'));
  assert.ok(build.outputs.receipt_sha.includes('receipt_sha'));
});

test('protected signing consumes the immutable run artifact and verifies before keys are exposed', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/ios-release.yml', import.meta.url), 'utf8'));
  const sign = workflow.jobs.sign;
  assert.deepEqual(sign.needs, ['frontend', 'build']);
  assert.equal(sign.environment, 'release-native-signing');
  assert.ok(sign.steps.some((step: any) => step.with?.['artifact-ids'] === expression('needs.build.outputs.archive_id')));
  const verification = sign.steps.findIndex((step: any) => step.run?.includes('ios-release-artifact.py verify'));
  const privateAccess = sign.steps.findIndex((step: any) => step.env?.IOS_DIST_CERT_P12);
  assert.ok(verification >= 0 && privateAccess > verification);
  assert.match(sign.steps[verification].run, /release-frontend-receipt.ts --verify tauri-mobile/);
  assert.match(sign.steps[verification].run, /git rev-parse HEAD/);
  assert.equal(sign.steps[privateAccess].env.IOS_APP_STORE_PROFILE, expression('secrets.IOS_APP_STORE_PROFILE'));
  assert.ok(sign.steps.slice(privateAccess).every((step: any) => !/\b(?:node|pnpm|npm|cargo|tauri|rustup)\b/.test(step.run ?? '')));
  assert.ok(sign.steps.every((step: any) => !/^\s*(?:pnpm|npm|cargo|tauri|rustup)(?:\s|$)/m.test(step.run ?? '')));
  for (const job of [workflow.jobs.build, sign]) {
    for (const step of job.steps) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
    assert.equal(job.steps.find((step: any) => step.uses?.startsWith('actions/checkout@')).with.ref, expression('github.sha'));
  }
});

test('artifact signing has no project build or native code execution path', () => {
  const source = readFileSync(new URL('../scripts/ios-release-artifact.py', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('def sign(args):'), source.indexOf('def upload(args):'));
  assert.match(body, /"-exportArchive", "-archivePath"/);
  assert.doesNotMatch(body, /"-project"|"-workspace"|"-scheme"|"-allowProvisioningUpdates"|"cargo"|"node"|"pnpm"|"tauri"/);
  assert.match(body, /finally:/);
  assert.match(body, /"delete-keychain"/);
  assert.match(body, /Signing credential cleanup failed/);
  assert.match(body, /profile\.unlink\(missing_ok=True\)/);
  assert.match(source, /private_key_dir=temporary/);
  assert.doesNotMatch(source, /GITHUB_ENV|APPLE_API_KEY_PATH/);
});
