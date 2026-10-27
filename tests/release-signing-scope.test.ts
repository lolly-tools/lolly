// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { releaseCompilerEnvironment, validateReleaseEnvironment } from '../scripts/build-release-web.ts';
import { verifyFrontendReceipt, writeFrontendReceipt } from '../scripts/release-frontend-receipt.ts';
import { checkSigningScope, pinsMatch } from '../scripts/check-signing-scope.ts';

// GitHub expression text, built so it is not mistaken for a template string.
const gh = (body: string): string => '$' + `{{ ${body} }}`;
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
  mkdirSync(join(root, 'packages/core/src'), { recursive: true });
  writeFileSync(join(root, 'packages/core/src/connector-origins.ts'), readFileSync(new URL('../packages/core/src/connector-origins.ts', import.meta.url)));
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
    assert.equal(job.environment, gh('inputs.signing_environment'));
    assert.ok(job.steps.some((step: any) => step.env?.LOLLY_CATALOG_SIGNING_KEY));
    for (const step of job.steps) assert.doesNotMatch(step.run ?? '', /\b(?:pnpm|npm|cargo|vite|tauri)\b/);
  }
  assert.equal(reusable.jobs.compile.environment, undefined);
  assert.deepEqual(reusable.jobs.compile.needs, ['plan', 'source-catalog']);
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
    if (name === 'ios-release') {
      assert.equal(job.environment, undefined);
      assert.equal(workflow.jobs.sign.environment, 'release-native-signing');
      assert.deepEqual(workflow.jobs.sign.needs, ['frontend', 'build']);
    }
  }
});

// The release signing secrets are environment secrets, never repository secrets. A job
// can read one only by naming its gated environment, and no job may read the whole
// secrets context. A new reader has to be added here on purpose. GitHub hands an
// environment secret to a called workflow only when the caller passes it by name (an
// unpassed one is an empty string, runs 40079348093 and 40105124697), so each caller
// of release-frontend.yml passes, by name, only the key of the environment it signs in.
// The called job whose `environment:` is that environment then receives its value.
const SIGNING_SECRETS: Record<string, string> = {
  LOLLY_CATALOG_SIGNING_KEY: 'release-catalog-signing',
  IOS_DIST_CERT_P12: 'release-native-signing',
  IOS_DIST_CERT_PASSWORD: 'release-native-signing',
  IOS_APP_STORE_PROFILE: 'release-native-signing',
  ASC_KEY_P8: 'release-native-signing',
  ASC_KEY_ID: 'release-native-signing',
  ASC_ISSUER_ID: 'release-native-signing',
  LOLLY_PREVIEW_CATALOG_SIGNING_KEY: 'preview-catalog-signing',
};
const SIGNING_EXPRESSION = gh('inputs.signing_environment');

test('release signing secrets reach only the jobs that name their gated environment', () => {
  const directory = new URL('../.github/workflows/', import.meta.url);
  const readers: string[] = [];
  const callers: string[] = [];
  for (const file of readdirSync(directory).filter(name => /\.ya?ml$/.test(name)).sort()) {
    const workflow = parse(readFileSync(new URL(file, directory), 'utf8'));
    assert.doesNotMatch(JSON.stringify(workflow), /toJSON\(\s*secrets\s*\)|secrets\s*\[/, `${file} reads the secrets context dynamically`);
    for (const name of Object.keys(SIGNING_SECRETS)) {
      assert.doesNotMatch(JSON.stringify(workflow.env ?? {}), new RegExp(`\\bsecrets\\.${name}\\b`), `${file} sets ${name} for every job`);
    }
    for (const [id, job] of Object.entries<any>(workflow.jobs ?? {})) {
      if (job.uses) {
        assert.notEqual(job.secrets, 'inherit', `${file} ${id} passes every secret to ${job.uses}`);
        if (job.uses === './.github/workflows/release-frontend.yml') {
          const key = job.with?.signing_environment === 'preview-catalog-signing' ? 'LOLLY_PREVIEW_CATALOG_SIGNING_KEY' : 'LOLLY_CATALOG_SIGNING_KEY';
          assert.deepEqual(Object.keys(job.secrets ?? {}), [key], `${file} ${id} must pass ${key} and nothing else`);
          assert.match(String(job.secrets[key]), new RegExp(`^\\$\\{\\{ secrets\\.${key} \\}\\}$`), `${file} ${id} must pass ${key} by name`);
          callers.push(`${file} ${id} ${key}`);
        } else {
          for (const name of Object.keys(SIGNING_SECRETS)) {
            assert.equal(job.secrets?.[name], undefined, `${file} ${id} passes ${name} to ${job.uses}`);
          }
        }
      }
      const environment = typeof job.environment === 'string' ? job.environment : job.environment?.name;
      // A caller's `secrets:` block is checked above. Any other mention of a signing
      // secret (a `with:` input, a step) still has to sit in the owning environment.
      const text = JSON.stringify(job.uses ? { ...job, secrets: undefined } : job);
      for (const [name, owner] of Object.entries(SIGNING_SECRETS)) {
        if (!new RegExp(`\\bsecrets\\.${name}\\b`).test(text)) continue;
        // Only release-frontend.yml picks its environment from an input, and each of its
        // steps reads only the secret of the environment its own condition names (below).
        if (file === 'release-frontend.yml' && environment === SIGNING_EXPRESSION) {
          assert.ok(['release-catalog-signing', 'preview-catalog-signing'].includes(owner), `${file} ${id} reads ${name}`);
        } else {
          assert.equal(environment, owner, `${file} ${id} reads ${name} outside ${owner}`);
        }
        readers.push(`${file} ${id} ${name}`);
      }
    }
  }
  assert.deepEqual(readers, [
    'ios-release.yml sign IOS_DIST_CERT_P12',
    'ios-release.yml sign IOS_DIST_CERT_PASSWORD',
    'ios-release.yml sign IOS_APP_STORE_PROFILE',
    'ios-release.yml sign ASC_KEY_P8',
    'ios-release.yml sign ASC_KEY_ID',
    'ios-release.yml sign ASC_ISSUER_ID',
    'release-frontend.yml source-catalog LOLLY_CATALOG_SIGNING_KEY',
    'release-frontend.yml source-catalog LOLLY_PREVIEW_CATALOG_SIGNING_KEY',
    'release-frontend.yml sign-artifact LOLLY_CATALOG_SIGNING_KEY',
    'release-frontend.yml sign-artifact LOLLY_PREVIEW_CATALOG_SIGNING_KEY',
  ]);
  assert.deepEqual(callers, [
    'deployment-suse.yml web-frontend LOLLY_CATALOG_SIGNING_KEY',
    'desktop-extra.yml frontend LOLLY_CATALOG_SIGNING_KEY',
    'flatpak.yml frontend LOLLY_CATALOG_SIGNING_KEY',
    'ios-release.yml frontend LOLLY_CATALOG_SIGNING_KEY',
    'linux-arm64.yml frontend LOLLY_CATALOG_SIGNING_KEY',
    'linux-rpm.yml frontend LOLLY_CATALOG_SIGNING_KEY',
    'macos-intel.yml frontend LOLLY_CATALOG_SIGNING_KEY',
    'preview-web.yml web-frontend LOLLY_PREVIEW_CATALOG_SIGNING_KEY',
  ]);
  // release-frontend.yml declares both keys, neither required, because each caller
  // passes only its own; a missing key still stops the run in sign-catalog.ts. No
  // other reusable workflow declares a signing secret.
  for (const file of readdirSync(directory).filter(name => /\.ya?ml$/.test(name))) {
    const call = parse(readFileSync(new URL(file, directory), 'utf8'))?.on?.workflow_call;
    if (!call) continue;
    if (file === 'release-frontend.yml') {
      assert.deepEqual(call.secrets, { LOLLY_CATALOG_SIGNING_KEY: { required: false }, LOLLY_PREVIEW_CATALOG_SIGNING_KEY: { required: false } });
    } else {
      for (const name of Object.keys(SIGNING_SECRETS)) assert.equal(call.secrets?.[name], undefined, `${file} declares ${name}`);
    }
  }
});

// Virtual retained files exercise the real signer/reader without allocating a
// hundred thousand disposable filesystem entries on developer and CI machines.
test('frontend receipts accept 150000 total entries and refuse the next retained entry', t => {
  const root = fixture(t);
  const originalRead = fs.readFileSync, originalList = fs.readdirSync, originalStat = fs.lstatSync;
  const regularFile = originalStat(join(root, 'index.html'));
  let retainedCount = 150000 - 4; // catalog/, tools/, index.sig.json and index.html.
  const retained = (path: unknown) => typeof path === 'string' && path.startsWith(join(root, 'retained-'));
  t.mock.method(fs, 'readdirSync', (path: unknown, ...args: unknown[]) => path === root
    ? ['catalog', 'index.html', ...Array.from({ length: retainedCount }, (_, i) => `retained-${i}.js`)]
    : Reflect.apply(originalList, fs, [path, ...args]));
  t.mock.method(fs, 'lstatSync', (path: unknown, ...args: unknown[]) => retained(path)
    ? regularFile : Reflect.apply(originalStat, fs, [path, ...args]));
  t.mock.method(fs, 'readFileSync', (path: unknown, ...args: unknown[]) => retained(path)
    ? Buffer.from('retained immutable bytes') : Reflect.apply(originalRead, fs, [path, ...args]));
  syncBuiltinESMExports();
  try {
    stamp(root);
    check(root);
    const receipt = JSON.parse(originalRead(join(root, 'release-frontend.sig.json'), 'utf8'));
    assert.equal(Object.keys(receipt.files).length, 149998); // Directories consume the same bound.
    retainedCount++;
    assert.throws(() => stamp(root), /frontend directory is invalid/);
    assert.throws(() => check(root), /frontend directory is invalid/);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

// Preview signing route (Phase 1b of the preview fast-deploy design). The preview key signs only the
// lolly.tools web shell, from main, in an environment with no reviewer. These tests keep it from
// ever touching a release, and keep every release path away from the preview route.
const workflowsDirectory = new URL('../.github/workflows/', import.meta.url);
const workflowText = (name: string) => readFileSync(new URL(name, workflowsDirectory), 'utf8');
const workflowYaml = (name: string) => parse(workflowText(name));
const RELEASE_ENVIRONMENT = 'release-catalog-signing', PREVIEW_ENVIRONMENT = 'preview-catalog-signing';

test('release-frontend accepts exactly two signing environments and defaults to the release one', () => {
  const reusable = workflowYaml('release-frontend.yml');
  const inputs = reusable.on.workflow_call.inputs;
  assert.equal(inputs.signing_environment.default, RELEASE_ENVIRONMENT);
  assert.equal(inputs.source.default, '');
  const plan = JSON.stringify(reusable.jobs.plan);
  assert.match(plan, /release-catalog-signing\)/);
  assert.match(plan, /preview-catalog-signing\)/);
  assert.match(plan, /\*\) echo '::error::Unknown signing environment'; exit 1/);
  assert.match(plan, /merge-base --is-ancestor \\"\$source\\" refs\/remotes\/origin\/main/);
  assert.match(plan, /\^\[a-f0-9\]\{40\}\$/);
  // Deleting either preview guard must fail the suite.
  const planRun = reusable.jobs.plan.steps.map((step: any) => step.run ?? '').join('\n');
  assert.ok(planRun.includes('test "$GITHUB_REF" = refs/heads/main'), 'plan must keep the main-only guard for the preview environment');
  assert.ok(planRun.includes('test -z "$PIN_INPUT"'), 'plan must keep the rule that a preview caller passes no pin');
  assert.equal(reusable.jobs.plan.environment, undefined);
  // Every environment job waits for the plan, so an unknown name never reaches an environment.
  for (const name of ['source-catalog', 'sign-artifact']) {
    assert.ok([reusable.jobs[name].needs].flat().includes('plan'), `${name} must wait for plan`);
    assert.equal(reusable.jobs[name].environment, SIGNING_EXPRESSION);
  }
  // The environment names are the only two that appear in the file.
  assert.deepEqual([...new Set(workflowText('release-frontend.yml').match(/[a-z]+-catalog-signing/g))].sort(), [PREVIEW_ENVIRONMENT, RELEASE_ENVIRONMENT]);
  // The sequence floor is validated and reaches only the final catalog signing.
  assert.match(plan, /MIN_SEQ/);
  const sign = reusable.jobs['sign-artifact'].steps.filter((step: any) => /^Sign frontend catalog/.test(step.name ?? ''));
  assert.equal(sign.length, 2);
  for (const step of sign) assert.match(step.run, /\$\{MIN_SEQ:\+--min-seq "\$MIN_SEQ"\}/);
});

test('each signing step reads only the key of the environment its own condition names', () => {
  const reusable = workflowYaml('release-frontend.yml');
  const conditions: Record<string, string> = {
    LOLLY_CATALOG_SIGNING_KEY: `inputs.signing_environment == '${RELEASE_ENVIRONMENT}'`,
    LOLLY_PREVIEW_CATALOG_SIGNING_KEY: `inputs.signing_environment == '${PREVIEW_ENVIRONMENT}'`,
  };
  let steps = 0;
  for (const name of ['source-catalog', 'sign-artifact']) {
    for (const step of reusable.jobs[name].steps) {
      const used = Object.keys(conditions).filter(secret => new RegExp(`\\bsecrets\\.${secret}\\b`).test(JSON.stringify(step)));
      if (!used.length) continue;
      steps++;
      assert.equal(used.length, 1, `${name} ${step.name} reads both keys`);
      assert.equal(step.if, conditions[used[0]!], `${name} ${step.name} is not bound to its environment`);
      assert.equal(step.env.LOLLY_CATALOG_SIGNING_KEY, `\${{ secrets.${used[0]} }}`);
    }
    // The pin check runs before any key is used.
    const names = reusable.jobs[name].steps.map((step: any) => step.name ?? '');
    const check = names.findIndex((value: string) => /^Check the signing scope/.test(value));
    const firstSign = reusable.jobs[name].steps.findIndex((step: any) => /secrets\./.test(JSON.stringify(step)));
    assert.ok(check >= 0 && check < firstSign, `${name} checks the pin before it signs`);
    // The signer is given the pin it must match; sign-catalog.ts refuses any other key.
    assert.match(reusable.jobs[name].env.VITE_CATALOG_PUBLIC_KEY_JWK, /vars\.LOLLY_PREVIEW_PUBLIC_KEY_JWK \|\| inputs\.public_key_jwk/);
  }
  assert.equal(steps, 6); // source catalog, final catalog and receipt, each once per environment
  // Build jobs hold no key and read the preview variable never: they take the checked pin from the signer.
  assert.equal(reusable.jobs.compile.env.VITE_CATALOG_PUBLIC_KEY_JWK, gh('needs.source-catalog.outputs.pin'));
  assert.doesNotMatch(JSON.stringify(reusable.jobs.compile), /LOLLY_PREVIEW|secrets\./);
  assert.doesNotMatch(JSON.stringify(reusable.jobs.plan), /secrets\./);
  assert.equal(reusable.env.VITE_CATALOG_PUBLIC_KEY_JWK, undefined);
});

test('the preview workflow can never reach the release environment or release secrets', () => {
  const text = workflowText('preview-web.yml'), workflow = workflowYaml('preview-web.yml');
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs).sort(), ['min_seq', 'source']);
  const code = text.replace(/^\s*#.*$/gm, '');
  assert.doesNotMatch(code, /release-catalog-signing|release-native-signing|release-images|LOLLY_CATALOG_SIGNING_KEY|IOS_DIST|ASC_KEY|ASC_ISSUER|GHCR_PAT/);
  // Its only secret reference passes the preview key by name to the signer.
  assert.deepEqual(code.match(/\bsecrets\.[A-Z0-9_]+/g), ['secrets.LOLLY_PREVIEW_CATALOG_SIGNING_KEY']);
  assert.doesNotMatch(text, /secrets:\s*inherit/);
  for (const [id, job] of Object.entries<any>(workflow.jobs)) {
    assert.equal(job.environment, undefined, `${id} names an environment`);
    if (id !== 'web-frontend') assert.equal(job.secrets, undefined, `${id} passes secrets`);
  }
  assert.deepEqual(Object.keys(workflow.jobs['web-frontend'].secrets), ['LOLLY_PREVIEW_CATALOG_SIGNING_KEY']);
  const frontend = workflow.jobs['web-frontend'];
  assert.equal(frontend.uses, './.github/workflows/release-frontend.yml');
  assert.equal(frontend.with.signing_environment, PREVIEW_ENVIRONMENT);
  assert.equal(frontend.with.public_key_jwk, undefined, 'the preview pin comes only from its environment variable');
  assert.equal(frontend.with.source, gh('inputs.source'));
  // Main only, like the environment's deployment branch rule.
  assert.equal(workflow.jobs['source-qualification'].if, "github.ref == 'refs/heads/main'");
  // The WebGPU gate runs inside the qualification job, so nothing is signed before it has passed.
  const gate = workflow.jobs['source-qualification'].steps.findIndex((step: any) => step.run === 'node scripts/webgpu-release-gate.ts --scope web');
  assert.ok(gate > 0, 'source-qualification asks the WebGPU release gate');
  assert.equal(workflow.jobs['web-release-gate'], undefined);
  for (const id of ['web-frontend', 'web-image', 'publish']) assert.ok(JSON.stringify(workflow.jobs[id].needs).includes('source-qualification'), id);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.permissions.packages, undefined);
});

test('release workflows never reference the preview environment, key or pin', () => {
  const directory = new URL('../.github/workflows/', import.meta.url);
  for (const file of readdirSync(directory).filter(name => /\.ya?ml$/.test(name))) {
    const text = workflowText(file);
    if (file === 'preview-web.yml' || file === 'release-frontend.yml') continue;
    assert.doesNotMatch(text, /preview-catalog-signing|LOLLY_PREVIEW|lolly-web-preview|signing_environment/, `${file} references the preview route`);
  }
  // Callers of the reusable workflow keep the release default and the release pin.
  for (const file of ['desktop-extra', 'ios-release', 'linux-rpm', 'flatpak', 'linux-arm64', 'macos-intel', 'deployment-suse']) {
    const text = workflowText(`${file}.yml`);
    assert.match(text, /uses: \.\/\.github\/workflows\/release-frontend\.yml/);
  }
  for (const file of ['desktop-extra', 'ios-release', 'linux-rpm', 'flatpak', 'linux-arm64', 'macos-intel']) {
    // Every native and app build embeds the release pin and nothing else (R22 S14).
    assert.match(workflowText(`${file}.yml`), /public_key_jwk: \$\{\{ vars\.VITE_CATALOG_PUBLIC_KEY_JWK \}\}/, file);
  }
  assert.match(workflowText('deployment-suse.yml'), /public_key_jwk: \$\{\{ inputs\.public_key_jwk \}\}/);
  // The preview pin never leaves the signer's environment, except as the checked output.
  assert.deepEqual(
    [...workflowText('release-frontend.yml').matchAll(/vars\.LOLLY_PREVIEW_PUBLIC_KEY_JWK/g)].length, 2);
});

test('only the preview publish job can write packages, runs no npm, and pushes by digest to its own package', () => {
  const workflow = workflowYaml('preview-web.yml'), text = workflowText('preview-web.yml');
  const writers = Object.entries<any>(workflow.jobs).filter(([, job]) => job.permissions?.packages === 'write').map(([id]) => id);
  assert.deepEqual(writers, ['publish']);
  const publish = workflow.jobs.publish;
  assert.ok(publish.steps.every((step: any) => !/actions\/checkout|setup-node|pnpm|npm|node |scripts\//.test(`${step.uses ?? ''} ${step.run ?? ''}`)), 'publish runs no repository code');
  assert.match(publish.steps.map((step: any) => step.run ?? '').join('\n'), /sha256sum --check/);
  const push = publish.steps.find((step: any) => /crane push/.test(step.run ?? '')).run;
  assert.match(push, /ghcr\.io\/\$owner\/lolly-web-preview/);
  assert.match(push, /crane push "[^"]+" "\$repository@\$digest"/);
  assert.doesNotMatch(text, /lolly-web:|lolly-web@|:latest|crane tag|candidate-|docker push|docker login/);
  assert.doesNotMatch(text.replace(/lolly-web-preview/g, ''), /ghcr\.io\/\$owner\/lolly-web/);
  assert.doesNotMatch(JSON.stringify(workflow.jobs['web-image']), /packages|docker push|crane/);
  assert.equal(workflow.jobs['web-image'].permissions.packages, undefined);
  assert.match(text, /org\.opencontainers\.image\.title=lolly-web-preview/);
});

test('the preview publish job signs the pushed digest keylessly, under its own workflow identity', () => {
  const workflow = workflowYaml('preview-web.yml');
  const holders = Object.entries<any>(workflow.jobs).filter(([, job]) => job.permissions?.['id-token'] === 'write').map(([id]) => id);
  assert.deepEqual(holders, ['publish'], 'only the publish job can mint a signing identity');
  const steps = workflow.jobs.publish.steps;
  assert.ok(steps.some((step: any) => /^sigstore\/cosign-installer@[0-9a-f]{40}$/.test(step.uses ?? '')), 'cosign comes from the pinned installer');
  const push: string = steps.find((step: any) => /crane push/.test(step.run ?? '')).run;
  assert.ok(push.indexOf('cosign sign "$repository@$digest"') > push.indexOf('crane push'), 'the signature is made after the push, by digest');
  assert.match(push, /identity="\$GITHUB_SERVER_URL\/\$GITHUB_WORKFLOW_REF"/);
  assert.match(push, /cosign verify "\$repository@\$digest" \\\n\s+--certificate-identity "\$identity" --certificate-oidc-issuer https:\/\/token\.actions\.githubusercontent\.com/);
  assert.doesNotMatch(push, /cosign sign[^\n]*--key/, 'no signing key');
});

test('the preview web build keeps the release build arguments, connector origins, CA trust and live relay', () => {
  const release = workflowYaml('deployment-suse.yml').jobs['web-frontend'].with;
  const preview = workflowYaml('preview-web.yml').jobs['web-frontend'].with;
  const own = new Set(['public_key_jwk', 'signing_environment', 'source', 'min_seq']);
  const strip = (value: Record<string, string>) => Object.fromEntries(Object.entries(value).filter(([key]) => !own.has(key)));
  assert.deepEqual(strip(preview), strip(release));
  for (const key of ['connector_origins', 'ca_enrollment_trust_json', 'live_relay', 'profile', 'target']) assert.ok(strip(release)[key], key);
  const buildArguments = (text: string) => [...text.matchAll(/--build-arg "?([A-Z_]+)=?/g)].map(match => match[1]).sort();
  const releaseJob = workflowText('deployment-suse.yml').split('\n  web-image:\n')[1]!.split('\n  probe-web-shell:')[0]!;
  assert.deepEqual(buildArguments(workflowText('preview-web.yml')), buildArguments(releaseJob));
  assert.deepEqual(
    [...workflowText('preview-web.yml').matchAll(/--build-arg "?([A-Z_]+=[^\n]*)/g)].map(match => match[1]!.replace(/ \\$/, '')),
    [...releaseJob.matchAll(/--build-arg "?([A-Z_]+=[^\n]*)/g)].map(match => match[1]!.replace(/ \\$/, '')),
  );
});

// Build at merge (2026-10-27). preview-web.yml builds a main commit as soon as it is merged, while ci.yml runs,
// and refuses only a source whose own main CI run already failed. Qualification (green full CI, or a fast
// lane above one) moved to the deploy tool, which reads it at every deploy before the node is touched.
// Releases keep the exact-commit guard: deployment-suse.yml is untouched by this rule.
const previewGateStep = (name: string) => {
  const step = (workflowYaml('preview-web.yml').jobs['source-qualification'].steps as { name?: string; run?: string }[]).find(item => item.name === name);
  assert.ok(step?.run, name);
  return step.run;
};

test('the preview build gate needs a clean ancestor of main, then refuses only a completed CI failure', () => {
  const workflow = workflowYaml('preview-web.yml');
  const names = (workflow.jobs['source-qualification'].steps as { name?: string }[]).map(step => step.name);
  assert.deepEqual(names.filter(Boolean), ['Require a clean ancestor of main', 'Refuse a source whose own main CI run failed',
    'Ask the WebGPU release gate; a refusal fails the preview']);
  assert.deepEqual(previewGateStep('Require a clean ancestor of main').trim().split('\n'), [
    'set -euo pipefail',
    '[[ "$EXPECTED_SOURCE" =~ ^[a-f0-9]{40}$ ]]',
    'test "$(git rev-parse HEAD)" = "$EXPECTED_SOURCE"',
    'git merge-base --is-ancestor "$EXPECTED_SOURCE" refs/remotes/origin/main',
    'test -z "$(git status --porcelain)"',
  ]);
  // Every build says which gate it passed; a deploy tool from before this rule refuses the field.
  const push = (workflow.jobs.publish.steps as { run?: string }[]).find(step => /crane push/.test(step.run ?? ''))!.run!;
  assert.match(push, /candidateRuntimeQualified: false, sourceGate: "not-failed"\}' > "\$receipts\/release\.json"/);
  // The lolly.tools watcher dispatches builds at merge only while the workflow carries this marker.
  assert.match(workflowText('preview-web.yml'), /^# auto-ship: build-at-merge$/m);
  // The release guard stays where it was, and no preview code borrows it any more.
  assert.match(workflowText('deployment-suse.yml'), /Candidate requires its exact successful normal main CI run/);
  assert.doesNotMatch(workflowText('preview-web.yml'), /normal-ci|CI_SOURCE|Lane rule|deploy-lane/);
});

test('the preview build gate, run against GitHub run listings', t => {
  const script = previewGateStep('Refuse a source whose own main CI run failed');
  const repository = 'lolly-tools/lolly', source = 'a'.repeat(40);
  const run = (id: number, status: string, conclusion: string | null, over: Record<string, unknown> = {}) => ({
    id, run_attempt: 1, status, conclusion, path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: source,
    repository: { full_name: repository }, head_repository: { full_name: repository }, ...over });
  const cases: [string, unknown, string | null][] = [
    ['no run yet', { workflow_runs: [] }, 'none'],
    ['queued', { workflow_runs: [run(1, 'queued', null)] }, 'pending'],
    ['running', { workflow_runs: [run(1, 'in_progress', null)] }, 'pending'],
    ['green', { workflow_runs: [run(1, 'completed', 'success')] }, 'green'],
    ['cancelled by a newer push', { workflow_runs: [run(1, 'completed', 'cancelled')] }, 'cancelled'],
    ['failed, then green on a second push', { workflow_runs: [run(2, 'completed', 'success'), run(1, 'completed', 'failure')] }, 'green'],
    ['failed', { workflow_runs: [run(1, 'completed', 'failure')] }, null],
    ['timed out', { workflow_runs: [run(1, 'completed', 'timed_out')] }, null],
    ['failed while a re-run waits', { workflow_runs: [run(2, 'queued', null), run(1, 'completed', 'failure')] }, null],
    ['a fork failure does not count', { workflow_runs: [run(1, 'completed', 'failure', { head_repository: { full_name: 'fork/lolly' } })] }, 'none'],
    ['another commit does not count', { workflow_runs: [run(1, 'completed', 'failure', { head_sha: 'b'.repeat(40) })] }, 'none'],
    ['a pull request run does not count', { workflow_runs: [run(1, 'completed', 'failure', { event: 'pull_request' })] }, 'none'],
    ['malformed listing', { message: 'Not Found' }, null],
    ['malformed run', { workflow_runs: [run(0, 'completed', 'success')] }, null],
    ['overfull listing', { workflow_runs: Array.from({ length: 100 }, (_, i) => run(i + 1, 'in_progress', null)) }, null],
  ];
  const directory = mkdtempSync(join(tmpdir(), 'lolly-preview-gate-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [name, listing, ci] of cases) {
    const root = mkdtempSync(join(directory, 'case-'));
    writeFileSync(join(root, 'listing.json'), JSON.stringify(listing));
    const fake = `gh() { [[ "$1" == api && "$2" == "repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${source}&event=push&branch=main&per_page=100" ]] && cat "$RUNNER_TEMP/listing.json"; }\n`;
    const result = spawnSync('bash', ['-c', fake + script], { encoding: 'utf8', timeout: 10_000, env: {
      PATH: process.env.PATH, RUNNER_TEMP: root, EXPECTED_SOURCE: source, GITHUB_REPOSITORY: repository } });
    assert.equal(result.status === 0, ci !== null, `${name}: ${result.stderr}`);
    if (ci === null) { assert.equal(existsSync(join(root, 'source-gate.json')), false, name); continue; }
    const record = JSON.parse(readFileSync(join(root, 'source-gate.json'), 'utf8'));
    assert.deepEqual([record.version, record.rule, record.source, record.ci], [2, 'not-failed', source, ci], name);
  }
});

test('no release workflow can take a lane or build before its CI passes', () => {
  const directory = new URL('../.github/workflows/', import.meta.url);
  for (const file of readdirSync(directory).filter(name => /\.ya?ml$/.test(name))) {
    if (file === 'fast-lanes.yml') continue;
    assert.doesNotMatch(workflowText(file), /deploy-lane|fast-lanes|LANE_JOB|docs lane|web lane/, `${file} references a fast lane`);
    if (file !== 'preview-web.yml') assert.doesNotMatch(workflowText(file), /not-failed|build-at-merge/, `${file} builds at merge`);
  }
});

test('each preview run is titled with its source, which the deploy tool binds by', () => {
  assert.equal(workflowYaml('preview-web.yml')['run-name'], `Preview web ${gh('inputs.source')}`);
});

test('the signing scope refuses a pin that belongs to the other environment', () => {
  const key = () => JSON.stringify(generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }));
  const release = key(), preview = key();
  assert.equal(checkSigningScope({ environment: RELEASE_ENVIRONMENT, pin: release, releasePin: release }), release);
  assert.doesNotThrow(() => checkSigningScope({ environment: PREVIEW_ENVIRONMENT, pin: preview, releasePin: release }));
  assert.throws(() => checkSigningScope({ environment: PREVIEW_ENVIRONMENT, pin: release, releasePin: release }), /never sign for the release pin/);
  assert.throws(() => checkSigningScope({ environment: RELEASE_ENVIRONMENT, pin: preview, releasePin: release }), /only for the release pin/);
  assert.throws(() => checkSigningScope({ environment: 'other-signing', pin: release, releasePin: release }), /Unknown signing environment/);
  assert.throws(() => checkSigningScope({ environment: PREVIEW_ENVIRONMENT, pin: '', releasePin: release }), /not set/);
  assert.throws(() => checkSigningScope({ environment: PREVIEW_ENVIRONMENT, pin: preview, releasePin: '' }), /not set/);
  assert.throws(() => checkSigningScope({ environment: PREVIEW_ENVIRONMENT, pin: JSON.stringify({ ...JSON.parse(preview), d: 'x' }), releasePin: release }), /private key/);
  assert.throws(() => checkSigningScope({ environment: RELEASE_ENVIRONMENT, pin: '{"kty":"RSA"}', releasePin: release }), /EC P-256/);
});

test('the checked pin is emitted exactly as the caller gave it, so release builds embed the same string', () => {
  const jwk = JSON.parse(publicMaterial);
  const spaced = JSON.stringify({ y: jwk.y, x: jwk.x, crv: jwk.crv, kty: jwk.kty }, null, 2);
  for (const pin of [publicMaterial, spaced, ` ${publicMaterial}\n`]) {
    assert.equal(checkSigningScope({ environment: RELEASE_ENVIRONMENT, pin, releasePin: publicMaterial }), pin);
    // The script writes it to GITHUB_OUTPUT; read it back the way the runner does.
    const dir = mkdtempSync(join(tmpdir(), 'lolly-signing-scope-'));
    try {
      const output = join(dir, 'output');
      writeFileSync(output, '');
      const run = spawnSync(process.execPath, ['scripts/check-signing-scope.ts'], {
        encoding: 'utf8', timeout: 10_000,
        env: { ...process.env, SIGNING_ENVIRONMENT: RELEASE_ENVIRONMENT, PIN: pin, RELEASE_PIN: publicMaterial, GITHUB_OUTPUT: output },
      });
      assert.equal(run.status, 0, run.stderr);
      const match = /^pin<<(\S+)\n([\s\S]*)\n\1\n$/.exec(readFileSync(output, 'utf8'));
      assert.ok(match, 'the pin must use the delimited output form');
      assert.equal(match[2], pin);
      assert.equal(pin.includes(match[1]!), false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('release and native pins are compared by key, and the sync workflow runs that comparison', () => {
  const other = JSON.stringify(generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }));
  const spaced = JSON.stringify(JSON.parse(publicMaterial), null, 2);
  assert.equal(pinsMatch(publicMaterial, spaced), true);
  assert.equal(pinsMatch(publicMaterial, other), false);
  assert.throws(() => pinsMatch(publicMaterial, ''), /not set/);
  const sync = workflowYaml('release-pin-sync.yml');
  assert.ok(sync.on.schedule && sync.on.workflow_dispatch !== undefined);
  const step = sync.jobs.check.steps.find((s: any) => /--same-key/.test(s.run ?? ''));
  assert.ok(step, 'the sync workflow must run check-signing-scope.ts --same-key');
  assert.match(step.env.RELEASE_PIN, /vars\.LOLLY_RELEASE_PUBLIC_KEY_JWK/);
  assert.match(step.env.NATIVE_PIN, /vars\.VITE_CATALOG_PUBLIC_KEY_JWK/);
});
